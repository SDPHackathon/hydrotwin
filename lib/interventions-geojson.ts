// Generates GeoJSON geometries for Plan Mode interventions to display on the 3D map.

import type { Drain, PlanIntervention } from "@/lib/engine/types";

const round = (n: number) => Math.round(n * 1e6) / 1e6;

// Create an octagon/circle polygon around a coordinate with given radius in metres
function circlePolygon(lng: number, lat: number, radiusM: number): number[][] {
  const points = 16;
  const coords: number[][] = [];
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dx = radiusM * Math.cos(angle);
    const dy = radiusM * Math.sin(angle);
    coords.push([round(lng + dx / mPerDegLng), round(lat + dy / mPerDegLat)]);
  }
  return coords;
}

export function makeInterventionsGeoJson(
  drains: Drain[],
  interventions: PlanIntervention[],
): GeoJSON.FeatureCollection {
  const drainMap = new Map(drains.map((d) => [d.id, d]));
  const features: GeoJSON.Feature[] = [];

  for (const inv of interventions) {
    const d = drainMap.get(inv.drain_id);
    if (!d) continue;

    if (inv.kind === "retention_pond") {
      // Offset slightly south/east from drain center to look like a dedicated retention basin
      const pondLng = d.lng + 0.0003;
      const pondLat = d.lat - 0.0002;
      features.push({
        type: "Feature",
        properties: {
          id: `pond-${inv.drain_id}`,
          kind: "retention_pond",
          drain_id: inv.drain_id,
          name: `${inv.drain_id} Retention Pond`,
        },
        geometry: {
          type: "Polygon",
          coordinates: [circlePolygon(pondLng, pondLat, 38)],
        },
      });
    } else if (inv.kind === "green_area") {
      features.push({
        type: "Feature",
        properties: {
          id: `green-${inv.drain_id}`,
          kind: "green_area",
          drain_id: inv.drain_id,
          name: `${inv.drain_id} Green Sponge Park`,
        },
        geometry: {
          type: "Polygon",
          coordinates: [circlePolygon(d.lng, d.lat, 48)],
        },
      });
    } else if (inv.kind === "bigger_drain") {
      features.push({
        type: "Feature",
        properties: {
          id: `culvert-${inv.drain_id}`,
          kind: "bigger_drain",
          drain_id: inv.drain_id,
          name: `${inv.drain_id} Upgraded Culvert`,
        },
        geometry: {
          type: "Point",
          coordinates: [d.lng, d.lat],
        },
      });
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
