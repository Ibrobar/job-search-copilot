import { readFileSync, writeFileSync } from "node:fs";

// One-time import of the scraper's labeling export into the golden set.
// Usage: tsx src/import-jobs.ts ../../resume-tailoring/build/labeling_set.json
// Links are dropped on purpose: the golden set keeps only what the pipeline reads.

type ExportedJob = { id: string; source: string; company: string; title: string; jd: string };
export type GoldenJob = { id: string; source: string; company: string; title: string; jd: string };

const src = process.argv[2];
if (!src) throw new Error("Pass the path to labeling_set.json");

const out = new URL("../golden/jobs.json", import.meta.url);
const jobs: GoldenJob[] = (JSON.parse(readFileSync(src, "utf8")) as ExportedJob[]).map((j) => ({
  id: j.id,
  source: j.source,
  company: j.company,
  title: j.title,
  jd: j.jd.replace(/\\([-*_#.()[\]!])/g, "$1"), // undo JobSpy's Markdown escapes ("\-")
}));
writeFileSync(out, JSON.stringify(jobs, null, 2) + "\n");
console.log(`Wrote ${jobs.length} jobs to evals/golden/jobs.json`);
