// Coverage discovery uses the downloaded boundary, never the locality name or flood status.
import { metresBetween } from "./demo-refuges.ts";
import type { RoadPoint, StreetFeature } from "./route.ts";
import type { RouteTownship } from "./township.ts";

export type CoverageArea = RouteTownship["area"];
export type Coordinate = [number, number];
export interface CoverageMatch {
  area: CoverageArea;
  origin: RoadPoint;
  coordinate: Coordinate;
  label: string;
  road_name: string | null;
  nearby_road_name: string | null;
  distance_m: number | null;
}
export interface CoverageResponse {
  areas: CoverageArea[];
  matches: CoverageMatch[];
  incomplete: string[];
  truncated: boolean;
}

export function insideCoverage(area: CoverageArea, point: Coordinate) {
  const [south, west, north, east] = area.bbox;
  return point.every(Number.isFinite) && point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north;
}

// Clip a segment parametrically. Keep original fractions so routing uses the exact same road.
export function coveredSegments(street: StreetFeature, area: CoverageArea) {
  const [south, west, north, east] = area.bbox;
  const segments: { a: Coordinate; b: Coordinate; index: number; start: number; end: number }[] = [];
  for (let index = 0; index + 1 < street.geometry.coordinates.length; index++) {
    const a = street.geometry.coordinates[index], b = street.geometry.coordinates[index + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx === 0 && dy === 0) continue;
    let start = 0, end = 1;
    for (const [p, q] of [[-dx, a[0] - west], [dx, east - a[0]], [-dy, a[1] - south], [dy, north - a[1]]]) {
      if (p === 0) { if (q < 0) end = -1; }
      else if (p < 0) start = Math.max(start, q / p);
      else end = Math.min(end, q / p);
    }
    if (start >= end) continue;
    segments.push({ a: [a[0] + dx * start, a[1] + dy * start], b: [a[0] + dx * end, a[1] + dy * end], index, start, end });
  }
  return segments;
}

export function coverageLabel(match: CoverageMatch, language: "en" | "bm" = "en") {
  if (match.road_name) return match.road_name;
  // Older in-memory selections may predate descriptive label metadata.
  if (match.road_name === undefined && !/^w\d+$/.test(match.label)) return match.label;
  return match.nearby_road_name
    ? (language === "bm" ? `Jalan tanpa nama berhampiran ${match.nearby_road_name}` : `Unnamed road near ${match.nearby_road_name}`)
    : (language === "bm" ? "Jalan tanpa nama" : "Unnamed road");
}

function match(area: CoverageArea, street: StreetFeature, streets: StreetFeature[], index: number, fraction: number, coordinate: Coordinate, distance_m: number | null): CoverageMatch {
  const road_name = street.properties.name?.trim() || null;
  let nearby_road_name: string | null = null;
  if (!road_name) {
    let best = 150;
    const scale = Math.cos(coordinate[1] * Math.PI / 180);
    for (const other of [...streets].sort((a, b) => a.properties.id.localeCompare(b.properties.id))) {
      const name = other.properties.name?.trim();
      if (!name || other.properties.id === street.properties.id) continue;
      for (const { a, b } of coveredSegments(other, area)) {
        const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((coordinate[0] - a[0]) * scale * dx + (coordinate[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        const distance = metresBetween(coordinate, [a[0] + dx / scale * t, a[1] + dy * t]);
        if (distance < best) { best = distance; nearby_road_name = name; }
      }
    }
  }
  const label = road_name ?? (nearby_road_name ? `Unnamed road near ${nearby_road_name}` : "Unnamed road");
  return { area, origin: { street_id: street.properties.id, position: { segment_index: index, fraction } },
    coordinate, label, road_name, nearby_road_name, distance_m };
}

export function searchCoverage(bundles: RouteTownship[], query: string): CoverageMatch[] {
  const q = query.trim().toLocaleLowerCase();
  if (q.length < 2 || q.length > 120) return [];
  const found: CoverageMatch[] = [];
  for (const { area, streets } of bundles) for (const street of streets.features) {
    if (!`${street.properties.name ?? ""} ${street.properties.id}`.toLocaleLowerCase().includes(q)) continue;
    const segment = coveredSegments(street, area).sort((a, b) => metresBetween(b.a, b.b) - metresBetween(a.a, a.b))[0];
    if (!segment) continue;
    found.push(match(area, street, streets.features, segment.index, (segment.start + segment.end) / 2,
      [(segment.a[0] + segment.b[0]) / 2, (segment.a[1] + segment.b[1]) / 2], null));
  }
  return found.sort((a, b) => Number(!a.label.toLocaleLowerCase().startsWith(q)) - Number(!b.label.toLocaleLowerCase().startsWith(q)) ||
    a.label.localeCompare(b.label) || a.area.slug.localeCompare(b.area.slug) || a.origin.street_id.localeCompare(b.origin.street_id));
}

// One closest road per containing coverage. Overlaps stay separate for explicit confirmation.
export function locateCoverage(bundles: RouteTownship[], point: Coordinate): CoverageMatch[] {
  if (!point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 85) return [];
  const found: CoverageMatch[] = [];
  const xScale = 111320 * Math.cos(point[1] * Math.PI / 180), yScale = 110574;
  for (const { area, streets } of bundles) {
    if (!insideCoverage(area, point)) continue;
    let best: CoverageMatch | null = null;
    for (const street of [...streets.features].sort((a, b) => a.properties.id.localeCompare(b.properties.id))) {
      for (const segment of coveredSegments(street, area)) {
        const dx = (segment.b[0] - segment.a[0]) * xScale, dy = (segment.b[1] - segment.a[1]) * yScale;
        const length2 = dx * dx + dy * dy;
        if (!length2) continue;
        const t = Math.max(0, Math.min(1, ((point[0] - segment.a[0]) * xScale * dx + (point[1] - segment.a[1]) * yScale * dy) / length2));
        const coordinate: Coordinate = [segment.a[0] + (segment.b[0] - segment.a[0]) * t, segment.a[1] + (segment.b[1] - segment.a[1]) * t];
        const distance = metresBetween(point, coordinate);
        if (distance <= 75 && (!best || distance < best.distance_m! - 1e-6)) {
          best = match(area, street, streets.features, segment.index, segment.start + (segment.end - segment.start) * t, coordinate, distance);
        }
      }
    }
    if (best) found.push(best);
  }
  return found.sort((a, b) => a.distance_m! - b.distance_m! || a.area.slug.localeCompare(b.area.slug));
}
