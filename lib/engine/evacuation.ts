// Routing evidence and eligibility only. No I/O, UI or ambient clock.
import { findSafeRoute, type RoadPosition, type RouteDestination, type RouteResult, type StreetFeature } from "./route.ts";
import type { DrainStatus, Status } from "./types.ts";

export const CONDITIONS_TTL_MS = 6000;
export type Conditions = "waiting" | "current" | "frozen" | "stale" | "offline";
export interface FloodEvidence {
  source: "local_demo" | "phone_demo";
  revision: string;
  observed_at: Record<string, number>;
  controller_at: number | null;
  running: boolean;
  minute: number;
}
export interface EvacuationDestination extends RouteDestination {
  area_slug: string;
  purpose: "evacuation_centre" | "assembly_point" | "vehicle_parking" | "demo_refuge";
  simulation?: { model: string; peak_cm: number; bank_cm: number; ever_amber: boolean; through_minute: number };
  verification_state: "candidate" | "verified" | "rejected";
  source: string;
  source_id: string;
  source_url: string | null;
  licence: string;
  verified_at: string | null;
  verification_expires_at: string | null;
  availability: "open" | "closed" | "full" | "unknown";
  availability_observed_at: string | null;
  availability_expires_at: string | null;
  entrance: [number, number];
  access: { network_fingerprint: string; verification_state: "schematic" | "verified"; expires_at: string | null };
  accessibility: "unknown" | "step_free";
  disabled: boolean;
}
export interface EvacuationCatalogue {
  schema_version: 1;
  area_slug: string;
  revision: string;
  network_fingerprint: string;
  generated_at: string;
  mode: "demo" | "operational";
  destinations: EvacuationDestination[];
}

/** Stable across feature ordering; includes geometry, zone assignment and road identity. */
export function roadFingerprint(streets: StreetFeature[]): string {
  const data = JSON.stringify([...streets].sort((a, b) => a.properties.id < b.properties.id ? -1 : a.properties.id > b.properties.id ? 1 : 0)
    .map((s) => [s.properties.id, s.properties.drain_id, s.geometry.coordinates]));
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619) >>> 0;
  return `roads-v1-${hash.toString(16).padStart(8, "0")}`;
}
const time = (s: unknown) => typeof s === "string" && Number.isFinite(Date.parse(s));
const currentEvidence = (observed: string | null, expiry: string | null, now: number) =>
  time(observed) && time(expiry) && Date.parse(observed!) <= now && Date.parse(expiry!) > now && Date.parse(expiry!) > Date.parse(observed!);

/** Reject the whole import rather than publishing a partially valid catalogue. */
export function parseCatalogue(input: unknown, streets: StreetFeature[], area: string): EvacuationCatalogue {
  if (!input || typeof input !== "object") throw new Error("Missing catalogue");
  const c = input as EvacuationCatalogue;
  if (c.schema_version !== 1 || c.area_slug !== area || typeof c.revision !== "string" || !c.revision || !time(c.generated_at) ||
      !["demo", "operational"].includes(c.mode) || c.network_fingerprint !== roadFingerprint(streets) ||
      !Array.isArray(c.destinations) || c.destinations.length > 100) throw new Error("Unsupported catalogue or road revision");
  const ids = new Set<string>();
  for (const d of c.destinations) {
    const street = streets.find((s) => s.properties.id === d?.street_id);
    const p = d?.position;
    if (!d || typeof d.id !== "string" || !d.id || ids.has(d.id) || d.area_slug !== area ||
        typeof d.name !== "string" || !d.name.trim() || d.name.length > 100 || !street ||
        !["demo", "verified"].includes(d.kind) || !["candidate", "verified", "rejected"].includes(d.verification_state) ||
        !["evacuation_centre", "assembly_point", "vehicle_parking", "demo_refuge"].includes(d.purpose) ||
        !["open", "closed", "full", "unknown"].includes(d.availability) || typeof d.disabled !== "boolean" ||
        typeof d.source !== "string" || !d.source || typeof d.source_id !== "string" || !d.source_id || typeof d.licence !== "string" || !d.licence || !(d.source_url === null || (typeof d.source_url === "string" && /^https:\/\//.test(d.source_url))) ||
        !["unknown", "step_free"].includes(d.accessibility) ||
        !Array.isArray(d.entrance) || d.entrance.length !== 2 || !d.entrance.every(Number.isFinite) ||
        Math.abs(d.entrance[0]) > 180 || Math.abs(d.entrance[1]) > 90 ||
        !p || !Number.isInteger(p.segment_index) || p.segment_index < 0 || p.segment_index + 1 >= street.geometry.coordinates.length ||
        !Number.isFinite(p.fraction) || p.fraction < 0 || p.fraction > 1 ||
        !d.access || !["schematic", "verified"].includes(d.access.verification_state) || d.access.network_fingerprint !== c.network_fingerprint ||
        [d.verified_at, d.verification_expires_at, d.availability_observed_at, d.availability_expires_at, d.access.expires_at].some((t) => t !== null && !time(t))) {
      throw new Error("Invalid destination identity, evidence or access");
    }
    if ((d.purpose === "demo_refuge" && !d.simulation) || (d.simulation && (
      typeof d.simulation.model !== "string" || !d.simulation.model || !Number.isFinite(d.simulation.peak_cm) || d.simulation.peak_cm < 0 ||
      !Number.isFinite(d.simulation.bank_cm) || d.simulation.bank_cm <= 0 || typeof d.simulation.ever_amber !== "boolean" ||
      !Number.isInteger(d.simulation.through_minute) || d.simulation.through_minute <= 0))) throw new Error("Invalid simulation evidence");
    // Entrance must be in the loaded road extent, with a small allowance for off-road entrances.
    const coords = streets.flatMap((s) => s.geometry.coordinates);
    for (const axis of [0, 1]) {
      const values = coords.map((p) => p[axis]);
      if (d.entrance[axis] < Math.min(...values) - 0.001 || d.entrance[axis] > Math.max(...values) + 0.001) throw new Error("Entrance outside coverage");
    }
    if ((d.verified_at && d.verification_expires_at && Date.parse(d.verified_at) >= Date.parse(d.verification_expires_at)) ||
        (d.availability_observed_at && d.availability_expires_at && Date.parse(d.availability_observed_at) >= Date.parse(d.availability_expires_at))) throw new Error("Invalid evidence interval");
    ids.add(d.id);
  }
  return structuredClone(c);
}

export function eligibleDestinations(c: EvacuationCatalogue, statuses: Record<string, Status | undefined>, streets: StreetFeature[], now: number): EvacuationDestination[] {
  const fingerprint = roadFingerprint(streets);
  if (c.network_fingerprint !== fingerprint) return [];
  return c.destinations.filter((d) => {
    const street = streets.find((s) => s.properties.id === d.street_id);
    if (d.disabled || !(d.purpose === "evacuation_centre" || (c.mode === "demo" && d.purpose === "demo_refuge")) || d.availability !== "open" || !street ||
        statuses[street.properties.drain_id] !== "green" || d.access.network_fingerprint !== fingerprint ||
        (d.access.expires_at !== null && Date.parse(d.access.expires_at) <= now) ||
        (d.availability_expires_at !== null && Date.parse(d.availability_expires_at) <= now)) return false;
    if (c.mode === "demo") return d.kind === "demo" && d.verification_state === "candidate";
    return d.kind === "verified" && d.verification_state === "verified" && d.access.verification_state === "verified" &&
      currentEvidence(d.verified_at, d.verification_expires_at, now) &&
      currentEvidence(d.availability_observed_at, d.availability_expires_at, now) &&
      d.access.expires_at !== null && Date.parse(d.access.expires_at) > now;
  });
}

export function effectiveFlood(statuses: Record<string, DrainStatus>, evidence: FloodEvidence, now: number): {
  conditions: Conditions; statuses: Record<string, DrainStatus>; expires_at: number | null;
} {
  if (evidence.controller_at === null || evidence.controller_at > now) return { conditions: "waiting", statuses: {}, expires_at: null };
  const running = evidence.running && evidence.minute < 210;
  const expiry = running ? evidence.controller_at + CONDITIONS_TTL_MS : null;
  if (expiry !== null && now >= expiry) return { conditions: "stale", statuses: {}, expires_at: expiry };
  const known = Object.fromEntries(Object.entries(statuses).filter(([id]) => {
    const observed = evidence.observed_at[id];
    return Number.isFinite(observed) && observed <= now && (!running || now < observed + CONDITIONS_TTL_MS);
  }));
  const earliest = running && Object.keys(known).length ? Math.min(expiry!, ...Object.keys(known).map((id) => evidence.observed_at[id] + CONDITIONS_TTL_MS)) : expiry;
  return { conditions: Object.keys(known).length ? (running ? "current" : "frozen") : "waiting", statuses: known, expires_at: earliest };
}

export interface RouteEnvelope {
  version: 1;
  resident_id: string | null;
  source: FloodEvidence["source"];
  snapshot_revision: string;
  catalogue_revision: string | null;
  network_fingerprint: string;
  calculated_at: number;
  valid_for_ms: number;
  conditions: Conditions;
  statuses: Record<string, DrainStatus>;
  observed_at: Record<string, number>;
  route: RouteResult;
  catalogue: EvacuationCatalogue | null;
}

export function calculateEvacuation({ streets, origin, position, catalogue, statuses, evidence, now, residentId = null, selectedId = null }: {
  streets: StreetFeature[]; origin: string; position?: RoadPosition; catalogue: EvacuationCatalogue | null;
  statuses: Record<string, DrainStatus>; evidence: FloodEvidence; now: number; residentId?: string | null; selectedId?: string | null;
}): RouteEnvelope {
  const flood = effectiveFlood(statuses, evidence, now);
  const colors = Object.fromEntries(Object.entries(flood.statuses).map(([id, s]) => [id, s.status]));
  const eligible = catalogue ? eligibleDestinations(catalogue, colors, streets, now) : [];
  const route = findSafeRoute(streets, origin, eligible, colors, selectedId, position);
  if (!catalogue) route.outcome = "catalogue_unavailable";
  else if (!["current", "frozen"].includes(flood.conditions)) route.outcome = "conditions_unavailable";
  else if (!eligible.length && catalogue.destinations.length) route.outcome = "destination_unavailable";
  // Origin failures have priority over destination availability once data is initialized.
  if (catalogue && ["current", "frozen"].includes(flood.conditions)) {
    const street = streets.find((s) => s.properties.id === origin);
    if (street && colors[street.properties.drain_id] === "red") route.outcome = "origin_blocked";
    else if (street && !colors[street.properties.drain_id]) route.outcome = "origin_unknown";
  }
  if (route.outcome !== "found") { route.found = false; route.coordinates = []; route.legs = []; route.uses_amber = false; route.amber_m = 0; }
  const expiry = [flood.expires_at, ...eligible.flatMap((d) => [d.availability_expires_at, d.verification_expires_at, d.access.expires_at].filter((x) => x !== null).map((x) => Date.parse(x!)))].filter((x): x is number => x !== null);
  return { version: 1, resident_id: residentId, source: evidence.source, snapshot_revision: evidence.revision,
    catalogue_revision: catalogue?.revision ?? null, network_fingerprint: roadFingerprint(streets), calculated_at: now,
    valid_for_ms: Math.max(0, Math.min(CONDITIONS_TTL_MS, ...expiry.map((t) => t - now))),
    conditions: flood.conditions, statuses: flood.statuses, observed_at: { ...evidence.observed_at }, route, catalogue };
}

export type RouteChange = "flooded" | "unknown" | "destination" | "unavailable" | "alternative" | "changed" | "recovered";
export function withdrawRoute(envelope: RouteEnvelope, conditions: "stale" | "offline"): RouteEnvelope {
  return { ...envelope, conditions, statuses: {}, valid_for_ms: 0,
    route: { ...envelope.route, found: false, outcome: "conditions_unavailable", coordinates: [], legs: [], uses_amber: false, amber_m: 0 } };
}
export function routeChange(previous: RouteEnvelope | null, next: RouteEnvelope): RouteChange | null {
  if (!previous || previous.resident_id !== next.resident_id || previous.source !== next.source) return null;
  if (["stale", "offline", "waiting"].includes(next.conditions)) return previous.conditions === next.conditions ? null : "unavailable";
  if (!previous.route.found) return next.route.found ? "recovered" : null;
  if (previous.route.legs.some((leg) => next.statuses[leg.drain_id]?.status === "red")) return "flooded";
  if (previous.route.legs.some((leg) => !next.statuses[leg.drain_id])) return "unknown";
  const destination = next.catalogue?.destinations.find((d) => d.id === previous.route.destination_id);
  if (!destination || destination.disabled || destination.availability !== "open") return "destination";
  if (!next.route.found) return "unavailable";
  if (next.route.destination_id !== previous.route.destination_id) return "alternative";
  return JSON.stringify(next.route.coordinates) !== JSON.stringify(previous.route.coordinates) || previous.route.uses_amber !== next.route.uses_amber ? "changed" : null;
}
