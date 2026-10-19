// Bandar Bukit Raja as drawn in the video — the same OpenStreetMap extract the app uses
// (copied into src/data by scripts/copy-data.mjs).
import streetsGeo from "../data/streets.json";
import buildingsGeo from "../data/buildings.json";
import drainsData from "../data/drains.json";
import { boundsOf, centroid, fitProjector, pathD, type Box, type LngLat, type Projector } from "./geo";

type StreetFeature = {
  properties: { id: string; name?: string | null; highway?: string | null; drain_id?: string | null };
  geometry: { type: "LineString"; coordinates: LngLat[] };
};

type BuildingFeature = {
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: LngLat[][] | LngLat[][][] };
};

export type Street = { id: string; name: string; highway: string; drain: string; line: LngLat[] };

export const streets: Street[] = (streetsGeo as unknown as { features: StreetFeature[] }).features.map((f) => ({
  id: f.properties.id,
  name: f.properties.name ?? "",
  highway: f.properties.highway ?? "residential",
  drain: f.properties.drain_id ?? "",
  line: f.geometry.coordinates,
}));

// Outer rings only — footprints are drawn faint, holes don't matter.
export const buildings: LngLat[][] = (buildingsGeo as unknown as { features: BuildingFeature[] }).features.flatMap((f) =>
  f.geometry.type === "Polygon"
    ? [(f.geometry.coordinates as LngLat[][])[0]]
    : (f.geometry.coordinates as LngLat[][][]).map((poly) => poly[0]),
);

export type Drain = { id: string; lng: number; lat: number; catchment: number };

export const drains: Drain[] = (drainsData as { id: string; lng: number; lat: number; catchment_factor: number }[]).map(
  (d) => ({ id: d.id, lng: d.lng, lat: d.lat, catchment: d.catchment_factor }),
);

export const streetBounds = boundsOf(streets.map((s) => s.line));

// Line weight by road class.
export const strokeFor = (highway: string) =>
  ["trunk", "primary", "secondary"].includes(highway) ? 3 : highway === "tertiary" ? 2.2 : 1.5;

// A ready-to-draw town for a given screen box: every street and building as an SVG path.
export function drawTown(box: Box) {
  const project: Projector = fitProjector(streetBounds, box);
  return {
    project,
    streets: streets.map((s) => ({ ...s, d: pathD(s.line, project), c: centroid([s.line], project) })),
    buildings: buildings.map((b) => `${pathD(b, project)}Z`),
    drains: drains.map((d) => ({ ...d, p: project([d.lng, d.lat]) })),
  };
}

export type Town = ReturnType<typeof drawTown>;
