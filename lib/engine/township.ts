import type { Drain } from "./types.ts";
import type { StreetFeature } from "./route.ts";
export interface RouteTownship {
  area: { slug: string; name: string; bbox: [number, number, number, number]; center: [number, number]; attribution: string };
  streets: { type: "FeatureCollection"; features: StreetFeature[] };
  drains: Drain[];
}
export function parseRouteTownship(input: unknown): RouteTownship {
  if (!input || typeof input !== "object") throw new Error("Missing township data");
  const bundle = input as RouteTownship, area = bundle.area;
  if (!area || typeof area.slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(area.slug) || typeof area.name !== "string" || !area.name.trim() || area.name.length > 120 ||
      !Array.isArray(area.bbox) || area.bbox.length !== 4 || !area.bbox.every(Number.isFinite) ||
      !Array.isArray(area.center) || area.center.length !== 2 || !area.center.every(Number.isFinite) || typeof area.attribution !== "string") throw new Error("Invalid township identity");
  const [south, west, north, east] = area.bbox;
  if (south < -85 || north > 85 || west < -180 || east > 180 || south >= north || west >= east || north - south > 0.06 || east - west > 0.1 ||
      area.center[0] < west || area.center[0] > east || area.center[1] < south || area.center[1] > north) throw new Error("Invalid township coverage");
  if (!Array.isArray(bundle.drains) || !bundle.drains.length || bundle.drains.length > 64 || !bundle.streets ||
      bundle.streets.type !== "FeatureCollection" || !Array.isArray(bundle.streets.features) || !bundle.streets.features.length || bundle.streets.features.length > 3000) throw new Error("Township data exceeds demo limits");
  const drains = new Set<string>(), roads = new Set<string>();
  for (const d of bundle.drains) {
    if (!d || typeof d.id !== "string" || !d.id || d.id.length > 80 || drains.has(d.id) || typeof d.name !== "string" || d.name.length > 160 ||
        ![d.lng, d.lat, d.elevation_m, d.bank_cm, d.catchment_factor, d.outflow_cm_per_min].every(Number.isFinite) ||
        Math.abs(d.lng) > 180 || Math.abs(d.lat) > 85 || d.bank_cm <= 0 || d.bank_cm > 10000 || d.catchment_factor < 0 || d.catchment_factor > 100 || d.outflow_cm_per_min < 0 || d.outflow_cm_per_min > 100) throw new Error("Invalid simulated zone");
    drains.add(d.id);
  }
  let vertices = 0;
  for (const s of bundle.streets.features) {
    const p = s?.properties, coords = s?.geometry?.coordinates;
    if (!p || typeof p.id !== "string" || !p.id || p.id.length > 100 || roads.has(p.id) || !drains.has(p.drain_id) ||
        !(p.name === null || (typeof p.name === "string" && p.name.length <= 300)) || typeof p.highway !== "string" || s.geometry.type !== "LineString" ||
        !Array.isArray(coords) || coords.length < 2 || coords.some((c) => !Array.isArray(c) || c.length < 2 || !c.every(Number.isFinite) ||
          // OSM returns complete ways; an existing Cyberjaya way extends ~2.9 km beyond its query box.
          Math.abs(c[0]) > 180 || Math.abs(c[1]) > 85 || c[0] < west - 0.03 || c[0] > east + 0.03 || c[1] < south - 0.03 || c[1] > north + 0.03)) throw new Error("Invalid mapped road");
    vertices += coords.length;
    roads.add(p.id);
  }
  if (vertices > 50000) throw new Error("Too many road vertices for this demo");
  return structuredClone({ area, streets: bundle.streets, drains: bundle.drains });
}
