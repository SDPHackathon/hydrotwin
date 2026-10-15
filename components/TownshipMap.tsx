"use client";

// 3D township map. Streets and drains are coloured with feature-state, so a status change
// never reloads the data. Base map: OpenFreeMap (free, no key). No Google/Cesium tiles.

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Area, Streets } from "@/lib/area";
import type { Drain, DrainStatus } from "@/lib/engine/types";
import { STATUS_COLOR, WATER_COLOR } from "@/lib/colors";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";

type Props = {
  area: Area;
  drains: Drain[];
  streets: Streets;
  statuses: Record<string, DrainStatus>;
};

const byStatus = (fallback: string) => [
  "match",
  ["coalesce", ["feature-state", "status"], "green"],
  "red",
  STATUS_COLOR.red,
  "amber",
  STATUS_COLOR.amber,
  fallback,
];

export default function TownshipMap({ area, drains, streets, statuses }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // maplibre-gl touches `window` on import → load it in the browser only.
      const { Map, NavigationControl, setWorkerUrl } = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const m = new Map({
        container: container.current,
        style: BASE_STYLE,
        center: area.center,
        zoom: 15.4,
        pitch: 50,
        bearing: -15,
      });
      m.addControl(new NavigationControl({ visualizePitch: true }), "top-left");
      map.current = m;

      m.on("load", () => {
        m.addSource("streets", {
          type: "geojson",
          data: streets as GeoJSON.FeatureCollection,
          promoteId: "id",
          attribution: area.attribution,
        });
        m.addSource("buildings", { type: "geojson", data: `/data/${area.slug}/buildings.geojson` });
        m.addSource("drains", {
          type: "geojson",
          promoteId: "id",
          data: {
            type: "FeatureCollection",
            features: drains.map((d) => ({
              type: "Feature",
              properties: { id: d.id },
              geometry: { type: "Point", coordinates: [d.lng, d.lat] },
            })),
          },
        });

        // Water spreading along flooded streets — width follows street_depth_cm.
        m.addLayer({
          id: "street-water",
          type: "line",
          source: "streets",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": WATER_COLOR,
            "line-opacity": 0.5,
            "line-blur": 3,
            "line-width": ["interpolate", ["linear"], ["coalesce", ["feature-state", "depth"], 0], 0, 0, 5, 10, 40, 28],
          },
        });
        m.addLayer({
          id: "streets",
          type: "line",
          source: "streets",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": byStatus(STATUS_COLOR.green) as never,
            "line-width": ["match", ["get", "highway"], ["primary", "secondary"], 5, "tertiary", 4, 2.5],
          },
        });
        m.addLayer({
          id: "buildings-3d",
          type: "fill-extrusion",
          source: "buildings",
          paint: {
            "fill-extrusion-color": "#d6d3d1",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.85,
          },
        });
        m.addLayer({
          id: "drains",
          type: "circle",
          source: "drains",
          paint: {
            "circle-radius": 7,
            "circle-color": byStatus(STATUS_COLOR.green) as never,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        m.addLayer({
          id: "drain-labels",
          type: "symbol",
          source: "drains",
          layout: {
            "text-field": ["get", "id"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 12,
            "text-offset": [0, 1.3],
          },
          paint: { "text-color": "#1c1917", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
        });
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [area, drains, streets]);

  // Push the latest status into feature-state — cheap, no data reload.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const f of streets.features) {
      const s = statuses[f.properties.drain_id];
      if (s) m.setFeatureState({ source: "streets", id: f.properties.id }, { status: s.status, depth: s.street_depth_cm });
    }
    for (const d of drains) {
      const s = statuses[d.id];
      if (s) m.setFeatureState({ source: "drains", id: d.id }, { status: s.status });
    }
  }, [ready, statuses, streets, drains]);

  return <div ref={container} className="h-full w-full" />;
}
