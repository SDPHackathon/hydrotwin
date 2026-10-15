// MapLibre v6 loads its web worker from a URL next to the library file, which a bundler
// moves. We serve the worker from /public instead (see setWorkerUrl in TownshipMap.tsx).
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFile, mkdir } from "node:fs/promises";

const src = new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url);
const dir = new URL("../public/maplibre/", import.meta.url);
await mkdir(dir, { recursive: true });
await copyFile(src, new URL("maplibre-gl-worker.mjs", dir));
