// Server-side generator pipeline for dynamic township extraction.
// Converts arbitrary bbox into complete HydroTwin model (streets, buildings, drains, water-slabs).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Area, Streets } from "@/lib/area";
import type { Drain } from "@/lib/engine/types";

const ROAD_CLASSES = "primary|secondary|tertiary|residential|unclassified|living_street";
const DRAIN_COUNT = 10;
const UA = "hydrotwin/0.1 (SDP University Hackathon 2026 prototype)";
const BANDS = { road: 6, yard: 24 };

const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const coords = (way: { geometry: { lat: number; lon: number }[] }) => way.geometry.map((p) => [round(p.lon), round(p.lat)]);

function centroid(points: number[][]): [number, number] {
  const sum = points.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

const dist2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

function kmeans(points: number[][], k: number, rounds = 25) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let centres = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / k)]);
  let assign: number[] = [];
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

function buildingHeight(tags: Record<string, string>): number {
  if (tags.height && !Number.isNaN(parseFloat(tags.height))) return parseFloat(tags.height);
  if (tags["building:levels"]) return parseFloat(tags["building:levels"]) * 3.2;
  return 7; // typical 2-storey default
}

async function fetchOverpass(query: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);
        const res = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) return await res.json();
      } catch {
        // try next endpoint
      }
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error("OpenStreetMap Overpass servers are currently overloaded. Please retry in a few moments.");
}

function rectangle(
  [lng1, lat1]: number[],
  [lng2, lat2]: number[],
  w: number,
  mPerDegLng: number,
  mPerDegLat: number,
): number[][][] | null {
  const dx = (lng2 - lng1) * mPerDegLng;
  const dy = (lat2 - lat1) * mPerDegLat;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const [ux, uy] = [dx / len, dy / len];
  const [nx, ny] = [-uy, ux];
  const at = ([lng, lat]: number[], along: number, across: number): [number, number] => [
    round(lng + (ux * along + nx * across) / mPerDegLng),
    round(lat + (uy * along + ny * across) / mPerDegLat),
  ];
  const a = [lng1, lat1];
  const b = [lng2, lat2];
  return [[at(a, -w, -w), at(b, w, -w), at(b, w, w), at(a, -w, w), at(a, -w, -w)]];
}

export interface GenerateInput {
  slug: string;
  name: string;
  bbox: [number, number, number, number]; // [south, west, north, east]
}

export interface GeneratedTownshipBundle {
  area: Area;
  streets: Streets;
  buildings: GeoJSON.FeatureCollection;
  drains: Drain[];
  floodZones: GeoJSON.FeatureCollection;
}

export async function generateTownship({ slug, name, bbox }: GenerateInput): Promise<GeneratedTownshipBundle> {
  const [s, w, n, e] = bbox;
  const centerLat = (s + n) / 2;
  const centerLng = (w + e) / 2;

  // Validate size
  const latKm = Math.abs(n - s) * 111;
  const lngKm = Math.abs(e - w) * 111 * Math.cos((centerLat * Math.PI) / 180);
  const diagonalKm = Math.hypot(latKm, lngKm);

  if (diagonalKm > 5.5) {
    throw new Error("Selected area is too large (max 5km diagonal). Please select a neighbourhood or township.");
  }
  if (diagonalKm < 0.2) {
    throw new Error("Selected area is too small. Please select an area covering at least a few residential streets.");
  }

  const box = `${s},${w},${n},${e}`;
  const query = `[out:json][timeout:35];(way["highway"~"^(${ROAD_CLASSES})$"](${box});way["building"](${box}););out geom;`;

  const osm = await fetchOverpass(query);
  const elements = osm.elements || [];

  interface OsmWay {
    id: number;
    tags?: Record<string, string>;
    geometry: { lat: number; lon: number }[];
  }

  const roads: OsmWay[] = elements.filter((el: OsmWay) => el.tags?.highway && el.geometry?.length > 1);
  const rawBuildings: OsmWay[] = elements.filter((el: OsmWay) => el.tags?.building && el.geometry?.length > 3);

  if (roads.length < 5) {
    throw new Error("Insufficient road data in the selected area. Please choose an area with mapped streets.");
  }

  const roadCentres = roads.map((r) => centroid(coords(r)));
  const k = Math.min(DRAIN_COUNT, roads.length);
  const { centres, assign } = kmeans(roadCentres, k);

  const order = centres
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c[1] - a.c[1] || a.c[0] - b.c[0])
    .map((x) => x.i);

  const drainId = (cluster: number) => `D${String(order.indexOf(cluster) + 1).padStart(2, "0")}`;

  // Fetch elevation
  const latStr = centres.map((c) => round(c[1])).join(",");
  const lonStr = centres.map((c) => round(c[0])).join(",");
  let elevation: number[] = [];

  try {
    const elevRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lonStr}`, {
      headers: { "User-Agent": UA },
    });
    if (elevRes.ok) {
      const data = await elevRes.json();
      elevation = data.elevation || [];
    }
  } catch {
    // Fallback if elevation API is unreachable
  }

  if (!elevation.length || elevation.length !== centres.length) {
    elevation = Array(centres.length).fill(6);
  }

  const minE = Math.min(...elevation);
  const maxE = Math.max(...elevation);
  const lowness = (h: number) => (maxE === minE ? 0.5 : (maxE - h) / (maxE - minE));
  const sizes = centres.map((_, i) => assign.filter((a) => a === i).length);
  const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const sizeSpan = Math.max(...sizes) - Math.min(...sizes) || 1;
  const catchment = (i: number) => 0.8 + 0.8 * lowness(elevation[i]) + (0.2 * (sizes[i] - meanSize)) / sizeSpan;

  const drains: Drain[] = centres
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

  const streets: Streets = {
    type: "FeatureCollection",
    features: roads.map((r, j) => ({
      type: "Feature",
      properties: {
        id: `w${r.id}`,
        name: r.tags?.name ?? null,
        highway: r.tags?.highway ?? "residential",
        drain_id: drainId(assign[j]),
      },
      geometry: { type: "LineString", coordinates: coords(r) },
    })),
  };

  const buildings: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: rawBuildings.map((b) => ({
      type: "Feature",
      properties: { id: `w${b.id}`, height: buildingHeight(b.tags || {}) },
      geometry: { type: "Polygon", coordinates: [coords(b)] },
    })),
  };

  // Generate water-slab geometries
  const lat0 = streets.features[0].geometry.coordinates[0][1];
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);

  const zones = new Map<string, number[][][][]>();
  for (const f of streets.features) {
    const pts = f.geometry.coordinates;
    for (const [band, wVal] of Object.entries(BANDS)) {
      const key = `${f.properties.drain_id}-${band}`;
      if (!zones.has(key)) zones.set(key, []);
      for (let i = 0; i < pts.length - 1; i++) {
        const r = rectangle(pts[i], pts[i + 1], wVal, mPerDegLng, mPerDegLat);
        if (r) zones.get(key)!.push(r);
      }
    }
  }

  const floodZones: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [...zones].map(([id, polygons]) => {
      const [dId, band] = id.split("-");
      return {
        type: "Feature",
        properties: { id, drain_id: dId, band },
        geometry: { type: "MultiPolygon", coordinates: polygons },
      };
    }),
  };

  const area: Area = {
    slug,
    name,
    bbox: [round(s), round(w), round(n), round(e)],
    center: [round(centerLng), round(centerLat)],
    attribution: "© OpenStreetMap contributors (ODbL) · Elevation: Open-Meteo (CC BY 4.0)",
  };

  // If in local development, save to public/data/<slug>/ as well
  try {
    const outDir = path.join(process.cwd(), "public", "data", slug);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "area.json"), JSON.stringify(area, null, 2) + "\n");
    await writeFile(path.join(outDir, "streets.geojson"), JSON.stringify(streets));
    await writeFile(path.join(outDir, "buildings.geojson"), JSON.stringify(buildings));
    await writeFile(path.join(outDir, "drains.json"), JSON.stringify(drains, null, 2) + "\n");
    await writeFile(path.join(outDir, "flood-zones.geojson"), JSON.stringify(floodZones));
  } catch {
    // If running in a read-only serverless runtime, filesystem write is skipped safely
  }

  return { area, streets, buildings, drains, floodZones };
}
