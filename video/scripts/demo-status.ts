// Runs the app's real engine (lib/engine) over the demo storm and prints when each drain zone
// first turns amber and red. Scene 5 shows these statuses — re-run if the engine changes:
//   node --experimental-strip-types scripts/demo-status.ts
import { readFileSync } from "node:fs";
import { rainAt, STORM_MINUTES } from "../../lib/engine/storm.ts";
import { stepLevel } from "../../lib/engine/sim.ts";
import { assess } from "../../lib/engine/risk.ts";
const drains = JSON.parse(readFileSync(new URL("../../public/data/bukit-raja/drains.json", import.meta.url), "utf8"));
const level: Record<string, number> = {}; const hist: Record<string, number[]> = {};
for (const d of drains) { level[d.id] = 0; hist[d.id] = [0]; }
const firstRed: Record<string, number> = {}; const firstAmber: Record<string, number> = {};
for (let m = 1; m <= STORM_MINUTES; m++) {
  for (const d of drains) {
    level[d.id] = stepLevel(d, level[d.id], rainAt(m)); hist[d.id].push(level[d.id]);
    const st = assess(d, hist[d.id]);
    if (st.status === "amber" && !(d.id in firstAmber)) firstAmber[d.id] = m;
    if (st.status === "red" && !(d.id in firstRed)) firstRed[d.id] = m;
  }
}
console.log("first amber:", JSON.stringify(firstAmber));
console.log("first red:  ", JSON.stringify(firstRed));
