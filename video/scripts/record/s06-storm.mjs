// Scene 6 — the demo storm on the dashboard (Local Sim, 4×): D08 turns red first,
// then the water spreads street by street.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, capture, LAPTOP, APP, OUT, wait } from "./rig.mjs";

const browser = await launch();
const page = await (await browser.newContext(LAPTOP)).newPage();
await page.goto(APP + "/");
await page.waitForSelector(".maplibregl-canvas");
await wait(6000); // base map tiles + 3D buildings

const stop = await capture(page, "s06-storm");
const t0 = Date.now();
const marks = {};
const mark = (k) => (marks[k] = +((Date.now() - t0) / 1000).toFixed(2));

await wait(1500);
await page.getByRole("button", { name: "Start storm", exact: true }).click();
await page.getByRole("button", { name: "4×", exact: true }).click();
mark("start");
await page.getByText(/Overflowing ·/).first().waitFor({ timeout: 90_000 });
mark("firstRed");
await wait(10_000); // the spread, to about minute 130
mark("end");
await stop();
writeFileSync(join(OUT, "s06-storm.json"), JSON.stringify(marks, null, 2));
console.log(marks);
await browser.close();
