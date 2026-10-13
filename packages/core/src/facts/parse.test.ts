import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFacts } from "./parse";

const md = readFileSync(new URL("./__fixtures__/base_facts.md", import.meta.url), "utf8");
const { facts, rules } = parseFacts(md);
const byText = (t: string) => facts.find((f) => f.text.includes(t));

describe("parseFacts", () => {
  it("skips unknown sections and removed entries", () => {
    expect(byText("jane@example.com")).toBeUndefined();
    expect(byText("Old Project")).toBeUndefined();
  });

  it("splits entries into sentence facts with stable ids and the role as context", () => {
    const api = byText("Built a REST API");
    expect(api).toMatchObject({
      id: "experience-2",
      section: "experience",
      context: "Software Engineer, Acme Corp -- Jan 2024 to Present -- Remote.",
    });
    expect(api?.text).not.toContain("confirmed by");
  });

  it("keeps abbreviations like U.S. inside one fact", () => {
    expect(byText("State University")?.text).toContain("U.S. 2020");
  });

  it("turns instructions into rules, not facts", () => {
    expect(byText("Kubernetes")).toBeUndefined();
    expect(byText("NOT built")).toBeUndefined();
    expect(rules).toEqual([
      "Tailored summaries stay in this voice.",
      "Software Engineer, Acme Corp -- Jan 2024 to Present -- Remote: describe as 500+ users, NEVER thousands",
      "Software Engineer, Acme Corp -- Jan 2024 to Present -- Remote: Do not claim Kubernetes.",
      "Budget App -- 2023: A mobile version is NOT built.",
    ]);
  });

  it("keeps the fact when only a parenthetical inside it is an instruction", () => {
    expect(byText("Chrome extension")?.text).toBe("Chrome extension, React dashboard.");
  });

  it("makes one fact per skill category and tags other facts with the skills they mention", () => {
    expect(facts.filter((f) => f.section === "skill").map((f) => f.skills)).toEqual([
      ["TypeScript", "JavaScript (ES6+)", "SQL"],
      ["Node.js", "Next.js", "PostgreSQL", "Azure", "Linux/UNIX"],
    ]);
    expect(byText("Budget App")?.skills).toEqual([]);
    expect(byText("Next.js app with PostgreSQL")?.skills).toEqual(["Next.js", "PostgreSQL"]);
    expect(byText("Built a REST API")?.skills).toEqual(["Node.js"]);
  });
});
