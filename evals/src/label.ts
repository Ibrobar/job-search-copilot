import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { GoldenJob } from "./import-jobs";

// Local labeling tool for the golden set. Run: pnpm --filter @jsc/evals label
// Shows each job description and saves your fit score to golden/labels.json.
// Model scores are never shown here, so they can't anchor the labels.

export type Label = { score: number; note: string; labeledAt: string };

const JOBS = new URL("../golden/jobs.json", import.meta.url);
const LABELS = new URL("../golden/labels.json", import.meta.url);
const PORT = Number(process.env.PORT ?? 4317);

const jobs: GoldenJob[] = JSON.parse(readFileSync(JOBS, "utf8"));
const labels: Record<string, Label> = existsSync(LABELS) ? JSON.parse(readFileSync(LABELS, "utf8")) : {};

function save() {
  // Keep labels in job order so diffs stay readable.
  const ordered = Object.fromEntries(jobs.filter((j) => labels[j.id]).map((j) => [j.id, labels[j.id]]));
  writeFileSync(LABELS, JSON.stringify(ordered, null, 2) + "\n");
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
  } else if (req.method === "GET" && req.url === "/api/data") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jobs, labels }));
  } else if (req.method === "POST" && req.url === "/api/label") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { id, score, note } = JSON.parse(body) as { id: string; score: number | null; note: string };
      if (!jobs.some((j) => j.id === id)) return res.writeHead(404).end();
      if (score === null) delete labels[id];
      else if (!Number.isInteger(score) || score < 0 || score > 100) return res.writeHead(400).end("score must be 0-100");
      else labels[id] = { score, note: note.trim(), labeledAt: new Date().toISOString() };
      save();
      res.writeHead(204).end();
    });
  } else {
    res.writeHead(404).end();
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Labeling ${jobs.length} jobs (${Object.keys(labels).length} done) -> http://localhost:${PORT}`);
});

const PAGE = /* html */ `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Label golden set</title>
<style>
:root { --bg:#f6f7f9; --panel:#fff; --fg:#172030; --muted:#5a6577; --line:#d9dee6; --accent:#1f5fbf;
  --good:#1d7a4c; --ok:#9a6200; --bad:#b3362b; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg:#10141b; --panel:#171d27; --fg:#e5e9f0; --muted:#98a3b5; --line:#2a3342;
  --accent:#7aa7ff; --good:#5fcf97; --ok:#f0b64f; --bad:#ff8a7f; } }
* { box-sizing: border-box; }
body { margin:0; font:15px/1.55 "Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--fg);
  display:grid; grid-template-columns: 300px 1fr; height:100vh; }
nav { border-right:1px solid var(--line); overflow-y:auto; background:var(--panel); }
nav header { padding:14px 16px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--panel); }
nav button { all:unset; display:flex; gap:10px; align-items:center; width:100%; padding:8px 16px; cursor:pointer; font-size:13px; box-sizing:border-box; }
nav button:hover, nav button.on { background:color-mix(in srgb, var(--accent) 12%, transparent); }
nav button:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
nav .s { width:34px; text-align:right; font:600 12px ui-monospace, Consolas, monospace; color:var(--muted); flex:none; }
nav .t { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
main { display:flex; flex-direction:column; min-width:0; }
.head { padding:16px 24px; border-bottom:1px solid var(--line); }
.head h1 { margin:0; font-size:20px; }
.head p { margin:2px 0 0; color:var(--muted); font-size:13px; }
.jd { flex:1; overflow-y:auto; padding:20px 24px; white-space:pre-wrap; max-width:80ch; }
form { border-top:1px solid var(--line); background:var(--panel); padding:14px 24px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
input[type=number] { width:80px; font-size:20px; padding:4px 8px; }
input[type=text] { flex:1; min-width:200px; padding:8px; }
.band { font-weight:600; width:110px; }
form button { padding:8px 14px; cursor:pointer; }
.rubric { font-size:12px; color:var(--muted); width:100%; }
.progress { font-size:12px; color:var(--muted); }
</style></head><body>
<nav><header><strong>Golden set</strong><div class="progress" id="progress"></div></header><div id="list"></div></nav>
<main>
  <div class="head"><h1 id="title"></h1><p id="meta"></p></div>
  <div class="jd" id="jd"></div>
  <form id="f">
    <label for="score">Fit</label>
    <input id="score" type="number" min="0" max="100" required>
    <span class="band" id="band"></span>
    <input id="note" type="text" placeholder="Note (optional): main gaps, why">
    <button type="submit">Save &amp; next (Ctrl+Enter)</button>
    <button type="button" id="clear">Clear</button>
    <div class="rubric">How well do <em>your real facts</em> cover this job's must-haves? Core requirements count double, partial counts half.
      80-100 Great · 60-79 Ok · 0-59 Not a Match. Judge the raw fit, not how good a tailored resume could look.</div>
  </form>
</main>
<script>
let jobs = [], labels = {}, i = 0;
const $ = (id) => document.getElementById(id);
const band = (s) => s >= 80 ? ["Great Match", "var(--good)"] : s >= 60 ? ["Ok Match", "var(--ok)"] : ["Not a Match", "var(--bad)"];
const clean = (t) => t.replace(/\\*\\*/g, "").replace(/^=+$/gm, "").replace(/\\n{3,}/g, "\\n\\n");

function render() {
  const j = jobs[i], l = labels[j.id];
  $("title").textContent = j.company + " - " + j.title;
  $("meta").textContent = (i + 1) + " of " + jobs.length + " · " + j.source + " · " + j.jd.length.toLocaleString() + " chars";
  $("jd").textContent = clean(j.jd); $("jd").scrollTop = 0;
  $("score").value = l ? l.score : ""; $("note").value = l ? l.note : "";
  showBand(); renderList(); $("score").focus();
}
function renderList() {
  $("list").replaceChildren(...jobs.map((j, k) => {
    const b = document.createElement("button"), l = labels[j.id];
    b.className = k === i ? "on" : "";
    b.innerHTML = '<span class="s"></span><span class="t"></span>';
    b.querySelector(".s").textContent = l ? l.score : "·";
    if (l) b.querySelector(".s").style.color = band(l.score)[1];
    b.querySelector(".t").textContent = j.company + " - " + j.title;
    b.onclick = () => { i = k; render(); };
    return b;
  }));
  $("progress").textContent = Object.keys(labels).length + " / " + jobs.length + " labeled";
}
function showBand() {
  const v = $("score").value;
  if (v === "") { $("band").textContent = ""; return; }
  const [name, color] = band(Number(v)); $("band").textContent = name; $("band").style.color = color;
}
async function post(score) {
  const id = jobs[i].id, note = $("note").value;
  const r = await fetch("/api/label", { method: "POST", body: JSON.stringify({ id, score, note }) });
  if (!r.ok) { alert(await r.text()); return false; }
  if (score === null) delete labels[id]; else labels[id] = { score, note };
  return true;
}
$("score").oninput = showBand;
$("f").onsubmit = async (e) => {
  e.preventDefault();
  if (!(await post(Number($("score").value)))) return;
  const next = jobs.findIndex((j, k) => k > i && !labels[j.id]);
  i = next >= 0 ? next : Math.min(i + 1, jobs.length - 1); render();
};
$("clear").onclick = async () => { if (await post(null)) render(); };
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") $("f").requestSubmit();
  if (e.altKey && e.key === "ArrowDown") { i = Math.min(i + 1, jobs.length - 1); render(); }
  if (e.altKey && e.key === "ArrowUp") { i = Math.max(i - 1, 0); render(); }
});
fetch("/api/data").then((r) => r.json()).then((d) => {
  jobs = d.jobs; labels = d.labels;
  const first = jobs.findIndex((j) => !labels[j.id]); i = first >= 0 ? first : 0; render();
});
</script></body></html>`;
