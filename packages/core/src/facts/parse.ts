import type { Fact } from "../schemas";
import { skillVariants } from "../truthfulness";

export type ParsedFacts = {
  facts: Fact[];
  /** Instructions found in the file ("do not claim X"). Passed to the model as constraints, never cited. */
  rules: string[];
};

const SECTION_MAP: [RegExp, Fact["section"]][] = [
  [/summary/i, "summary"],
  [/experience|legacy|employment|work history/i, "experience"],
  [/project/i, "project"],
  [/skill/i, "skill"],
  [/education/i, "education"],
  [/certific/i, "certification"],
];

const RULE_I = /\b(do not|don't|never|must not)\b|^FRAMING\b|^note:/i;
const RULE_CAPS = /\bNOT\b/;
const isRule = (s: string) => RULE_I.test(s) || RULE_CAPS.test(s);
const ABBREVIATION = /(?:\b(?:[A-Z]\.){2,}|\b(?:e\.g|i\.e|etc|vs|Jr|Sr|Dr|Mr|Ms|Inc|Co|No)\.)$/;
const ANNOTATION =/\s*\((?:confirmed|updated|added)[^)]*\)/gi;

/**
 * Turns a BASE_FACTS.md-style document into atomic facts. Sections are `## ` headings; entries are
 * `- ` bullets (indented lines continue the bullet) or plain paragraphs. Each sentence of an entry
 * becomes one fact so retrieval and citations stay fine-grained. Unknown sections (Contact) are skipped.
 */
export function parseFacts(markdown: string): ParsedFacts {
  const entries: { section: Fact["section"]; text: string }[] = [];
  let section: Fact["section"] | null = null;
  let current: string[] | null = null;
  const flush = () => {
    if (section && current?.length) entries.push({ section, text: current.join(" ").replace(/\s+/g, " ").trim() });
    current = null;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const heading = raw.match(/^##\s+(.*)/);
    if (heading) {
      flush();
      section = SECTION_MAP.find(([re]) => re.test(heading[1]!))?.[1] ?? null;
      continue;
    }
    if (/^#\s/.test(raw)) continue;
    if (!raw.trim()) {
      flush();
      continue;
    }
    if (/^- /.test(raw)) {
      flush();
      current = [raw.slice(2)];
    } else {
      (current ??= []).push(raw.trim());
    }
  }
  flush();

  const facts: Fact[] = [];
  const rules: string[] = [];
  const counters = new Map<string, number>();
  const nextId = (s: Fact["section"]) => {
    const n = (counters.get(s) ?? 0) + 1;
    counters.set(s, n);
    return `${s}-${n}`;
  };

  for (const e of entries) {
    if (/^\[REMOVED/i.test(e.text)) continue;
    if (/^\(.*\)$/.test(e.text) || RULE_I.test(e.text.slice(0, 12))) {
      rules.push(stripParens(e.text));
      continue;
    }
    if (e.section === "skill") {
      const [category, list] = splitOnce(e.text, ":");
      const skills = (list ?? category).split(",").map((s) => s.trim()).filter(Boolean);
      facts.push({ id: nextId("skill"), section: "skill", text: e.text, skills, context: list ? category : undefined });
      continue;
    }

    const sentences = splitSentences(e.text.replace(ANNOTATION, ""));
    // The first sentence of a role or project is its header ("Engineer, Acme -- 2024 to 2025 -- Remote").
    const header = e.section === "experience" || e.section === "project" ? sentences[0] : undefined;
    const addRule = (r: string) => rules.push(header ? `${header.replace(/\.$/, "")}: ${r}` : r);
    for (const raw of sentences) {
      // An instruction in parentheses inside a fact ("Chrome extension (NEVER say millions), ...")
      // becomes a rule; the rest of the sentence stays a citable fact.
      const s = raw.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => (isRule(inner) ? (addRule(inner.trim()), "") : m)).trim();
      if (!s || /^[.,;]$/.test(s)) continue;
      if (isRule(s) || /^\(.*\)\.?$/.test(s)) {
        addRule(stripParens(s));
        continue;
      }
      facts.push({ id: nextId(e.section), section: e.section, text: s, skills: [], context: raw === header ? undefined : header });
    }
  }

  const vocab = facts.filter((f) => f.section === "skill").flatMap((f) => f.skills);
  for (const f of facts) {
    if (f.section !== "skill") f.skills = vocab.filter((skill) => mentions(`${f.context ?? ""} ${f.text}`, skill));
  }
  return { facts, rules };
}

function mentions(text: string, skill: string): boolean {
  return skillVariants(skill).some((v) => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i").test(text);
  });
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.split(/(?<=[.!?])\s+(?=[A-Z(])/)) {
    // Re-join after abbreviations so "U.S. Citizen" and "e.g. React" stay whole.
    if (out.length && ABBREVIATION.test(out[out.length - 1]!)) out[out.length - 1] += ` ${piece}`;
    else out.push(piece);
  }
  return out.map((s) => s.trim()).filter((s) => s.length > 1);
}

function splitOnce(s: string, sep: string): [string, string | undefined] {
  const i = s.indexOf(sep);
  return i < 0 ? [s, undefined] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

function stripParens(s: string): string {
  return s.replace(/^\((.*)\)\.?$/, "$1").trim();
}
