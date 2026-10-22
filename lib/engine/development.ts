// Scenario screening only: synthetic storm, independent drain zones, assumed runoff.
import type { Drain, DrainStatus } from "./types.ts";
import { applyInterventions } from "./plan.ts";
import { assess } from "./risk.ts";
import { stepLevel } from "./sim.ts";
import { rainAt, STORM_MINUTES } from "./storm.ts";

export const DEVELOPMENT_MODEL = "development-v2";
export type SitePoint = [number, number];
export type DevelopmentStage = "existing" | "proposed" | "mitigated";
export interface DevelopmentDraft {
  name: string;
  kind: "housing" | "commercial";
  boundary: SitePoint[]; // unclosed ring; drawing UI closes it on finish
  drain_id: string;
  access_street_id: string;
  existing_paved_pct: number;
  proposed_paved_pct: number;
  mitigation: "none" | "bigger_drain" | "retention_pond";
}
export interface DevelopmentRoad {
  properties: { id: string; drain_id: string };
  geometry: { type: "LineString"; coordinates: number[][] };
}
export interface DevelopmentMetrics {
  deepest_cm: number;
  minutes_to_first_red: number | null;
  streets_flooded: number;
  access_flooded: boolean;
  peak_statuses: Record<string, DrainStatus>;
}
export interface DevelopmentResult {
  area_ha: number;
  inflow_multiplier: number;
  zone_area_ha: number;
  stages: Record<DevelopmentStage, DevelopmentMetrics>;
}
export const DEVELOPMENT_STAGES: DevelopmentStage[] = ["existing", "proposed", "mitigated"];
export const DEVELOPMENT_LABELS = { existing: "Existing", proposed: "Developed", mitigated: "With mitigation" };

export function newDevelopment(drainId: string): DevelopmentDraft {
  return { name: "Housing proposal", kind: "housing", boundary: [], drain_id: drainId,
    access_street_id: "", existing_paved_pct: 10,
    proposed_paved_pct: 60, mitigation: "none" };
}

// Local equirectangular projection, suitable for small township sites, not land surveys.
function projected(points: SitePoint[]): SitePoint[] {
  const [lng, lat] = points[0] ?? [0, 0];
  const k = Math.PI * 6371008.8 / 180;
  return points.map(([x, y]) => [(x - lng) * k * Math.cos(lat * Math.PI / 180), (y - lat) * k]);
}
export function siteAreaHa(points: SitePoint[]): number {
  const p = projected(points);
  return Math.abs(p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0)) / 20000;
}
function cross(a: SitePoint, b: SitePoint, c: SitePoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Proximity suggestion only; uses existing street-to-zone assignments from Live. */
export function suggestDevelopmentConnections(boundary: SitePoint[], roads: DevelopmentRoad[], drains: Drain[]): { drain_id: string; access_street_id: string } | null {
  if (boundaryError(boundary)) return null;
  const centre: SitePoint = [boundary.reduce((s, p) => s + p[0], 0) / boundary.length, boundary.reduce((s, p) => s + p[1], 0) / boundary.length];
  let best = Infinity;
  let chosen: DevelopmentRoad | null = null;
  for (const road of [...roads].sort((a, b) => a.properties.id.localeCompare(b.properties.id))) {
    if (!drains.some(d => d.id === road.properties.drain_id)) continue;
    const points = projected([centre, ...road.geometry.coordinates as SitePoint[]]).slice(1);
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const length2 = dx * dx + dy * dy;
      const t = length2 ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length2)) : 0;
      const distance2 = (a[0] + t * dx) ** 2 + (a[1] + t * dy) ** 2;
      if (Number.isFinite(distance2) && distance2 < best) { best = distance2; chosen = road; }
    }
  }
  return chosen ? { drain_id: chosen.properties.drain_id, access_street_id: chosen.properties.id } : null;
}

/** Approximate footprint of the Live zone's street cluster, not a watershed. */
export function estimatedZoneAreaHa(drainId: string, roads: DevelopmentRoad[]): number {
  const points = roads.filter(r => r.properties.drain_id === drainId).flatMap(r => r.geometry.coordinates).filter(p => p.length >= 2 && p.slice(0, 2).every(Number.isFinite)) as SitePoint[];
  if (!points.length) return 0;
  const p = projected(points);
  const xs = p.map(v => v[0]), ys = p.map(v => v[1]);
  // Pad 50 m on every side so even a single straight road has a footprint.
  return (Math.max(...xs) - Math.min(...xs) + 100) * (Math.max(...ys) - Math.min(...ys) + 100) / 10000;
}
function intersects(a: SitePoint, b: SitePoint, c: SitePoint, d: SitePoint): boolean {
  const on = (p: SitePoint, q: SitePoint, r: SitePoint) => Math.abs(cross(p, q, r)) < 1e-7 &&
    r[0] >= Math.min(p[0], q[0]) - 1e-7 && r[0] <= Math.max(p[0], q[0]) + 1e-7 &&
    r[1] >= Math.min(p[1], q[1]) - 1e-7 && r[1] <= Math.max(p[1], q[1]) + 1e-7;
  return (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
    on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
export function boundaryError(points: SitePoint[]): string | null {
  if (points.length < 3) return "Place at least three corners on the map.";
  if (points.length > 50) return "Use at most 50 corners.";
  if (points.some(p => p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85)) return "Invalid site coordinates.";
  const p = projected(points);
  for (let i = 0; i < p.length; i++) {
    const b = p[(i + 1) % p.length];
    if (Math.hypot(p[i][0] - b[0], p[i][1] - b[1]) < 0.1) return "Remove duplicate or overlapping corners.";
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      if (intersects(p[i], b, p[j], p[(j + 1) % p.length])) return "Site edges cross. Undo a corner or redraw the boundary.";
    }
  }
  if (siteAreaHa(points) < 0.01) return "Draw a site of at least 0.01 hectares.";
  return null;
}

export function developmentError(draft: DevelopmentDraft, drains: Drain[], roads: DevelopmentRoad[], bbox?: number[]): string | null {
  const error = boundaryError(draft.boundary);
  if (error) return error;
  if (bbox && draft.boundary.some(([lng, lat]) => lat < bbox[0] || lng < bbox[1] || lat > bbox[2] || lng > bbox[3])) return "Keep the site inside the loaded township extent.";
  if (!drains.some(d => d.id === draft.drain_id)) return "Choose a receiving drain zone.";
  if (!roads.some(r => r.properties.id === draft.access_street_id && drains.some(d => d.id === r.properties.drain_id))) return "Choose a mapped access road.";
  if (!estimatedZoneAreaHa(draft.drain_id, roads)) return "The selected zone has no mapped geometry for a size estimate.";
  if (![draft.existing_paved_pct, draft.proposed_paved_pct].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) return "Land-cover percentages must be between 0 and 100.";
  if (!["none", "bigger_drain", "retention_pond"].includes(draft.mitigation)) return "Choose a supported mitigation.";
  return null;
}

export function developmentDrains(drains: Drain[], draft: DevelopmentDraft, roads: DevelopmentRoad[]): { drains: Drain[]; multiplier: number } {
  // Demo coefficients: permeable 0.2, paved 0.9. Assume the unchanged remainder
  // of the simulated zone has the same baseline mix as the site's existing cover.
  const existing = 0.2 + 0.7 * draft.existing_paved_pct / 100;
  const proposed = 0.2 + 0.7 * draft.proposed_paved_pct / 100;
  const zoneArea = estimatedZoneAreaHa(draft.drain_id, roads);
  const fraction = Math.min(1, siteAreaHa(draft.boundary) / zoneArea);
  const multiplier = 1 + fraction * (proposed - existing) / existing;
  return { multiplier, drains: drains.map(d => d.id === draft.drain_id ? { ...d, catchment_factor: d.catchment_factor * multiplier } : d) };
}

function replayDevelopment(drains: Drain[], roads: DevelopmentRoad[], receiving: string, access: string): DevelopmentMetrics {
  const peakStatuses: Record<string, DrainStatus> = {};
  const firstRed: Record<string, number | null> = {};
  for (const drain of drains) {
    let level = 0, peak = 0;
    firstRed[drain.id] = null;
    for (let minute = 0; minute <= STORM_MINUTES + 30; minute++) {
      level = stepLevel(drain, level, rainAt(minute));
      peak = Math.max(peak, level);
      if (assess(drain, [level]).status === "red" && firstRed[drain.id] === null) firstRed[drain.id] = minute;
    }
    peakStatuses[drain.id] = assess(drain, [peak]);
  }
  const zone = peakStatuses[receiving];
  return {
    deepest_cm: zone.street_depth_cm,
    minutes_to_first_red: firstRed[receiving],
    streets_flooded: zone.status === "red" ? roads.filter(r => r.properties.drain_id === receiving).length : 0,
    access_flooded: peakStatuses[access].status === "red",
    peak_statuses: peakStatuses,
  };
}

export function evaluateDevelopment(draft: DevelopmentDraft, drains: Drain[], roads: DevelopmentRoad[], bbox?: number[]): DevelopmentResult {
  const error = developmentError(draft, drains, roads, bbox);
  if (error) throw new Error(error);
  const proposed = developmentDrains(drains, draft, roads);
  const mitigated = draft.mitigation === "none" ? proposed.drains : applyInterventions(proposed.drains, [{ drain_id: draft.drain_id, kind: draft.mitigation }]);
  const access = roads.find(r => r.properties.id === draft.access_street_id)!.properties.drain_id;
  return { area_ha: siteAreaHa(draft.boundary), zone_area_ha: estimatedZoneAreaHa(draft.drain_id, roads), inflow_multiplier: proposed.multiplier, stages: {
    existing: replayDevelopment(drains, roads, draft.drain_id, access),
    proposed: replayDevelopment(proposed.drains, roads, draft.drain_id, access),
    mitigated: replayDevelopment(mitigated, roads, draft.drain_id, access),
  } };
}

export interface SavedDevelopment {
  id: string;
  model: typeof DEVELOPMENT_MODEL;
  created_at: string;
  draft: DevelopmentDraft;
  results: DevelopmentResult;
}
// Stored results are historical only; always recompute comparisons against current data.
export function parseDevelopments(raw: string | null): SavedDevelopment[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((s): s is SavedDevelopment => {
      const d = s?.draft;
      return [DEVELOPMENT_MODEL, "development-v1"].includes(s?.model) && typeof s.id === "string" && typeof s.created_at === "string" &&
        d && typeof d.name === "string" && ["housing", "commercial"].includes(d.kind) &&
        typeof d.drain_id === "string" && typeof d.access_street_id === "string" &&
        [d.existing_paved_pct, d.proposed_paved_pct].every(n => typeof n === "number" && Number.isFinite(n)) &&
        ["none", "bigger_drain", "retention_pond"].includes(d.mitigation) &&
        Array.isArray(d.boundary) && d.boundary.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === "number" && Number.isFinite(n)));
    }).slice(0, 30).map(s => ({ ...s, model: DEVELOPMENT_MODEL }));
  } catch { return []; }
}
