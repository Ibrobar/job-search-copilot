import { describe, expect, it } from "vitest";
import type { Requirement } from "./schemas";
import { fitScore, matchBand } from "./score";

describe("matchBand", () => {
  it.each([
    [100, "Great Match"],
    [80, "Great Match"],
    [79, "Ok Match"],
    [60, "Ok Match"],
    [59, "Not a Match"],
    [0, "Not a Match"],
  ] as const)("%i -> %s", (score, band) => {
    expect(matchBand(score)).toBe(band);
  });
});

const req = (importance: Requirement["importance"], coverage: Requirement["coverage"]): Requirement => ({
  name: "x",
  importance,
  coverage,
  sourceFactIds: [],
});

describe("fitScore", () => {
  it("is 0 with no requirements", () => {
    expect(fitScore([])).toBe(0);
  });

  it("weights core twice as much as nice-to-have", () => {
    // core full (2) + nice none (0) of 3 -> 67
    expect(fitScore([req("core", "full"), req("nice", "none")])).toBe(67);
    // core none (0) + nice full (1) of 3 -> 33
    expect(fitScore([req("core", "none"), req("nice", "full")])).toBe(33);
  });

  it("gives half credit for partial coverage", () => {
    expect(fitScore([req("core", "partial"), req("core", "full")])).toBe(75);
  });
});
