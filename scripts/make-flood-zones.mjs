// Builds the water-slab footprints from streets.geojson → flood-zones.geojson.
//   node scripts/make-flood-zones.mjs [--slug=<area>]
// Two bands per drain zone: "road" (water on the street) and "yard" (water spreading
// toward the houses). Each band is one MultiPolygon of square-capped rectangles around
// every street segment — no geometry library needed; overlaps render fine as one layer.

import { readdir, readFile, writeFile } from "node:fs/promises";

const argSlug = process.argv.slice(2).find((a) => a.startsWith("--slug="))?.split("=")[1];
const BANDS = { road: 6, yard: 24 }; // half-width in metres
const round = (n) => Math.round(n * 1e6) / 1e6;

function rectangle([lng1, lat1], [lng2, lat2], w, M_PER_DEG_LNG, M_PER_DEG_LAT) {
  const dx = (lng2 - lng1) * M_PER_DEG_LNG;
  const dy = (lat2 - lat1) * M_PER_DEG_LAT;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const [ux, uy] = [dx / len, dy / len]; // along the street
  const [nx, ny] = [-uy, ux]; // across the street
  const at = ([lng, lat], along, across) => [
    round(lng + (ux * along + nx * across) / M_PER_DEG_LNG),
    round(lat + (uy * along + ny * across) / M_PER_DEG_LAT),
  ];
  const a = [lng1, lat1];
  const b = [lng2, lat2];
  // Counter-clockwise, closed. Every ring must wind the same way or MapLibre reads some as holes.
  return [[at(a, -w, -w), at(b, w, -w), at(b, w, w), at(a, -w, w), at(a, -w, -w)]];
}

async function processArea(slug) {
  const dir = new URL(`../public/data/${slug}/`, import.meta.url);
  let streets;
  try {
    streets = JSON.parse(await readFile(new URL("streets.geojson", dir), "utf8"));
  } catch {
    return;
  }
  if (!streets.features || streets.features.length === 0) return;

  const lat0 = streets.features[0].geometry.coordinates[0][1];
  const M_PER_DEG_LAT = 110574;
  const M_PER_DEG_LNG = 111320 * Math.cos((lat0 * Math.PI) / 180);

  const zones = new Map(); // `${drain}-${band}` → polygons
  for (const f of streets.features) {
    const pts = f.geometry.coordinates;
    for (const [band, w] of Object.entries(BANDS)) {
      const key = `${f.properties.drain_id}-${band}`;
      if (!zones.has(key)) zones.set(key, []);
      for (let i = 0; i < pts.length - 1; i++) {
        const r = rectangle(pts[i], pts[i + 1], w, M_PER_DEG_LNG, M_PER_DEG_LAT);
        if (r) zones.get(key).push(r);
      }
    }
  }

  const fc = {
    type: "FeatureCollection",
    features: [...zones].map(([id, polygons]) => {
      const [drain_id, band] = id.split("-");
      return { type: "Feature", properties: { id, drain_id, band }, geometry: { type: "MultiPolygon", coordinates: polygons } };
    }),
  };

  await writeFile(new URL("flood-zones.geojson", dir), JSON.stringify(fc));
  console.log(`[${slug}] flood-zones.geojson: ${fc.features.length} features, ${[...zones.values()].reduce((n, p) => n + p.length, 0)} rectangles`);
}

async function main() {
  if (argSlug) {
    await processArea(argSlug);
  } else {
    const dataDir = new URL("../public/data/", import.meta.url);
    const entries = await readdir(dataDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) await processArea(e.name);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
