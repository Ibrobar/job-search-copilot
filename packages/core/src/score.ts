export type MatchBand = "Great Match" | "Ok Match" | "Not a Match";

/** Same bands as the original resume-tailoring dashboard. */
export function matchBand(score: number): MatchBand {
  if (score >= 80) return "Great Match";
  if (score >= 60) return "Ok Match";
  return "Not a Match";
}
