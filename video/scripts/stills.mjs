// Check frames quickly: bundle once, render several stills.
//   node scripts/stills.mjs <outDir> V01-Flood:110 V02-Problem:560 …   (frame or 12.5s)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [out, ...specs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browserExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const serveUrl = await bundle({ entryPoint: join(here, "../src/index.ts") });
const comps = {};
for (const spec of specs) {
  const [id, at] = spec.split(":");
  comps[id] ??= await selectComposition({ serveUrl, id, browserExecutable });
  const comp = comps[id];
  const frame = Math.min(comp.durationInFrames - 1, at.endsWith("s") ? Math.round(parseFloat(at) * comp.fps) : Number(at));
  const output = join(out, `${id}-${frame}.png`);
  await renderStill({ serveUrl, composition: comp, frame, output, browserExecutable, imageFormat: "png" });
  console.log(`${output} (of ${comp.durationInFrames})`);
}
