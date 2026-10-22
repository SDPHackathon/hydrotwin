// Builds the township data the app loads from public/data/bukit-raja/.
//   node scripts/fetch-data.mjs
// Sources: OpenStreetMap via Overpass (ODbL), elevation via Open-Meteo (CC BY 4.0).
// Re-run only when you change the area or the drain count, then commit the output.

import { mkdir, writeFile } from "node:fs/promises";

const PRESETS = {
  "bukit-raja": {
    slug: "bukit-raja",
    name: "Bandar Bukit Raja, Klang",
    // south, west, north, east
    bbox: [3.0795, 101.4320, 3.0935, 101.4465],
  },
  "taman-sri-muda": {
    slug: "taman-sri-muda",
    name: "Taman Sri Muda, Shah Alam",
    bbox: [3.0250, 101.5280, 3.0390, 101.5420],
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  let preset = "bukit-raja";
  let slug = "";
  let name = "";
  let bbox = null;

  for (const arg of args) {
    if (arg.startsWith("--preset=")) preset = arg.split("=")[1];
    if (arg.startsWith("--slug=")) slug = arg.split("=")[1];
    if (arg.startsWith("--name=")) name = arg.split("=")[1];
    if (arg.startsWith("--bbox=")) bbox = arg.split("=")[1].split(",").map(Number);
  }

  if (slug && name && bbox && bbox.length === 4) {
    return { slug, name, bbox };
  }
  return PRESETS[preset] || PRESETS["bukit-raja"];
}

const AREA = parseArgs();
const DRAIN_COUNT = 10;
const UA = "hydrotwin/0.1 (SDP University Hackathon 2026 prototype)";
const OUT = new URL(`../public/data/${AREA.slug}/`, import.meta.url);

const ROAD_CLASSES = "primary|secondary|tertiary|residential|unclassified|living_street";

const OVERPASS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function overpass(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of OVERPASS) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
      }).catch((err) => ({ ok: false, status: err.message, text: async () => "" }));
      if (res.ok) return res.json();
      console.warn(`  ${new URL(url).host} → ${res.status}, retrying…`);
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error("Overpass unavailable — try again in a few minutes");
}

const round = (n) => Math.round(n * 1e6) / 1e6;
const coords = (way) => way.geometry.map((p) => [round(p.lon), round(p.lat)]);

function centroid(points) {
  const sum = points.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

// Plain k-means on street centroids. Deterministic: seeds are spread along the sorted list.
function kmeans(points, k, rounds = 25) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let centres = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / k)]);
  let assign = [];
  for (let r = 0; r < rounds; r++) {
    assign = points.map((p) => {
      let best = 0;
      centres.forEach((c, i) => {
        if (dist2(p, c) < dist2(p, centres[best])) best = i;
      });
      return best;
    });
    centres = centres.map((c, i) => {
      const members = points.filter((_, j) => assign[j] === i);
      return members.length ? centroid(members) : c;
    });
  }
  return { centres, assign };
}

function buildingHeight(tags) {
  if (tags.height && !Number.isNaN(parseFloat(tags.height))) return parseFloat(tags.height);
  if (tags["building:levels"]) return parseFloat(tags["building:levels"]) * 3.2;
  return 7; // most of the area is 2-storey terrace houses; OSM rarely has heights here
}

async function main() {
  const [s, w, n, e] = AREA.bbox;
  const box = `${s},${w},${n},${e}`;
  console.log("Overpass: roads + buildings…");
  const osm = await overpass(
    `[out:json][timeout:60];(way["highway"~"^(${ROAD_CLASSES})$"](${box});way["building"](${box}););out geom;`,
  );

  const roads = osm.elements.filter((el) => el.tags?.highway);
  const buildings = osm.elements.filter((el) => el.tags?.building && el.geometry?.length > 3);

  const roadCentres = roads.map((r) => centroid(coords(r)));
  const { centres, assign } = kmeans(roadCentres, DRAIN_COUNT);

  // Order drains west→east, north→south so the ids read naturally on the map.
  const order = centres
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c[1] - a.c[1] || a.c[0] - b.c[0])
    .map((x) => x.i);
  const drainId = (cluster) => `D${String(order.indexOf(cluster) + 1).padStart(2, "0")}`;

  console.log("Open-Meteo: drain elevations…");
  const lat = centres.map((c) => round(c[1])).join(",");
  const lon = centres.map((c) => round(c[0])).join(",");
  const elevRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, {
    headers: { "User-Agent": UA },
  });
  if (!elevRes.ok) throw new Error(`Open-Meteo ${elevRes.status}`);
  const { elevation } = await elevRes.json();

  // Run-off reaching each drain: ground height decides (lowest 1.6, highest 0.8) and the zone's
  // size (street count ≈ paved area) adds up to ±0.1, which breaks ties between equal heights.
  const minE = Math.min(...elevation);
  const maxE = Math.max(...elevation);
  const lowness = (h) => (maxE === minE ? 0.5 : (maxE - h) / (maxE - minE));
  const sizes = centres.map((_, i) => assign.filter((a) => a === i).length);
  const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const sizeSpan = Math.max(...sizes) - Math.min(...sizes) || 1;
  const catchment = (i) => 0.8 + 0.8 * lowness(elevation[i]) + (0.2 * (sizes[i] - meanSize)) / sizeSpan;

  const drains = centres
    .map((c, i) => ({
      id: drainId(i),
      name: `Drain ${drainId(i)}`,
      lng: round(c[0]),
      lat: round(c[1]),
      elevation_m: elevation[i],
      bank_cm: 120,
      catchment_factor: Math.round(catchment(i) * 100) / 100,
      outflow_cm_per_min: 1.2,
      streets: sizes[i],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const streets = {
    type: "FeatureCollection",
    features: roads.map((r, j) => ({
      type: "Feature",
      properties: {
        id: `w${r.id}`,
        name: r.tags.name ?? null,
        highway: r.tags.highway,
        drain_id: drainId(assign[j]),
      },
      geometry: { type: "LineString", coordinates: coords(r) },
    })),
  };

  const buildingFc = {
    type: "FeatureCollection",
    features: buildings.map((b) => ({
      type: "Feature",
      properties: { id: `w${b.id}`, height: buildingHeight(b.tags) },
      geometry: { type: "Polygon", coordinates: [coords(b)] },
    })),
  };

  const meta = {
    ...AREA,
    center: [round((w + e) / 2), round((s + n) / 2)],
    generated_at: new Date().toISOString(),
    osm_timestamp: osm.osm3s?.timestamp_osm_base ?? null,
    attribution: "© OpenStreetMap contributors (ODbL) · Elevation: Open-Meteo (CC BY 4.0)",
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(new URL("streets.geojson", OUT), JSON.stringify(streets));
  await writeFile(new URL("buildings.geojson", OUT), JSON.stringify(buildingFc));
  await writeFile(new URL("drains.json", OUT), JSON.stringify(drains, null, 2) + "\n");
  await writeFile(new URL("area.json", OUT), JSON.stringify(meta, null, 2) + "\n");

  console.log(`streets ${streets.features.length} · buildings ${buildingFc.features.length} · drains ${drains.length}`);
  console.table(drains.map(({ id, elevation_m, catchment_factor, streets }) => ({ id, elevation_m, catchment_factor, streets })));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
