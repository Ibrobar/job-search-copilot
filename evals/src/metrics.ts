import { matchBand, type TruthViolation } from "@jsc/core";
import type { ClaimVerdict } from "./judge";
import type { Stack } from "./stack";

export type JobRun = {
  id: string;
  company: string;
  title: string;
  score: number;
  /** Claims the model drafted, before the guard. */
  draftedClaims: number;
  /** What the guard removed from the model's draft. */
  rejected: TruthViolation[];
  /** Violations left in the final output. Must always be empty. */
  leaked: TruthViolation[];
  verdicts: ClaimVerdict[];
  /** expectedDrop: points the removed evidence was worth in the original score. */
  ablation?: { removedFactIds: string[]; score: number; expectedDrop: number };
  rerunScore?: number;
  secondOpinionScore?: number;
  persona?: { favored: Stack; scores: Partial<Record<Stack, number>> };
};

export type Thresholds = {
  judgeCalibration: { minAccuracy: number };
  fabrication: { maxLeaked: number; maxDraftRejectionRate: number };
  /** Only jobs whose removed evidence was worth at least minExpectedDrop points count (smaller is noise). */
  evidenceAblation: { minExpectedDrop: number; minAvgDrop: number };
  personaOrdering: { minAccuracy: number };
  stability: { maxMeanAbsDiff: number };
  budget: { maxTokensPerRun: number };
};

export type Metric = { name: string; value: number; display: string; threshold: string; pass: boolean | null; n: number };

const REPORT_ONLY = "report only";
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const rate = (num: number, den: number) => (den === 0 ? 1 : num / den);

export type Calibration = { accuracy: number; n: number };

export function computeMetrics(runs: JobRun[], t: Thresholds, calibration?: Calibration): Metric[] {
  const leaked = runs.reduce((s, r) => s + r.leaked.length, 0);
  const rejectedClaims = runs.reduce((s, r) => s + r.rejected.filter((v) => "text" in v).length, 0);
  const drafted = runs.reduce((s, r) => s + r.draftedClaims, 0);
  const draftRejection = rate(rejectedClaims, drafted);

  const claimVerdicts = runs.flatMap((r) => r.verdicts.filter((v) => v.kind !== "requirement"));
  const reqVerdicts = runs.flatMap((r) => r.verdicts.filter((v) => v.kind === "requirement"));
  const claimRate = rate(claimVerdicts.filter((v) => v.supported).length, claimVerdicts.length);
  const reqRate = rate(reqVerdicts.filter((v) => v.supported).length, reqVerdicts.length);

  // Averaged across jobs: one noisy job can't flip the gate, and a job whose evidence was worth
  // only a few points (within re-run noise) doesn't count at all.
  const ablated = runs.filter((r) => r.ablation && r.ablation.expectedDrop >= t.evidenceAblation.minExpectedDrop);
  const drops = ablated.map((r) => r.score - r.ablation!.score);
  const avgDrop = drops.length ? drops.reduce((s, d) => s + d, 0) / drops.length : 0;
  const rose = drops.filter((d) => d < 0).length;

  const pairs = runs.flatMap((r) => {
    if (!r.persona) return [];
    const { favored, scores } = r.persona;
    const top = scores[favored];
    return (Object.keys(scores) as Stack[])
      .filter((s) => s !== favored && top !== undefined && scores[s] !== undefined)
      .map((s) => top! > scores[s]!);
  });
  const ordering = rate(pairs.filter(Boolean).length, pairs.length);

  const reruns = runs.filter((r) => r.rerunScore !== undefined);
  const meanAbsDiff = reruns.length ? reruns.reduce((s, r) => s + Math.abs(r.score - r.rerunScore!), 0) / reruns.length : 0;

  const second = runs.filter((r) => r.secondOpinionScore !== undefined);
  const mae = second.length ? second.reduce((s, r) => s + Math.abs(r.score - r.secondOpinionScore!), 0) / second.length : 0;
  const bandAgree = rate(second.filter((r) => matchBand(r.score) === matchBand(r.secondOpinionScore!)).length, second.length);

  return [
    {
      name: "Judge calibration (known-answer cases)",
      value: calibration?.accuracy ?? 0,
      display: calibration ? pct(calibration.accuracy) : "not run",
      // Gates only when the judge ran: an uncalibrated judge would make its own numbers meaningless.
      threshold: calibration ? `>= ${pct(t.judgeCalibration.minAccuracy)}` : REPORT_ONLY,
      pass: calibration ? calibration.accuracy >= t.judgeCalibration.minAccuracy : null,
      n: calibration?.n ?? 0,
    },
    { name: "Fabricated claims in output", value: leaked, display: String(leaked), threshold: `<= ${t.fabrication.maxLeaked}`, pass: leaked <= t.fabrication.maxLeaked, n: runs.length },
    { name: "Draft claims rejected by guard", value: draftRejection, display: `${pct(draftRejection)} (${rejectedClaims}/${drafted})`, threshold: `<= ${pct(t.fabrication.maxDraftRejectionRate)}`, pass: drafted ? draftRejection <= t.fabrication.maxDraftRejectionRate : null, n: drafted },
    // Faithfulness is informational: reported when the judge runs (--judge), never a gate.
    { name: "Claim faithfulness (judge)", value: claimRate, display: claimVerdicts.length ? pct(claimRate) : "not run", threshold: REPORT_ONLY, pass: null, n: claimVerdicts.length },
    { name: "Requirement coverage faithfulness (judge)", value: reqRate, display: reqVerdicts.length ? pct(reqRate) : "not run", threshold: REPORT_ONLY, pass: null, n: reqVerdicts.length },
    { name: "Average score drop when evidence removed", value: avgDrop, display: `${avgDrop.toFixed(1)} pts (${rose} rose)`, threshold: `>= ${t.evidenceAblation.minAvgDrop} pts`, pass: ablated.length ? avgDrop >= t.evidenceAblation.minAvgDrop : null, n: ablated.length },
    { name: "Persona ordering accuracy", value: ordering, display: pct(ordering), threshold: `>= ${pct(t.personaOrdering.minAccuracy)}`, pass: pairs.length ? ordering >= t.personaOrdering.minAccuracy : null, n: pairs.length },
    { name: "Re-run score difference (mean abs)", value: meanAbsDiff, display: meanAbsDiff.toFixed(1), threshold: `<= ${t.stability.maxMeanAbsDiff}`, pass: reruns.length ? meanAbsDiff <= t.stability.maxMeanAbsDiff : null, n: reruns.length },
    { name: "Second-opinion score gap (mean abs, gpt-5.4)", value: mae, display: mae.toFixed(1), threshold: REPORT_ONLY, pass: null, n: second.length },
    { name: "Second-opinion band agreement", value: bandAgree, display: pct(bandAgree), threshold: REPORT_ONLY, pass: null, n: second.length },
  ];
}

/** A gate fails when its check failed or never ran (no data). An empty eval must not pass. */
export function failedGates(metrics: Metric[]): Metric[] {
  return metrics.filter((m) => m.threshold !== REPORT_ONLY && m.pass !== true);
}
