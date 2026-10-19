// Bandar Bukit Raja as drawn in the video — the same OpenStreetMap extract the app uses
// (copied into src/data by scripts/copy-data.mjs).
import streetsGeo from "../data/streets.json";
import buildingsGeo from "../data/buildings.json";
import type { LngLat } from "./geo";

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
