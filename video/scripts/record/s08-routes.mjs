// Scene 8 — Safe Routes mid-storm: a walking route from a dry street to the nearest
// safe point; when that path floods, the route switches to the next safe point.
// The two safe points are demo destinations (the app keeps them in localStorage).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, capture, LAPTOP, APP, OUT, wait } from "./rig.mjs";

const ORIGIN = "w163052669"; // Persiaran Batu Belah (D04) — stays out of the red in the demo storm

const browser = await launch();
const ctx = await browser.newContext(LAPTOP);
await ctx.addInitScript(() =>
  localStorage.setItem(
    "hydrotwin_destinations_bukit-raja",
    JSON.stringify([
      { id: "dest-gamelan", name: "Assembly point Gamelan", street_id: "w767416157", kind: "demo" },
      { id: "dest-sumazau", name: "Assembly point Sumazau", street_id: "w949578801", kind: "demo" },
    ]),
  ),
);
const page = await ctx.newPage();
await page.goto(APP + "/");
await page.waitForSelector(".maplibregl-canvas");
await wait(6000);

await page.getByRole("button", { name: "Safe Routes" }).click();
await page.getByLabel("Starting street").selectOption(ORIGIN);
await wait(2500);
// Run the storm from Live Warning, then come back (the storm keeps running across tabs).
await page.getByRole("button", { name: "Live Warning" }).click();
await page.getByRole("button", { name: "Start storm", exact: true }).click();
await page.getByRole("button", { name: "4×", exact: true }).click();
// Fast-forward to minute 84, then slow to 1×: D08 floods at ~91 and blocks the first route.
const stormBox = page.locator("section", { hasText: "Storm time" }).first();
const minute = async () => {
  const m = (await stormBox.innerText()).match(/(\d{2}):(\d{2})\s*\/\s*03:00/);
  if (!m) throw new Error("storm clock not found");
  return Number(m[1]) * 60 + Number(m[2]);
};
while ((await minute()) < 84) await wait(150);
await page.getByRole("button", { name: "1×", exact: true }).click();
console.log("slowed at minute", await minute());
await page.getByRole("button", { name: "Safe Routes" }).click();
await wait(1500);

const stop = await capture(page, "s08-routes");
const t0 = Date.now();
const marks = {};
const mark = (k) => (marks[k] = +((Date.now() - t0) / 1000).toFixed(2));
const result = page.locator('section[aria-live="polite"]');
await result.getByText("Assembly point Gamelan").first().waitFor();
mark("routeGamelan");
await result.getByText("Assembly point Sumazau").first().waitFor({ timeout: 60_000 });
mark("rerouted");
await wait(3000);
mark("end");
await stop();
writeFileSync(join(OUT, "s08-routes.json"), JSON.stringify(marks, null, 2));
console.log(marks, await result.innerText());
await browser.close();
