// Deterministic export of simulation-derived road points. Does not modify flood data.
import { readFile, writeFile } from "node:fs/promises";
import { buildDemoRefuges } from "../lib/engine/demo-refuges.ts";
import { parseCatalogue } from "../lib/engine/evacuation.ts";
const slug = process.argv[2] ?? "bukit-raja";
if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new Error("Invalid area slug");
const folder = new URL(`../public/data/${slug}/`, import.meta.url);
const streets = JSON.parse(await readFile(new URL("streets.geojson", folder), "utf8")).features;
const drains = JSON.parse(await readFile(new URL("drains.json", folder), "utf8"));
const catalogue = parseCatalogue(buildDemoRefuges(slug, streets, drains), streets, slug);
await writeFile(new URL("evacuation-destinations.json", folder), JSON.stringify(catalogue, null, 2) + "\n");
console.log(`Prepared ${catalogue.destinations.length} simulation-selected road points for ${slug}`);
