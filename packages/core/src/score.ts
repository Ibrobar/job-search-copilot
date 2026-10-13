import type { Requirement } from "./schemas";

export type MatchBand = "Great Match" | "Ok Match" | "Not a Match";

/** Same bands as the original resume-tailoring dashboard. */
export function matchBand(score: number): MatchBand {
  if (score >= 80) return "Great Match";
  if (score >= 60) return "Ok Match";
  return "Not a Match";
}

const WEIGHT = { core: 2, nice: 1 } as const;
const CREDIT = { full: 1, partial: 0.5, none: 0 } as const;

/** Weighted coverage of the JD's must-haves: core counts double, partial counts half. */
export function fitScore(requirements: Requirement[]): number {
  const total = requirements.reduce((s, r) => s + WEIGHT[r.importance], 0);
  if (total === 0) return 0;
  const got = requirements.reduce((s, r) => s + WEIGHT[r.importance] * CREDIT[r.coverage], 0);
  return Math.round((100 * got) / total);
}
