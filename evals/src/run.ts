import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  AzureOpenAiClient,
  type Fact,
  InMemoryFactStore,
  type LlmClient,
  REQUIREMENTS_PROMPT_VERSION,
  type RequirementSpec,
  TAILOR_PROMPT_VERSION,
  checkTruthfulness,
  extractRequirements,
  fitScore,
  parseFacts,
  tailorForJob,
} from "@jsc/core";
import type { GoldenJob } from "./import-jobs";
import { type CalibrationCase, JUDGE_PROMPT_VERSION, calibrateJudge, claimsOf, judgeClaims } from "./judge";
import { type JobRun, type Thresholds, computeMetrics, failedGates } from "./metrics";
import { BudgetExceededError, TokenMeter, metered } from "./metered";
import { type Stack, favoredStack } from "./stack";

// Eval runner. Runs the real pipeline on the golden jobs and checks it without hand labels.
// Gates (cheap model only): fabrication (code), evidence ablation, persona ordering, re-run stability.
// Optional, report-only (gpt-5.4 judge): faithfulness of each line, and a second-opinion score.
//
//   pnpm evals                       full run, 40 jobs (~850k tokens, ~$0.60)
//   pnpm evals --limit 10            CI subset (~210k tokens, ~$0.15)
//   --max-tokens N                   hard cap for this run (default: thresholds.json budget)
//   pnpm evals --judge               + judge calibration and faithfulness (~+$1.50 on a full run)
//   pnpm evals --second-opinion      + gpt-5.4 re-scoring every job (~+$3 on a full run)

const { values: args } = parseArgs({
  options: {
    limit: { type: "string" },
    stability: { type: "string" },
    concurrency: { type: "string", default: "4" },
    "max-tokens": { type: "string" },
    judge: { type: "boolean", default: false },
    "second-opinion": { type: "boolean", default: false },
  },
});

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
try {
  process.loadEnvFile(new URL("../.env", root));
} catch {
  // CI provides env vars directly.
}

const thresholds: Thresholds = JSON.parse(read("thresholds.json"));
const allJobs: GoldenJob[] = JSON.parse(read("golden/jobs.json"));
// Deterministic subset: sort by id (a hash), so the CI sample is a stable, unbiased spread.
const jobs = args.limit ? [...allJobs].sort((a, b) => a.id.localeCompare(b.id)).slice(0, Number(args.limit)) : allJobs;
const stabilityCount = Number(args.stability ?? (args.limit ? 3 : 5));

// Personas are matched on seniority, degree, cloud and tooling; only the stack differs. Ibrahim's
// real profile is not used here, so the test isolates "does the score follow the stack".
const PERSONA_FILE: Record<Stack, string> = { web: "web-fullstack", java: "java-backend", data: "data-python" };
const profiles = Object.fromEntries(
  ["ibrahim", ...Object.values(PERSONA_FILE)].map((name) => [name, parseFacts(read(`golden/profiles/${name}.md`))]),
);

const meter = new TokenMeter(Number(args["max-tokens"] ?? thresholds.budget.maxTokensPerRun));
const chat = metered(AzureOpenAiClient.fromEnv(process.env, { maxRetries: 8 }), meter, "tailor");
const useJudge = args.judge || args["second-opinion"];
const judge = useJudge
  ? metered(
      AzureOpenAiClient.fromEnv(process.env, { chatDeployment: required("AZURE_OPENAI_JUDGE_DEPLOYMENT"), maxRetries: 8 }),
      meter,
      "judge",
    )
  : undefined;

// Embed each profile once; ablations reuse the vectors instead of re-embedding.
const vectors = new Map<string, { fact: Fact; vector: number[] }[]>();
for (const [name, { facts }] of Object.entries(profiles)) {
  const res = await chat.embed(facts.map((f) => (f.context ? `${f.context}: ${f.text}` : f.text)));
  vectors.set(name, facts.map((fact, i) => ({ fact, vector: res.vectors[i]! })));
}

type TailorOpts = { llm?: LlmClient; dropIds?: Set<string>; requirements?: RequirementSpec[] };

async function tailor(profile: string, jd: string, opts: TailorOpts = {}) {
  const store = new InMemoryFactStore();
  await store.upsert("u", vectors.get(profile)!.filter((x) => !opts.dropIds?.has(x.fact.id)));
  return tailorForJob({
    userId: "u",
    jobDescription: jd,
    llm: opts.llm ?? chat,
    store,
    rules: profiles[profile]!.rules,
    requirements: opts.requirements,
  });
}

async function evalJob(job: GoldenJob, index: number): Promise<JobRun> {
  const facts = profiles.ibrahim!.facts;
  // One candidate-blind requirement list per job, shared by every run below (as the app caches it).
  const { requirements } = await extractRequirements(chat, job.jd);
  const main = await tailor("ibrahim", job.jd, { requirements });
  const r = main.result;
  const drafted = (r.summary ? 1 : 0) + r.bullets.length + main.rejected.filter((v) => "text" in v).length;
  const run: JobRun = {
    id: job.id,
    company: job.company,
    title: job.title,
    score: r.fitScore,
    draftedClaims: drafted,
    rejected: main.rejected,
    leaked: checkTruthfulness(r, facts),
    verdicts: args.judge ? await judgeClaims(judge!, claimsOf(r), facts) : [],
  };

  // Ablation: remove the evidence behind every covered core requirement; the score must fall.
  const coreEvidence = new Set(
    r.requirements.filter((q) => q.importance === "core" && q.coverage !== "none").flatMap((q) => q.sourceFactIds),
  );
  if (coreEvidence.size > 0) {
    const ablated = await tailor("ibrahim", job.jd, { requirements, dropIds: coreEvidence });
    // What those requirements were worth: the score if they had been "none" from the start.
    const withoutThem = fitScore(
      r.requirements.map((q) => (q.importance === "core" && q.coverage !== "none" ? { ...q, coverage: "none" as const } : q)),
    );
    run.ablation = { removedFactIds: [...coreEvidence], score: ablated.result.fitScore, expectedDrop: r.fitScore - withoutThem };
  }

  if (index < stabilityCount) run.rerunScore = (await tailor("ibrahim", job.jd, { requirements })).result.fitScore;
  // The judge extracts its own requirements, so its score is an independent second opinion.
  if (args["second-opinion"]) run.secondOpinionScore = (await tailor("ibrahim", job.jd, { llm: judge! })).result.fitScore;

  const favored = favoredStack(`${job.title}\n${job.jd}`);
  if (favored) {
    const scores: Partial<Record<Stack, number>> = {};
    for (const s of ["web", "java", "data"] as const) {
      scores[s] = (await tailor(PERSONA_FILE[s], job.jd, { requirements })).result.fitScore;
    }
    run.persona = { favored, scores };
  }

  const flag = run.leaked.length || run.verdicts.some((v) => !v.supported) ? " !" : "";
  console.log(`  ${String(r.fitScore).padStart(3)}  ${job.company} - ${job.title}`.slice(0, 90) + flag);
  return run;
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

const started = Date.now();
console.log(`Evaluating ${jobs.length} jobs (prompts ${REQUIREMENTS_PROMPT_VERSION} + ${TAILOR_PROMPT_VERSION}, judge ${args.judge ? JUDGE_PROMPT_VERSION : "off"}, cap ${meter.maxTokens} tokens)`);
let runs: JobRun[];
let calibration: Awaited<ReturnType<typeof calibrateJudge>> | undefined;
try {
  if (args.judge) {
    // Check the judge first: if it can't tell planted fabrications from paraphrases, its verdicts mean nothing.
    const { cases } = JSON.parse(read("golden/judge-calibration.json")) as { cases: CalibrationCase[] };
    calibration = await calibrateJudge(judge!, cases);
  }
  runs = await pool(jobs, Number(args.concurrency), evalJob);
} catch (e) {
  if (e instanceof BudgetExceededError) {
    console.error(`FAIL: ${e.message}. Fix the cause (prompt size, call count); don't raise the cap to pass.`);
    process.exit(1);
  }
  throw e;
}

const metrics = computeMetrics(runs, thresholds, calibration);
const failed = failedGates(metrics);
const tailorCalls = meter.calls.filter((c) => c.role === "tailor");
const p50 = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const summary = {
  at: new Date().toISOString(),
  jobs: jobs.length,
  promptVersions: [REQUIREMENTS_PROMPT_VERSION, TAILOR_PROMPT_VERSION],
  judgeVersion: JUDGE_PROMPT_VERSION,
  tokens: meter.total,
  calls: meter.calls.length,
  tailorLatencyP50Ms: p50(tailorCalls.map((c) => c.latencyMs)),
  durationS: Math.round((Date.now() - started) / 1000),
  metrics,
  pass: failed.length === 0,
};

const table = [
  "| Metric | Result | Gate | n | |",
  "|---|---|---|---|---|",
  ...metrics.map((m) => `| ${m.name} | ${m.display} | ${m.threshold} | ${m.n} | ${m.pass === null ? "-" : m.pass ? "✅" : "❌"} |`),
].join("\n");
const md = `### Evals: ${summary.pass ? "PASS" : "FAIL"}\n\n${jobs.length} jobs · ${summary.tokens.toLocaleString()} tokens · ${summary.calls} calls · p50 tailor latency ${summary.tailorLatencyP50Ms} ms · ${summary.durationS}s\n\n${table}\n`;

mkdirSync(new URL("results/", root), { recursive: true });
writeFileSync(new URL("results/latest.json", root), JSON.stringify({ summary, runs }, null, 2));
writeFileSync(new URL("results/latest.md", root), md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

console.log(`\n${md}`);
const unsupported = runs.flatMap((r) => r.verdicts.filter((v) => !v.supported).map((v) => `  [${r.company}] ${v.text}\n      -> ${v.reason}`));
if (unsupported.length) console.log(`Unsupported claims (judge):\n${unsupported.join("\n")}`);
for (const m of calibration?.misses ?? []) console.log(`Judge calibration miss (expected ${m.expected}): ${m.text}\n      -> ${m.reason}`);
process.exit(summary.pass ? 0 : 1);

function required(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
}
