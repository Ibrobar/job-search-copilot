import type { Claim, Fact, Requirement } from "./schemas";

export type TruthViolation =
  | { kind: "unsourced-claim"; text: string }
  | { kind: "unknown-fact-id"; text: string; factId: string }
  | { kind: "unsupported-skill"; skill: string }
  | { kind: "unsourced-requirement"; requirement: string };

/**
 * Deterministic guard: every tailored claim must cite real fact ids, every listed skill must appear
 * in the user's facts, and every requirement marked covered must cite evidence. Semantic faithfulness
 * (does the claim say what the fact says) is checked separately by the eval suite.
 */
export function checkTruthfulness(
  result: { summary: Claim | null; bullets: Claim[]; skills: string[]; requirements?: Requirement[] },
  facts: Fact[],
): TruthViolation[] {
  const ids = new Set(facts.map((f) => f.id));
  const knownSkills = new Set(facts.flatMap((f) => f.skills).flatMap(skillVariants).map(normalizeSkill));
  const violations: TruthViolation[] = [];

  for (const claim of [...(result.summary ? [result.summary] : []), ...result.bullets]) {
    if (claim.sourceFactIds.length === 0) {
      violations.push({ kind: "unsourced-claim", text: claim.text });
    }
    for (const id of claim.sourceFactIds) {
      if (!ids.has(id)) violations.push({ kind: "unknown-fact-id", text: claim.text, factId: id });
    }
  }
  for (const skill of result.skills) {
    if (!knownSkills.has(normalizeSkill(skill))) violations.push({ kind: "unsupported-skill", skill });
  }
  for (const r of result.requirements ?? []) {
    if (r.coverage === "none") continue;
    if (r.sourceFactIds.length === 0 || r.sourceFactIds.some((id) => !ids.has(id))) {
      violations.push({ kind: "unsourced-requirement", requirement: r.name });
    }
  }
  return violations;
}

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/[\s.\-_]+/g, "");
}

/** "JavaScript (ES6+)" -> also "JavaScript"; "Linux/UNIX" -> also "Linux", "UNIX". */
export function skillVariants(skill: string): string[] {
  const base = skill.replace(/\s*\([^)]*\)/g, "").trim();
  const parts = base.includes("/") ? base.split("/").map((p) => p.trim()) : [];
  return [...new Set([skill.trim(), base, ...parts].filter(Boolean))];
}
