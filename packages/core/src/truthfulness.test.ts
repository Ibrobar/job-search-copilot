import { describe, expect, it } from "vitest";
import type { Fact, TailorResult } from "./schemas";
import { checkTruthfulness } from "./truthfulness";

const facts: Fact[] = [
  { id: "f1", section: "experience", text: "Triaged 50+ IT alerts per day", skills: ["ServiceNow"] },
  { id: "f2", section: "project", text: "Built Boycat for 10,000+ users", skills: ["Next.js", "Supabase"] },
];

const base: TailorResult = {
  fitScore: 85,
  matchedSkills: ["Next.js"],
  missingSkills: ["Kubernetes"],
  summary: { text: "Engineer who ships.", sourceFactIds: ["f2"] },
  bullets: [{ text: "Triaged 50+ alerts daily", sourceFactIds: ["f1"] }],
  skills: ["nextjs", "Supabase", "ServiceNow"],
};

describe("checkTruthfulness", () => {
  it("passes when every claim and skill is sourced", () => {
    expect(checkTruthfulness(base, facts)).toEqual([]);
  });

  it("flags a claim with no sources", () => {
    const r = { ...base, bullets: [{ text: "Led a team of 20", sourceFactIds: [] }] };
    expect(checkTruthfulness(r, facts)).toEqual([{ kind: "unsourced-claim", text: "Led a team of 20" }]);
  });

  it("flags a claim citing a fact that does not exist", () => {
    const r = { ...base, bullets: [{ text: "Scaled to millions", sourceFactIds: ["f99"] }] };
    expect(checkTruthfulness(r, facts)).toEqual([
      { kind: "unknown-fact-id", text: "Scaled to millions", factId: "f99" },
    ]);
  });

  it("flags a skill the user never claimed", () => {
    const r = { ...base, skills: [...base.skills, "Kubernetes"] };
    expect(checkTruthfulness(r, facts)).toEqual([{ kind: "unsupported-skill", skill: "Kubernetes" }]);
  });
});
