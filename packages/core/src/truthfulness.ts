import type { Fact, TailorResult } from "./schemas";

export type TruthViolation =
  | { kind: "unsourced-claim"; text: string }
  | { kind: "unknown-fact-id"; text: string; factId: string }
  | { kind: "unsupported-skill"; skill: string };

/**
 * Deterministic guard: every tailored claim must cite real fact ids, and every listed skill
 * must appear in the user's facts. Semantic faithfulness (does the claim say what the fact says)
 * is checked separately by the eval suite.
 */
export function checkTruthfulness(result: TailorResult, facts: Fact[]): TruthViolation[] {
  const ids = new Set(facts.map((f) => f.id));
  const knownSkills = new Set(facts.flatMap((f) => f.skills).map(normalizeSkill));
  const violations: TruthViolation[] = [];

  for (const claim of [result.summary, ...result.bullets]) {
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
  return violations;
}

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/[\s.\-_]+/g, "");
}
