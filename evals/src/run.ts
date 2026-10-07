import { readFileSync } from "node:fs";

// Eval runner. The golden dataset and tailoring pipeline land in the next PR;
// until then this fails loudly instead of passing on an empty dataset.
const thresholds = JSON.parse(readFileSync(new URL("../thresholds.json", import.meta.url), "utf8"));
console.log("Thresholds:", thresholds);
console.error("No golden dataset yet (evals/golden/). Evals are not wired into CI until it exists.");
process.exit(1);
