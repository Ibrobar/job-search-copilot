import { describe, expect, it } from "vitest";
import { type JobRun, type Thresholds, computeMetrics, failedGates } from "./metrics";

const t: Thresholds = {
  judgeCalibration: { minAccuracy: 0.9 },
  fabrication: { maxLeaked: 0, maxDraftRejectionRate: 0.05 },
  faithfulness: { minClaimRate: 0.95, minRequirementRate: 0.9 },
  evidenceAblation: { minDrop: 10, minPassRate: 0.9 },
  personaOrdering: { minAccuracy: 0.9 },
  stability: { maxMeanAbsDiff: 8 },
  budget: { maxTokensPerRun: 1 },
};

const run = (over: Partial<JobRun> = {}): JobRun => ({
  id: "j",
  company: "C",
  title: "T",
  score: 80,
  draftedClaims: 5,
  rejected: [],
  leaked: [],
  verdicts: [{ kind: "bullet", text: "b", supported: true, reason: "" }],
  ...over,
});

const metric = (runs: JobRun[], name: string) => computeMetrics(runs, t).find((m) => m.name.startsWith(name))!;

describe("computeMetrics", () => {
  it("fails gates that had no data instead of passing them", () => {
    const ms = computeMetrics([run()], t);
    expect(ms.find((m) => m.name.startsWith("Persona"))?.pass).toBeNull();
    expect(failedGates(ms).map((m) => m.name)).toEqual([
      "Judge calibration (known-answer cases)",
      "Requirement coverage faithfulness (judge)",
      "Score drops when evidence removed",
      "Persona ordering accuracy",
      "Re-run score difference (mean abs)",
    ]);
  });

  it("passes when every gate has data and meets its threshold", () => {
    const full = run({
      verdicts: [
        { kind: "bullet", text: "a", supported: true, reason: "" },
        { kind: "requirement", text: "b", supported: true, reason: "" },
      ],
      ablation: { removedFactIds: [], score: 50 },
      persona: { favored: "web", scores: { web: 80, java: 40 } },
      rerunScore: 78,
    });
    expect(failedGates(computeMetrics([full], t, { accuracy: 1, n: 16 }))).toEqual([]);
  });

  it("fails on any fabricated claim left in the output", () => {
    const m = metric([run({ leaked: [{ kind: "unsourced-claim", text: "x" }] })], "Fabricated");
    expect(m.pass).toBe(false);
  });

  it("measures draft rejections as a share of drafted claims", () => {
    const m = metric([run({ draftedClaims: 10, rejected: [{ kind: "unsourced-claim", text: "x" }] })], "Draft claims");
    expect(m.value).toBeCloseTo(0.1);
    expect(m.pass).toBe(false);
  });

  it("separates claim and requirement faithfulness", () => {
    const r = run({
      verdicts: [
        { kind: "bullet", text: "a", supported: true, reason: "" },
        { kind: "requirement", text: "b", supported: false, reason: "" },
      ],
    });
    expect(metric([r], "Claim faithfulness").value).toBe(1);
    expect(metric([r], "Requirement coverage").value).toBe(0);
  });

  it("counts an ablation as passing only if the score drops by the minimum", () => {
    const runs = [run({ score: 80, ablation: { removedFactIds: [], score: 70 } }), run({ score: 80, ablation: { removedFactIds: [], score: 75 } })];
    expect(metric(runs, "Score drops").value).toBe(0.5);
  });

  it("scores persona ordering pairwise against the favored persona", () => {
    const r = run({ persona: { favored: "java", scores: { java: 70, web: 40, data: 75 } } });
    expect(metric([r], "Persona").value).toBe(0.5);
  });

  it("averages re-run differences", () => {
    const runs = [run({ score: 80, rerunScore: 70 }), run({ score: 60, rerunScore: 64 })];
    expect(metric(runs, "Re-run").value).toBe(7);
  });
});
