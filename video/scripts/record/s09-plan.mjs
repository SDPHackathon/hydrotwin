// Scene 9 — Plan mode: add four upgrades (ponds at D08 and D07, bigger drains at D05 and
// D06), watch the before/after numbers change, then replay the same storm with them.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, capture, LAPTOP, APP, OUT, wait } from "./rig.mjs";

const UPGRADES = [
  ["D08", "retention_pond"],
  ["D07", "retention_pond"],
  ["D05", "bigger_drain"],
  ["D06", "bigger_drain"],
];

const browser = await launch();
const page = await (await browser.newContext(LAPTOP)).newPage();
await page.goto(APP + "/");
await page.waitForSelector(".maplibregl-canvas");
await wait(6000);

const stop = await capture(page, "s09-plan");
const t0 = Date.now();
const marks = {};
const mark = (k) => (marks[k] = +((Date.now() - t0) / 1000).toFixed(2));

await wait(1000);
await page.getByRole("button", { name: "Plan Mode" }).click();
mark("plan");
await wait(2500);
const add = page.locator("section", { hasText: "Add Civil Intervention" }).last();
for (const [drain, kind] of UPGRADES) {
  await add.locator("select").nth(0).selectOption(drain);
  await wait(400);
  await add.locator("select").nth(1).selectOption(kind);
  await wait(400);
  await add.getByRole("button", { name: /Apply Intervention to/ }).click();
  mark(`${drain}-${kind}`);
  await wait(1600);
}
const impact = await page.locator("section", { hasText: "Before vs After Impact" }).last().innerText();
await wait(1500);
await page.getByRole("button", { name: /Play Storm with Upgrades/ }).click();
await page.getByRole("button", { name: "4×", exact: true }).click();
mark("replay");
await wait(32_000); // to about minute 125 — the edit fast-forwards this part
mark("end");
await stop();
writeFileSync(join(OUT, "s09-plan.json"), JSON.stringify({ ...marks, impact }, null, 2));
console.log(marks, "\n", impact);
await browser.close();
