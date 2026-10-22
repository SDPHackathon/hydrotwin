// v3 scene 8 — Plan mode: bigger drains at D05 + D06 (the deck's slide 6), then retention
// ponds at D08 + D07, reading the app's Before vs After after each step, then the replay.
// Writes public/rec/r-plan.mp4 + r-plan.json (marks, clicked boxes and the numbers as shown).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, capture, LAPTOP, APP, OUT, wait } from "./rig.mjs";

const browser = await launch();
const page = await (await browser.newContext(LAPTOP)).newPage();
await page.goto(APP + "/");
await page.getByRole("button", { name: "Start storm" }).waitFor();
await wait(5000);

const stop = await capture(page, "r-plan");
const t0 = Date.now();
const since = () => +((Date.now() - t0) / 1000).toFixed(2);
const marks = { clicks: [], impact: [] };
const mark = (k) => (marks[k] = since());
const click = async (loc, label) => {
  const b = await loc.boundingBox();
  marks.clicks.push({ label, t: since(), x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });
  await loc.click();
};
const impactBox = page.locator("section[aria-label='Before vs After Impact']");
const readImpact = async (step) => {
  const text = await impactBox.innerText();
  const n = (label) => (text.match(new RegExp(`${label}\\s*\\n\\s*(\\d+(?:\\.\\d+)?)\\s*\\n?\\s*(\\d+(?:\\.\\d+)?)`)) ?? []).slice(1).map(Number);
  marks.impact.push({ step, t: since(), flooded: n("Flooded Streets"), depth: n("Max Depth"), text });
};
const drainSelect = page.locator("select").filter({ has: page.locator("option[value='D05']") });
const kindSelect = page.locator("select").filter({ has: page.locator("option[value='bigger_drain']") });
const apply = async (drain, kind) => {
  await drainSelect.selectOption(drain);
  await wait(700);
  await kindSelect.selectOption(kind);
  await wait(700);
  await click(page.getByRole("button", { name: /Apply Intervention to/ }), `${kind} ${drain}`);
  await wait(1800);
};

await wait(1200);
await click(page.getByRole("button", { name: "Plan Mode" }), "Plan Mode");
mark("plan");
await wait(2500);
const ib = await impactBox.boundingBox();
marks.impactBox = ib && { x: Math.round(ib.x), y: Math.round(ib.y), w: Math.round(ib.width), h: Math.round(ib.height) };

await apply("D05", "bigger_drain");
await apply("D06", "bigger_drain");
await readImpact("bigger drains D05 + D06");
mark("drains");
await wait(2500);
await apply("D08", "retention_pond");
await apply("D07", "retention_pond");
await readImpact("+ ponds D08 + D07");
mark("ponds");
await wait(2500);

await click(page.getByRole("button", { name: "4×" }).filter({ visible: true }).last(), "4×");
await wait(400);
await click(page.getByRole("button", { name: /Play Storm with Upgrades/ }), "Play");
mark("replay");
await wait(30000);
mark("end");

await stop();
writeFileSync(join(OUT, "r-plan.json"), JSON.stringify(marks, null, 1));
console.log(JSON.stringify({ ...marks, impact: marks.impact.map(({ text, ...i }) => i) }, null, 1));
await browser.close();
