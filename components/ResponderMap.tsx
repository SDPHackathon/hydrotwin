"use client";

// Small 2D map for the guard's phone: streets coloured by status, the responder route on top —
// dry stretches solid violet (the dashboard's safe-route colour), the wet stretch dashed blue.
// Base map: OpenFreeMap positron (free, no key). Layer ids are prefixed so they never clash with
// the base style's own ids (it has a `water` layer).

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ResponderRoute } from "@/lib/engine/help";
import type { StreetFeature } from "@/lib/engine/route";
import type { Status } from "@/lib/engine/types";
import { SAFE_ROUTE_COLOR, STATUS_COLOR, WATER_COLOR } from "@/lib/colors";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)';
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type Props = {
  streets: StreetFeature[];
  statuses: Record<string, Status | undefined>;
  route: ResponderRoute | null;
  center: [number, number];
  className?: string;
};

function streetsGeoJson(streets: StreetFeature[], statuses: Props["statuses"]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: streets.map((s) => ({
      type: "Feature",
      properties: { id: s.properties.id, status: statuses[s.properties.drain_id] ?? "unknown" },
      geometry: s.geometry as GeoJSON.LineString,
    })),
  };
}

function routeGeoJson(route: ResponderRoute | null): GeoJSON.FeatureCollection {
  if (!route?.found) return EMPTY;
  return {
    type: "FeatureCollection",
    features: route.legs.map((leg, i) => ({
      type: "Feature",
      properties: { status: leg.status, i },
      geometry: { type: "LineString", coordinates: leg.coordinates },
    })),
  };
}

function pointsGeoJson(route: ResponderRoute | null): GeoJSON.FeatureCollection {
  if (!route?.found || !route.origin || !route.destination) return EMPTY;
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { kind: "post", label: route.post?.name ?? "Guard post" }, geometry: { type: "Point", coordinates: route.origin } },
      { type: "Feature", properties: { kind: "resident", label: "Resident" }, geometry: { type: "Point", coordinates: route.destination } },
    ],
  };
}

export default function ResponderMap({ streets, statuses, route, center, className = "" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const initial = useRef({ streets, statuses, route, center });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // maplibre-gl touches `window` on import → load it in the browser only.
      const { Map, setWorkerUrl } = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new Map({ container: container.current, style: BASE_STYLE, center: initial.current.center, zoom: 15, pitch: 0 });
      map.current = m;

      m.on("load", () => {
        const { streets, statuses, route } = initial.current;
        m.addSource("responder-streets", { type: "geojson", data: streetsGeoJson(streets, statuses), attribution: OSM_ATTRIBUTION });
        m.addSource("responder-route", { type: "geojson", data: routeGeoJson(route) });
        m.addSource("responder-points", { type: "geojson", data: pointsGeoJson(route) });

        m.addLayer({
          id: "responder-streets", type: "line", source: "responder-streets",
          paint: {
            "line-color": ["match", ["get", "status"], "red", STATUS_COLOR.red, "amber", STATUS_COLOR.amber, "green", STATUS_COLOR.green, "#a8a29e"],
            "line-width": 2.5, "line-opacity": 0.85,
          },
        });
        m.addLayer({
          id: "responder-route-casing", type: "line", source: "responder-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 9 },
        });
        m.addLayer({
          id: "responder-route-dry", type: "line", source: "responder-route", filter: ["!=", ["get", "status"], "red"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": SAFE_ROUTE_COLOR, "line-width": 5 },
        });
        m.addLayer({
          id: "responder-route-wet", type: "line", source: "responder-route", filter: ["==", ["get", "status"], "red"],
          layout: { "line-join": "round" },
          paint: { "line-color": WATER_COLOR, "line-width": 5, "line-dasharray": [1.4, 1.2] },
        });
        m.addLayer({
          id: "responder-points", type: "circle", source: "responder-points",
          paint: {
            "circle-radius": 7,
            "circle-color": ["match", ["get", "kind"], "post", "#1c1917", "#e11d48"],
            "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
          },
        });
        m.addLayer({
          id: "responder-point-labels", type: "symbol", source: "responder-points",
          layout: {
            "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 12,
            "text-offset": [0, 1.3], "text-anchor": "top", "text-allow-overlap": true,
          },
          paint: { "text-color": "#1c1917", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
        });
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      setReady(false);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("responder-streets") as GeoJSONSource | undefined)?.setData(streetsGeoJson(streets, statuses));
  }, [ready, streets, statuses]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    (m.getSource("responder-route") as GeoJSONSource | undefined)?.setData(routeGeoJson(route));
    (m.getSource("responder-points") as GeoJSONSource | undefined)?.setData(pointsGeoJson(route));
    if (route?.found && route.coordinates.length > 1) {
      const lngs = route.coordinates.map((c) => c[0]), lats = route.coordinates.map((c) => c[1]);
      m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 40, maxZoom: 17, duration: 600 });
    } else if (route?.destination) {
      m.easeTo({ center: route.destination, zoom: 16, duration: 600 });
    }
  }, [ready, route]);

  return <div ref={container} className={`w-full h-64 rounded-lg overflow-hidden bg-stone-200 ${className}`} />;
}
