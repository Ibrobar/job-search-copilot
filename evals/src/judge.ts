import type { Fact, LlmClient, TailorResult } from "@jsc/core";
import { z } from "zod";

// Faithfulness judge: does each tailored line say only what its cited facts say?
// The deterministic guard already proved every citation exists; this checks meaning.

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

export type ClaimVerdict = { text: string; supported: boolean; reason: string; kind: "summary" | "bullet" | "requirement" };

export async function judgeFaithfulness(llm: LlmClient, result: TailorResult, facts: Fact[]): Promise<ClaimVerdict[]> {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const items: { kind: ClaimVerdict["kind"]; text: string; ids: string[] }[] = [
    ...(result.summary ? [{ kind: "summary" as const, text: result.summary.text, ids: result.summary.sourceFactIds }] : []),
    ...result.bullets.map((b) => ({ kind: "bullet" as const, text: b.text, ids: b.sourceFactIds })),
    ...result.requirements
      .filter((r) => r.coverage === "full")
      .map((r) => ({ kind: "requirement" as const, text: `The candidate fully meets: ${r.name}`, ids: r.sourceFactIds })),
  ];
  if (items.length === 0) return [];

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
      {
        role: "system",
        content: `You audit resume claims against evidence. For each numbered claim, decide if the evidence listed under it supports it.
supported = true only if every factual element of the claim (employer, role, technology, number, scope, ownership, outcome) is stated in or directly implied by that evidence.
Rewording, reordering and summarizing are fine. Adding a number, technology, title, team size, or outcome that the evidence does not state is not supported.
For "The candidate fully meets: X" claims, supported = true only if the evidence shows real experience with X, not just something adjacent.
Give a short reason for every verdict. Return one verdict per claim, using its index.`,
      },
      { role: "user", content: listing },
    ],
  });

  return items.map((it, i) => {
    const v = data.verdicts.find((x) => x.index === i);
    // A missing verdict counts as unsupported: the judge must account for every claim.
    return { kind: it.kind, text: it.text, supported: v?.supported ?? false, reason: v?.reason ?? "no verdict returned" };
  });
}
