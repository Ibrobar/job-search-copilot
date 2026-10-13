import type { Fact, LlmClient, TailorResult } from "@jsc/core";
import { z } from "zod";

// Faithfulness judge: does each tailored line say only what its cited facts say?
// The deterministic guard already proved every citation exists; this checks meaning.
// The judge itself is checked against golden/judge-calibration.json on every run.

export const JUDGE_PROMPT_VERSION = "faithfulness.v1";

const VerdictSchema = z.object({
  verdicts: z.array(
    z.object({
      index: z.number().int(),
      supported: z.boolean(),
      reason: z.string(),
    }),
  ),
});

export type ClaimKind = "summary" | "bullet" | "requirement";
export type ClaimItem = { kind: ClaimKind; text: string; ids: string[] };
export type ClaimVerdict = { text: string; supported: boolean; reason: string; kind: ClaimKind };

export const JUDGE_SYSTEM_PROMPT = `You audit resume claims against evidence. For each numbered claim, decide if the evidence listed under it supports it.
supported = true only if every factual element of the claim (employer, role, technology, number, scope, ownership, outcome) is stated in or directly implied by that evidence.
Rewording, reordering and summarizing are fine. Adding a number, technology, title, team size, or outcome that the evidence does not state is not supported.
For "The candidate fully meets: X" claims, supported = true only if the evidence shows real experience with X, not just something adjacent.
Give a short reason for every verdict. Return one verdict per claim, using its index.`;

export async function judgeClaims(llm: LlmClient, items: ClaimItem[], facts: Fact[]): Promise<ClaimVerdict[]> {
  if (items.length === 0) return [];
  const byId = new Map(facts.map((f) => [f.id, f]));
  const listing = items
    .map((it, i) => {
      const evidence = it.ids
        .map((id) => byId.get(id))
        .filter((f): f is Fact => !!f)
        .map((f) => `    [${f.id}] ${f.context ? `(${f.context}) ` : ""}${f.text}`)
        .join("\n");
      return `${i}. CLAIM: ${it.text}\n   EVIDENCE:\n${evidence || "    (none)"}`;
    })
    .join("\n\n");

  const { data } = await llm.chatJson({
    schema: VerdictSchema,
    schemaName: "faithfulness_verdicts",
    messages: [
      { role: "system", content: JUDGE_SYSTEM_PROMPT },
      { role: "user", content: listing },
    ],
  });

  return items.map((it, i) => {
    const v = data.verdicts.find((x) => x.index === i);
    // A missing verdict counts as unsupported: the judge must account for every claim.
    return { kind: it.kind, text: it.text, supported: v?.supported ?? false, reason: v?.reason ?? "no verdict returned" };
  });
}

export function claimsOf(result: TailorResult): ClaimItem[] {
  return [
    ...(result.summary ? [{ kind: "summary" as const, text: result.summary.text, ids: result.summary.sourceFactIds }] : []),
    ...result.bullets.map((b) => ({ kind: "bullet" as const, text: b.text, ids: b.sourceFactIds })),
    ...result.requirements
      .filter((r) => r.coverage === "full")
      .map((r) => ({ kind: "requirement" as const, text: `The candidate fully meets: ${r.name}`, ids: r.sourceFactIds })),
  ];
}

/** Evidence is inline text, so editing a profile (and shifting its fact ids) can't break a case. */
export type CalibrationCase = { kind: ClaimKind; text: string; evidence: string[]; expected: boolean; why: string };

/** Score the judge on known-answer cases. Returns the accuracy and every miss. */
export async function calibrateJudge(llm: LlmClient, cases: CalibrationCase[]) {
  const facts: Fact[] = cases.flatMap((c, i) =>
    c.evidence.map((text, j) => ({ id: `c${i}-${j}`, section: "experience" as const, text, skills: [] })),
  );
  const items: ClaimItem[] = cases.map((c, i) => ({ kind: c.kind, text: c.text, ids: c.evidence.map((_, j) => `c${i}-${j}`) }));
  const verdicts = await judgeClaims(llm, items, facts);
  const misses = cases
    .map((c, i) => ({ ...c, got: verdicts[i]!.supported, reason: verdicts[i]!.reason }))
    .filter((c) => c.got !== c.expected);
  return { accuracy: (cases.length - misses.length) / cases.length, n: cases.length, misses };
}
