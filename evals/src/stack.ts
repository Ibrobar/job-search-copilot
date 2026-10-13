// Which persona should win a job, decided from the JD text alone (no labels, no model).
// Personas are built with disjoint stacks, so a JD that clearly asks for one stack
// gives a known expected order: that stack's persona must outscore the others.

export type Stack = "web" | "java" | "data";

const PATTERNS: Record<Stack, RegExp[]> = {
  web: [/\breact\b/gi, /\btypescript\b/gi, /\bjavascript\b/gi, /\bnode(?:\.js)?\b/gi, /\bnext\.js\b/gi, /\bfront[- ]?end\b/gi, /\bhtml\b/gi, /\bcss\b/gi],
  java: [/\bjava\b(?!\s*script)/gi, /\bspring(?: boot)?\b/gi, /\bjvm\b/gi, /\bhibernate\b/gi, /\bmaven\b/gi, /\bkafka\b/gi],
  data: [/\bpython\b/gi, /\bpandas\b/gi, /\bpyspark\b|\bspark\b/gi, /\bairflow\b/gi, /\betl\b/gi, /\bdatabricks\b/gi, /\bsnowflake\b/gi, /\bdbt\b/gi, /\bmachine learning\b/gi],
};

export function stackHits(jd: string): Record<Stack, number> {
  const count = (res: RegExp[]) => res.reduce((n, re) => n + (jd.match(re)?.length ?? 0), 0);
  return { web: count(PATTERNS.web), java: count(PATTERNS.java), data: count(PATTERNS.data) };
}

/** The clearly favored stack, or null when the JD is mixed or too thin to call. */
export function favoredStack(jd: string, minHits = 4, minRatio = 2): Stack | null {
  const ranked = (Object.entries(stackHits(jd)) as [Stack, number][]).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || top[1] < minHits) return null;
  return top[1] >= minRatio * Math.max(second?.[1] ?? 0, 1) ? top[0] : null;
}
