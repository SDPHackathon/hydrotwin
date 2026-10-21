import "server-only";
import { readSharedTownship } from "@/lib/shared-townships";
import { calculateEvacuation } from "@/lib/engine/evacuation";
import { loadEvacuationCatalogue } from "./catalogue";
import { areaSnapshot } from "@/lib/area-state";
import type { RoadPoint } from "@/lib/engine/route";
import { DEMO_RESIDENTS } from "@/lib/residents-data";
export class InvalidRouteOrigin extends Error {}

export async function residentSafeRoute(id: string) {
  const resident = DEMO_RESIDENTS.find((r) => r.id === id);
  if (!resident) return null;
  const bundle = await readSharedTownship("bukit-raja");
  if (!bundle) return null;
  const { streets } = bundle;
  const catalogue = await loadEvacuationCatalogue("bukit-raja");
  // Copy after I/O and before calculation: colors, evidence and route share one revision.
  const snapshot = areaSnapshot(bundle);
  return calculateEvacuation({ streets: streets.features, origin: resident.street_id, catalogue,
    statuses: snapshot.statuses, evidence: snapshot.floodEvidence, now: Date.now(), residentId: id });
}
export async function locationSafeRoute(area: string, origin: RoadPoint) {
  const bundle = await readSharedTownship(area);
  if (!bundle) return null;
  const street = bundle.streets.features.find((s) => s.properties.id === origin?.street_id);
  const p = origin?.position;
  if (!street || !p || !Number.isInteger(p.segment_index) || p.segment_index < 0 || p.segment_index + 1 >= street.geometry.coordinates.length ||
      !Number.isFinite(p.fraction) || p.fraction < 0 || p.fraction > 1) throw new InvalidRouteOrigin("Select a valid mapped starting point");
  const catalogue = await loadEvacuationCatalogue(area);
  const snapshot = areaSnapshot(bundle);
  const identity = `${area}:${origin.street_id}:${p.segment_index}:${p.fraction}`;
  return { ...calculateEvacuation({ streets: bundle.streets.features, origin: origin.street_id, position: p, catalogue,
    statuses: snapshot.statuses, evidence: snapshot.floodEvidence, now: Date.now(), residentId: identity }), area_slug: area };
}
