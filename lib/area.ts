// Loads a township's data from public/data/<slug>/ (built by `npm run data`). Server code only (uses fs).
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Drain } from "@/lib/engine/types";

export interface Area {
  slug: string;
  name: string;
  bbox: [number, number, number, number]; // south, west, north, east
  center: [number, number]; // lng, lat
  attribution: string;
}

export interface StreetProps {
  id: string; // OSM way id, "w123"
  name: string | null;
  highway: string;
  drain_id: string;
}

export interface Streets {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: StreetProps; geometry: { type: "LineString"; coordinates: number[][] } }[];
}

async function readJson<T>(slug: string, file: string): Promise<T> {
  const raw = await readFile(path.join(process.cwd(), "public", "data", slug, file), "utf8");
  return JSON.parse(raw) as T;
}

export async function loadArea(slug: string) {
  const [area, drains, streets] = await Promise.all([
    readJson<Area>(slug, "area.json"),
    readJson<Drain[]>(slug, "drains.json"),
    readJson<Streets>(slug, "streets.geojson"),
  ]);
  return { area, drains, streets };
}
