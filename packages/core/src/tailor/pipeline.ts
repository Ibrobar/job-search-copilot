import type { LlmClient, LlmUsage } from "../llm/types";
import { REQUIREMENTS_PROMPT_VERSION, REQUIREMENTS_SYSTEM_PROMPT, requirementsUserPrompt } from "../prompts/requirements.v1";
import { TAILOR_PROMPT_VERSION, tailorSystemPrompt, tailorUserPrompt } from "../prompts/tailor.v3";
import type { FactStore } from "../retrieval/store";
import {
  type Fact,
  type Requirement,
  RequirementListSchema,
  type RequirementSpec,
  TailorDraftSchema,
  type TailorResult,
} from "../schemas";
import { fitScore } from "../score";
import { type TruthViolation, checkTruthfulness } from "../truthfulness";

const MAX_JD_CHARS = 12_000;
const EMBED_BATCH = 64;

export async function ingestFacts(args: { userId: string; facts: Fact[]; llm: LlmClient; store: FactStore }) {
  const usage: LlmUsage[] = [];
  for (let i = 0; i < args.facts.length; i += EMBED_BATCH) {
    const batch = args.facts.slice(i, i + EMBED_BATCH);
    const res = await args.llm.embed(batch.map(embeddingText));
    usage.push(res.usage);
    await args.store.upsert(
      args.userId,
      batch.map((fact, j) => ({ fact, vector: res.vectors[j]! })),
    );
  }
  return { usage };
}

export type TailorOutput = {
  result: TailorResult;
  /** The job's requirements as extracted. Cache these per job and pass them back in. */
  requirementSpecs: RequirementSpec[];
  /** What the guard removed. Rejected claims never reach the user. */
  rejected: TruthViolation[];
  usage: LlmUsage[];
  promptVersions: string[];
};

/** Step 1: read the job's requirements from the JD alone. No candidate data goes into this call. */
export async function extractRequirements(llm: LlmClient, jobDescription: string) {
  const res = await llm.chatJson({
    schema: RequirementListSchema,
    schemaName: "job_requirements",
    messages: [
      { role: "system", content: REQUIREMENTS_SYSTEM_PROMPT },
      { role: "user", content: requirementsUserPrompt(jobDescription.slice(0, MAX_JD_CHARS)) },
    ],
  });
  return { requirements: res.data.requirements, usage: res.usage };
}

/**
 * Step 2: retrieve the user's most relevant facts, ask the model for cited coverage and content,
 * then enforce the truthfulness guard: unsourced claims and unsupported skills are dropped,
 * requirements claimed as covered without evidence are downgraded to "none", and "full" coverage
 * backed only by a skills list or summary is capped at "partial", all before the score is computed.
 */
export async function tailorForJob(args: {
  userId: string;
  jobDescription: string;
  llm: LlmClient;
  store: FactStore;
  /** Cached output of extractRequirements for this job. Extracted here when missing. */
  requirements?: RequirementSpec[];
  rules?: string[];
  topK?: number;
}): Promise<TailorOutput> {
  const usage: LlmUsage[] = [];
  const jd = args.jobDescription.slice(0, MAX_JD_CHARS);
  let specs = args.requirements;
  if (!specs) {
    const extracted = await extractRequirements(args.llm, jd);
    specs = extracted.requirements;
    usage.push(extracted.usage);
  }

  const query = await args.llm.embed([jd]);
  usage.push(query.usage);
  const hits = await args.store.search(args.userId, query.vectors[0]!, args.topK ?? 24);
  // Skill and summary facts are small and always relevant to coverage, so they always go in.
  const always = (await args.store.all(args.userId)).filter((f) => f.section === "skill" || f.section === "summary");
  const facts = dedupeById([...always, ...hits.map((h) => h.fact)]);

  const chat = await args.llm.chatJson({
    schema: TailorDraftSchema,
    schemaName: "tailored_resume",
    messages: [
      { role: "system", content: tailorSystemPrompt(args.rules ?? []) },
      { role: "user", content: tailorUserPrompt(facts, specs, jd) },
    ],
  });
  usage.push(chat.usage);
  const draft = chat.data;

  // Every extracted requirement gets exactly one coverage entry; anything the model skipped is "none".
  const byNumber = new Map(draft.coverage.map((c) => [c.requirement, c]));
  const merged: Requirement[] = specs.map((spec, i) => {
    const c = byNumber.get(i + 1);
    return { ...spec, coverage: c?.coverage ?? "none", sourceFactIds: c?.sourceFactIds ?? [] };
  });

  const rejected = checkTruthfulness({ ...draft, requirements: merged }, facts);
  const badClaims = new Set(rejected.flatMap((v) => ("text" in v ? [v.text] : [])));
  const badSkills = new Set(rejected.flatMap((v) => (v.kind === "unsupported-skill" ? [v.skill] : [])));
  const badReqs = new Set(rejected.flatMap((v) => (v.kind === "unsourced-requirement" ? [v.requirement] : [])));

  const requirements = capByEvidence(
    merged.map((r) => (badReqs.has(r.name) ? { ...r, coverage: "none" as const, sourceFactIds: [] } : r)),
    facts,
  );
  const result: TailorResult = {
    requirements,
    summary: badClaims.has(draft.summary.text) ? null : draft.summary,
    bullets: draft.bullets.filter((b) => !badClaims.has(b.text)),
    skills: draft.skills.filter((s) => !badSkills.has(s)),
    fitScore: fitScore(requirements),
    matchedSkills: requirements.filter((r) => r.coverage !== "none").map((r) => r.name),
    missingSkills: requirements.filter((r) => r.coverage === "none").map((r) => r.name),
  };

  return {
    result,
    requirementSpecs: specs,
    rejected,
    usage,
    promptVersions: [REQUIREMENTS_PROMPT_VERSION, TAILOR_PROMPT_VERSION],
  };
}

const SELF_DESCRIPTION: Fact["section"][] = ["skill", "summary"];

/**
 * A skills list or summary says what someone claims, not what they did. "Full" coverage needs at
 * least one cited fact from real work (experience, project, education, certification); otherwise
 * it is capped at "partial".
 */
export function capByEvidence(requirements: Requirement[], facts: Fact[]): Requirement[] {
  const section = new Map(facts.map((f) => [f.id, f.section]));
  return requirements.map((r) =>
    r.coverage === "full" && r.sourceFactIds.every((id) => SELF_DESCRIPTION.includes(section.get(id)!))
      ? { ...r, coverage: "partial" as const }
      : r,
  );
}

function embeddingText(f: Fact): string {
  return f.context ? `${f.context}: ${f.text}` : f.text;
}

function dedupeById(facts: Fact[]): Fact[] {
  const seen = new Set<string>();
  return facts.filter((f) => !seen.has(f.id) && seen.add(f.id));
}
