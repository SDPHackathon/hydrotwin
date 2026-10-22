// v3 scene 5 — the live dashboard through the whole demo storm at the app's 4× playback.
// Samples the storm clock and the three street counts every 250 ms so the edit can cut
// and place callouts on real values. Writes public/rec/r-dashboard.mp4 + r-dashboard.json.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, capture, LAPTOP, APP, OUT, wait } from "./rig.mjs";

const browser = await launch();
const page = await (await browser.newContext(LAPTOP)).newPage();
await page.goto(APP + "/");
await page.getByRole("button", { name: "Start storm" }).waitFor();
await wait(5000); // map tiles, buildings and drain markers paint

const read = () =>
  page.evaluate(() => {
    const text = document.body.innerText;
    const num = (label) => Number((text.match(new RegExp(`${label}\\s*\\n?\\s*(\\d+)`, "i")) ?? [])[1] ?? NaN);
    const clock = (text.match(/(\d\d):(\d\d)\s*\/\s*03:30/) ?? []).slice(1).map(Number);
    return { minute: clock.length ? clock[0] * 60 + clock[1] : NaN, flooded: num("Flooded streets"), atRisk: num("At risk streets"), clear: num("Clear streets") };
  });

const d08 = await page.getByText("D08", { exact: true }).first().boundingBox().catch(() => null);
const stop = await capture(page, "r-dashboard");
const t0 = Date.now();
const since = () => +((Date.now() - t0) / 1000).toFixed(2);
const marks = { d08, samples: [] };

await wait(1500);
await page.getByRole("button", { name: "4×" }).click();
await wait(500);
await page.getByRole("button", { name: "Start storm" }).click();
marks.start = since();
for (;;) {
  const s = { t: since(), ...(await read()) };
  marks.samples.push(s);
  if (marks.firstFlood === undefined && s.flooded > 0) marks.firstFlood = s.t;
  if (s.minute >= 210 || since() > 90) break;
  await wait(250);
}
await wait(2500);
marks.end = since();

await stop();
writeFileSync(join(OUT, "r-dashboard.json"), JSON.stringify(marks, null, 1));
const peak = marks.samples.reduce((a, s) => (s.flooded > a.flooded ? s : a), marks.samples[0]);
console.log({ start: marks.start, firstFlood: marks.firstFlood, peak, end: marks.end, d08 });
await browser.close();
