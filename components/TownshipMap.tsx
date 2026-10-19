"use client";

// 3D township map. Streets and drains are coloured with feature-state, so a status change
// never reloads the data. Water slabs (flood-zones.geojson) rise with each drain's overflow.
// Base map: OpenFreeMap (free, no key). No Google/Cesium tiles.

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Area, Streets } from "@/lib/area";
import type { Drain, DrainStatus, PlanIntervention } from "@/lib/engine/types";
import { DEVELOPMENT_ACCESS_COLOR, SAFE_ROUTE_COLOR, STATUS_COLOR, WATER_COLOR } from "@/lib/colors";
import { makeInterventionsGeoJson } from "@/lib/interventions-geojson";
import { slabHeights } from "@/lib/water";
import type { RoadPoint } from "@/lib/engine/route";
import type { SitePoint } from "@/lib/engine/development";
import DevelopmentFlowOverlay from "@/components/DevelopmentFlowOverlay";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";

type Props = {
  area: Area;
  drains: Drain[];
  streets: Streets;
  statuses: Record<string, DrainStatus>;
  buildings?: GeoJSON.FeatureCollection;
  floodZones?: GeoJSON.FeatureCollection;
  interventions?: PlanIntervention[];
  safeRoute?: [number, number][] | null;
  routeOrigin?: [number, number] | null;
  routeDestination?: [number, number] | null;
  onDrainClick?: (drainId: string) => void;
  onRoutePick?: (point: RoadPoint | null) => void;
  siteBoundary?: SitePoint[];
  siteClosed?: boolean;
  siteCaption?: string;
  siteAccessRoad?: string;
  siteDrainId?: string;
  onSitePick?: (point: SitePoint) => void;
};

const byStatus = (fallback: string) => [
  "match",
  ["coalesce", ["feature-state", "status"], "green"],
  "red",
  STATUS_COLOR.red,
  "amber",
  STATUS_COLOR.amber,
  "unknown",
  "#a8a29e",
  fallback,
];

function drainPoints(drains: Drain[]): GeoJSON.Feature[] {
  return drains.map((d) => ({
    type: "Feature",
    properties: { id: d.id },
    geometry: { type: "Point", coordinates: [d.lng, d.lat] },
  }));
}

export default function TownshipMap({
  area,
  drains,
  streets,
  statuses,
  buildings,
  floodZones,
  interventions = [],
  safeRoute = null,
  routeOrigin = null,
  routeDestination = null,
  onDrainClick,
  onRoutePick,
  siteBoundary,
  siteClosed,
  siteCaption,
  siteAccessRoad,
  siteDrainId,
  onSitePick,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const lastRoute = useRef("");
  const onDrainClickRef = useRef(onDrainClick);
  const onRoutePickRef = useRef(onRoutePick);
  const onSitePickRef = useRef(onSitePick);
  useEffect(() => {
    onSitePickRef.current = onSitePick;
    if (map.current) {
      map.current.getCanvas().style.cursor = onSitePick || onRoutePick ? "crosshair" : "";
      if (onSitePick) map.current.doubleClickZoom.disable();
      else map.current.doubleClickZoom.enable();
    }
  }, [onSitePick, onRoutePick]);
  useEffect(() => {
    onRoutePickRef.current = onRoutePick;
  }, [onRoutePick]);
  useEffect(() => {
    onDrainClickRef.current = onDrainClick;
  }, [onDrainClick]);
  const [ready, setReady] = useState(false);
  const [flowMap, setFlowMap] = useState<MapLibreMap | null>(null);
  // Interventions only change a drain's outflow/catchment, never its position → the map must not be
  // rebuilt when `drains` changes. The load handler reads this ref; a separate effect refreshes the source.
  const drainsRef = useRef(drains);
  useEffect(() => {
    drainsRef.current = drains;
  }, [drains]);

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
        m.addSource("buildings", {
          type: "geojson",
          data: buildings ?? `/data/${area.slug}/buildings.geojson`,
        });
        // One feature per drain zone and band ("D07-road", "D07-yard"); height arrives via updateData.
        m.addSource("flood-zones", {
          type: "geojson",
          data: floodZones ?? `/data/${area.slug}/flood-zones.geojson`,
          promoteId: "id",
        });

        // Plan Mode Interventions source
        m.addSource("interventions", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Safe Evacuation Route source
        m.addSource("safe-route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        m.addSource("drains", {
          type: "geojson",
          promoteId: "id",
          data: {
            type: "FeatureCollection",
            features: drainPoints(drainsRef.current),
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

        // Safe Evacuation Route Line
        m.addLayer({
          id: "safe-route-casing",
          type: "line",
          source: "safe-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 10,
            "line-opacity": 0.95,
          },
        });
        m.addLayer({
          id: "safe-route-line",
          type: "line",
          source: "safe-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": SAFE_ROUTE_COLOR,
            "line-width": 6,
            "line-opacity": 0.95,
          },
        });

        // Plan Mode Layers: Green Parks & Retention Ponds
        m.addSource("route-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({
          id: "route-point-circles", type: "circle", source: "route-points",
          paint: { "circle-radius": 11, "circle-color": SAFE_ROUTE_COLOR, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
        });
        m.addLayer({
          id: "route-point-labels", type: "symbol", source: "route-points",
          layout: { "text-field": ["get", "label"], "text-size": 13, "text-allow-overlap": true },
          paint: { "text-color": "#ffffff" },
        });

        // Plan Mode Layers: Green Parks & Retention Ponds
        m.addLayer({
          id: "interventions-green",
          type: "fill",
          source: "interventions",
          filter: ["==", ["get", "kind"], "green_area"],
          paint: {
            "fill-color": "#16a34a",
            "fill-opacity": 0.45,
          },
        });
        m.addLayer({
          id: "interventions-green-line",
          type: "line",
          source: "interventions",
          filter: ["==", ["get", "kind"], "green_area"],
          paint: {
            "line-color": "#15803d",
            "line-width": 2,
            "line-dasharray": [3, 2],
          },
        });

        m.addLayer({
          id: "interventions-ponds",
          type: "fill",
          source: "interventions",
          filter: ["==", ["get", "kind"], "retention_pond"],
          paint: {
            "fill-color": "#0284c7",
            "fill-opacity": 0.7,
          },
        });
        m.addLayer({
          id: "interventions-ponds-line",
          type: "line",
          source: "interventions",
          filter: ["==", ["get", "kind"], "retention_pond"],
          paint: {
            "line-color": "#0369a1",
            "line-width": 2,
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

        // A zero-height extrusion still paints its top face on the ground, so dry zones are filtered out.
        m.addLayer({
          id: "flood-water",
          type: "fill-extrusion",
          source: "flood-zones",
          filter: [">", ["coalesce", ["get", "h"], 0], 0],
          paint: {
            "fill-extrusion-color": WATER_COLOR,
            "fill-extrusion-height": ["coalesce", ["get", "h"], 0],
            "fill-extrusion-opacity": 0.55,
          },
        });

        // Plan Mode Upgraded Culvert Highlight Ring
        m.addLayer({
          id: "interventions-culverts",
          type: "circle",
          source: "interventions",
          filter: ["==", ["get", "kind"], "bigger_drain"],
          paint: {
            "circle-radius": 19,
            "circle-color": "transparent",
            "circle-stroke-color": "#f59e0b",
            "circle-stroke-width": 3.5,
          },
        });

        m.addLayer({
          // Fill ring: the outer ring shows status, the blue dot inside grows as the drain fills.
          id: "drain-ring",
          type: "circle",
          source: "drains",
          paint: {
            "circle-radius": 14,
            "circle-color": "#ffffff",
            "circle-opacity": 0.95,
            "circle-stroke-color": byStatus(STATUS_COLOR.green) as never,
            "circle-stroke-width": 3.5,
          },
        });
        m.addLayer({
          id: "drain-fill",
          type: "circle",
          source: "drains",
          paint: {
            "circle-radius": ["*", 12, ["coalesce", ["feature-state", "fill"], 0]],
            "circle-color": WATER_COLOR,
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
            "text-offset": [0, 1.9],
          },
          paint: { "text-color": "#1c1917", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
        });

        // Click on drain ring
        m.on("click", "drain-ring", (e) => {
          if (onRoutePickRef.current || onSitePickRef.current) return;
          const id = e.features?.[0]?.properties?.id;
          if (id && onDrainClickRef.current) {
            onDrainClickRef.current(id);
          }
        });
        m.on("mouseenter", "drain-ring", () => {
          m.getCanvas().style.cursor = onRoutePickRef.current || onSitePickRef.current ? "crosshair" : "pointer";
        });
        m.on("mouseleave", "drain-ring", () => {
          m.getCanvas().style.cursor = onRoutePickRef.current || onSitePickRef.current ? "crosshair" : "";
        });

        m.on("click", (e) => {
          if (onSitePickRef.current) { onSitePickRef.current([e.lngLat.lng, e.lngLat.lat]); return; }
          if (!onRoutePickRef.current) return;
          let nearest: RoadPoint | null = null;
          let best = 24 * 24;
          for (const street of streets.features) {
            const coords = street.geometry.coordinates;
            for (let i = 0; i + 1 < coords.length; i++) {
              const a = m.project(coords[i] as [number, number]);
              const b = m.project(coords[i + 1] as [number, number]);
              const dx = b.x - a.x, dy = b.y - a.y;
              const size = dx * dx + dy * dy;
              if (!size) continue;
              const t = Math.max(0, Math.min(1, ((e.point.x - a.x) * dx + (e.point.y - a.y) * dy) / size));
              const x = a.x + t * dx, y = a.y + t * dy;
              const d = (e.point.x - x) ** 2 + (e.point.y - y) ** 2;
              if (d >= best) continue;
              const projected = m.unproject([x, y]);
              const lng = coords[i + 1][0] - coords[i][0], lat = coords[i + 1][1] - coords[i][1];
              const fraction = Math.max(0, Math.min(1, ((projected.lng - coords[i][0]) * lng + (projected.lat - coords[i][1]) * lat) / (lng * lng + lat * lat)));
              best = d;
              nearest = { street_id: street.properties.id, position: { segment_index: i, fraction } };
            }
          }
          onRoutePickRef.current(nearest);
        });

        m.addSource("development-site", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        const firstLabel = m.getStyle().layers.find(layer => layer.type === "symbol")?.id;
        m.addLayer({ id: "development-fill", type: "fill", source: "development-site", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#6366f1", "fill-opacity": 0.16 } }, firstLabel);
        m.addLayer({ id: "development-outline", type: "line", source: "development-site", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#4f46e5", "line-width": 3, "line-dasharray": [2, 1] } });
        m.addLayer({ id: "development-corners", type: "circle", source: "development-site", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#4f46e5", "circle-stroke-width": 2 } });
        m.addSource("development-access", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "development-access-casing", type: "line", source: "development-access", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 11 } });
        m.addLayer({ id: "development-access-line", type: "line", source: "development-access", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": DEVELOPMENT_ACCESS_COLOR, "line-width": 6 } });
        setFlowMap(m);
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      setReady(false);
      setFlowMap(null);
      map.current?.remove();
      map.current = null;
    };
  }, [area, streets, buildings, floodZones]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const points = siteBoundary ?? [];
    const features: GeoJSON.Feature[] = points.map(coordinates => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates } }));
    if (points.length >= 3 && siteClosed) features.unshift({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...points, points[0]]] } });
    else if (points.length >= 2) features.unshift({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } });
    m.getSource<GeoJSONSource>("development-site")?.setData({ type: "FeatureCollection", features });
    m.getSource<GeoJSONSource>("development-access")?.setData({ type: "FeatureCollection", features: streets.features.filter(s => s.properties.id === siteAccessRoad) });
  }, [ready, siteBoundary, siteClosed, siteAccessRoad, streets]);

  // Drains changed (e.g. township switch) → refresh the points in place.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.getSource<GeoJSONSource>("drains")?.setData({ type: "FeatureCollection", features: drainPoints(drains) });
  }, [ready, drains]);

  // Update interventions GeoJSON whenever interventions change
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const source = m.getSource("interventions") as GeoJSONSource | undefined;
    if (source) {
      source.setData(makeInterventionsGeoJson(drains, interventions));
    }
  }, [drains, interventions, ready]);

  // Update safe evacuation route GeoJSON
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const source = m.getSource("safe-route") as GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features:
          safeRoute && safeRoute.length > 1
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: safeRoute,
                  },
                },
              ]
            : [],
      });
    }
    const points = m.getSource("route-points") as GeoJSONSource | undefined;
    points?.setData({
      type: "FeatureCollection",
      features: [
        ...(routeOrigin ? [{ type: "Feature" as const, properties: { label: "O" }, geometry: { type: "Point" as const, coordinates: routeOrigin } }] : []),
        ...(routeDestination ? [{ type: "Feature" as const, properties: { label: "D" }, geometry: { type: "Point" as const, coordinates: routeDestination } }] : []),
      ],
    });
    const routeKey = JSON.stringify(safeRoute);
    if (safeRoute?.length && routeKey !== lastRoute.current) {
      const lngs = safeRoute.map((point) => point[0]);
      const lats = safeRoute.map((point) => point[1]);
      m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
        padding: 45, maxZoom: 16, duration: 500,
      });
    }
    lastRoute.current = routeKey;
  }, [ready, safeRoute, routeOrigin, routeDestination]);

  // Push the latest status into feature-state — cheap, no data reload.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const f of streets.features) {
      const s = statuses[f.properties.drain_id];
      m.setFeatureState({ source: "streets", id: f.properties.id }, { status: s?.status ?? "unknown", depth: s?.street_depth_cm ?? 0 });
    }
    const update = [];
    for (const d of drains) {
      const s = statuses[d.id];
      m.setFeatureState({ source: "drains", id: d.id }, { status: s?.status ?? "unknown", fill: s ? Math.min(1, s.level_cm / d.bank_cm) : 0 });
      const h = slabHeights(s?.street_depth_cm ?? 0);
      update.push(
        { id: `${d.id}-road`, addOrUpdateProperties: [{ key: "h", value: h.road }] },
        { id: `${d.id}-yard`, addOrUpdateProperties: [{ key: "h", value: h.yard }] },
      );
    }
    // Properties (not feature-state) because the layer filter has to see them.
    m.getSource<GeoJSONSource>("flood-zones")?.updateData({ update });
  }, [ready, statuses, streets, drains]);

  const flowDrain = siteDrainId ? drains.find(drain => drain.id === siteDrainId) : undefined;
  return <div className="relative h-full min-h-0 w-full"><div ref={container} className="h-full w-full" />{ready && flowMap && siteClosed && siteBoundary && siteBoundary.length >= 3 && flowDrain && <DevelopmentFlowOverlay map={flowMap} boundary={siteBoundary} drain={flowDrain} />}{siteCaption && <div className="pointer-events-none absolute bottom-16 left-3 right-3 max-w-lg rounded-lg border border-indigo-200 bg-white/95 px-3 py-2 text-xs text-stone-800 shadow-sm"><strong>Development scenario</strong><br />{siteCaption}<br /><span className="text-stone-500">Indigo: proposed site · dark line with white outline: selected access road. Zone street depths only.</span></div>}</div>;
}
