// Scenario screening only: synthetic storm, independent drain zones, assumed runoff.
import type { Drain, DrainStatus } from "./types.ts";
import { applyInterventions } from "./plan.ts";
import { assess } from "./risk.ts";
import { stepLevel } from "./sim.ts";
import { rainAt, STORM_MINUTES } from "./storm.ts";

export const DEVELOPMENT_MODEL = "development-v1";
export type SitePoint = [number, number];
export type DevelopmentStage = "existing" | "proposed" | "mitigated";
export interface DevelopmentDraft {
  name: string;
  kind: "housing" | "commercial";
  boundary: SitePoint[]; // unclosed ring; drawing UI closes it on finish
  drain_id: string;
  access_street_id: string;
  catchment_ha: number;
  existing_paved_pct: number;
  proposed_paved_pct: number;
  mitigation: "none" | "bigger_drain" | "retention_pond";
}
export interface DevelopmentRoad {
  properties: { id: string; drain_id: string };
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
  stages: Record<DevelopmentStage, DevelopmentMetrics>;
}
export const DEVELOPMENT_STAGES: DevelopmentStage[] = ["existing", "proposed", "mitigated"];
export const DEVELOPMENT_LABELS = { existing: "Existing", proposed: "Developed", mitigated: "With mitigation" };

export function newDevelopment(drainId: string): DevelopmentDraft {
  return { name: "Housing proposal", kind: "housing", boundary: [], drain_id: drainId,
    access_street_id: "", catchment_ha: 100, existing_paved_pct: 10,
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
  if (!Number.isFinite(draft.catchment_ha) || draft.catchment_ha <= 0 || draft.catchment_ha > 100000) return "Enter a catchment area between 0 and 100,000 hectares.";
  if (siteAreaHa(draft.boundary) > draft.catchment_ha) return "The catchment area must include the entire site.";
  if (![draft.existing_paved_pct, draft.proposed_paved_pct].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) return "Land-cover percentages must be between 0 and 100.";
  if (!["none", "bigger_drain", "retention_pond"].includes(draft.mitigation)) return "Choose a supported mitigation.";
  return null;
}

export function developmentDrains(drains: Drain[], draft: DevelopmentDraft): { drains: Drain[]; multiplier: number } {
  // Demo coefficients: permeable 0.2, paved 0.9. Assume the unchanged remainder
  // of the catchment has the same baseline mix as the site's existing cover.
  const existing = 0.2 + 0.7 * draft.existing_paved_pct / 100;
  const proposed = 0.2 + 0.7 * draft.proposed_paved_pct / 100;
  const multiplier = 1 + siteAreaHa(draft.boundary) / draft.catchment_ha * (proposed - existing) / existing;
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
  const proposed = developmentDrains(drains, draft);
  const mitigated = draft.mitigation === "none" ? proposed.drains : applyInterventions(proposed.drains, [{ drain_id: draft.drain_id, kind: draft.mitigation }]);
  const access = roads.find(r => r.properties.id === draft.access_street_id)!.properties.drain_id;
  return { area_ha: siteAreaHa(draft.boundary), inflow_multiplier: proposed.multiplier, stages: {
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
      return s?.model === DEVELOPMENT_MODEL && typeof s.id === "string" && typeof s.created_at === "string" &&
        d && typeof d.name === "string" && ["housing", "commercial"].includes(d.kind) &&
        typeof d.drain_id === "string" && typeof d.access_street_id === "string" &&
        [d.catchment_ha, d.existing_paved_pct, d.proposed_paved_pct].every(n => typeof n === "number" && Number.isFinite(n)) &&
        ["none", "bigger_drain", "retention_pond"].includes(d.mitigation) &&
        Array.isArray(d.boundary) && d.boundary.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === "number" && Number.isFinite(n)));
    }).slice(0, 30);
  } catch { return []; }
}
