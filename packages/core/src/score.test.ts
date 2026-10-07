import { describe, expect, it } from "vitest";
import { matchBand } from "./score";

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
