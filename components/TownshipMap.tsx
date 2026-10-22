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
import StormRainOverlay from "@/components/StormRainOverlay";
import type { StormPresentation } from "@/lib/storm-presentation";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";
type MapDestination = { id: string; name: string; point: [number, number]; available: boolean; selected: boolean };

type Props = {
  storm?: StormPresentation;
  area: Area;
  drains: Drain[];
  streets: Streets;
  statuses: Record<string, DrainStatus>;
  buildings?: GeoJSON.FeatureCollection;
  floodZones?: GeoJSON.FeatureCollection;
  interventions?: PlanIntervention[];
  withUpgrades?: boolean;
  safeRoute?: [number, number][] | null;
  routeOrigin?: [number, number] | null;
  routeDestination?: [number, number] | null;
  suggestedDestinations?: MapDestination[];
  onDestinationClick?: (id: string) => void;
  onDrainClick?: (drainId: string) => void;
  onRoutePick?: (point: RoadPoint | null) => void;
  siteBoundary?: SitePoint[];
  siteClosed?: boolean;
  siteCaption?: string;
  siteAccessRoad?: string;
  siteDrainId?: string;
  onSitePick?: (point: SitePoint) => void;
  trafficData?: GeoJSON.FeatureCollection;
  onTrafficPick?: (id: string) => void;
  sites?: Array<{
    id: string;
    name: string;
    boundary: SitePoint[];
    color?: string;
    access?: string;
    closed?: boolean;
  }>;
};

const byStatus = (fallback: string) => [
  "match",
  ["coalesce", ["feature-state", "status"], "unknown"],
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

interface HoveredUpgradeInfo {
  drainId: string;
  areaSlug: string;
  x: number;
  y: number;
  above: boolean;
  width: number;
}

export default function TownshipMap({
  area,
  drains,
  streets,
  statuses,
  buildings,
  floodZones,
  interventions = [],
  withUpgrades = false,
  safeRoute = null,
  routeOrigin = null,
  routeDestination = null,
  suggestedDestinations,
  onDestinationClick,
  onDrainClick,
  onRoutePick,
  siteBoundary,
  siteClosed,
  siteCaption,
  siteAccessRoad,
  siteDrainId,
  onSitePick,
  trafficData,
  onTrafficPick,
  sites,
  storm,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const lastRoute = useRef("");
  const onDrainClickRef = useRef(onDrainClick);
  const onDestinationClickRef = useRef(onDestinationClick);
  useEffect(() => { onDestinationClickRef.current = onDestinationClick; }, [onDestinationClick]);
  // Compare marker content so ordinary clock ticks do not rebuild DOM markers.
  const destinationKey = JSON.stringify(suggestedDestinations ?? []);
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
  const [hoveredUpgrade, setHoveredUpgrade] = useState<HoveredUpgradeInfo | null>(null);
  const interventionKey = JSON.stringify(interventions);


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
          layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-allow-overlap": true },
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

        for (const layerId of ["interventions-culverts", "interventions-ponds", "interventions-green"]) {
          m.on("click", layerId, (e) => {
            if (onRoutePickRef.current || onSitePickRef.current) return;
            const id = e.features?.[0]?.properties?.drain_id;
            if (id && onDrainClickRef.current) {
              onDrainClickRef.current(id);
            }
          });
        }

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
        m.addLayer({ id: "development-fill", type: "fill", source: "development-site", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": ["coalesce", ["get", "color"], "#6366f1"], "fill-opacity": 0.2 } }, firstLabel);
        m.addLayer({ id: "development-outline", type: "line", source: "development-site", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": ["coalesce", ["get", "color"], "#4f46e5"], "line-width": 3, "line-dasharray": [2, 1] } });
        m.addLayer({ id: "development-corners", type: "circle", source: "development-site", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": ["coalesce", ["get", "color"], "#4f46e5"], "circle-stroke-width": 2 } });
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
    if (!ready || !m || !withUpgrades) return;
    const activeInterventions = JSON.parse(interventionKey) as PlanIntervention[];
    const layers = ["drain-ring", "drain-fill", "drain-labels", "interventions-culverts", "interventions-ponds", "interventions-green"];
    const clearHover = () => {
      setHoveredUpgrade(previous => previous === null ? previous : null);
      m.getCanvas().style.cursor = onRoutePickRef.current || onSitePickRef.current ? "crosshair" : "";
    };
    const onHover = (event: import("maplibre-gl").MapMouseEvent) => {
      if (m.isMoving() || onRoutePickRef.current || onSitePickRef.current) { clearHover(); return; }
      // Query the entire target once: crossing a fill/ring/label must not trigger competing leave timers.
      const feature = m.queryRenderedFeatures(event.point, { layers })[0];
      // Intervention feature IDs identify shapes (e.g. pond-D07), not their owning drain.
      const drainId = feature?.properties?.drain_id ?? feature?.properties?.id;
      const drain = drains.find(item => item.id === drainId);
      if (!drain || !activeInterventions.some(item => item.drain_id === drainId)) { clearHover(); return; }
      const point = m.project([drain.lng, drain.lat]);
      const width = Math.min(224, m.getCanvas().clientWidth - 24);
      const x = Math.max(12, Math.min(point.x - width / 2, m.getCanvas().clientWidth - width - 12));
      // Leave room for the township picker and map controls along the top edge.
      const above = point.y >= 210;
      const y = point.y + (above ? -26 : 30);
      m.getCanvas().style.cursor = "pointer";
      // The card is anchored to the drain, so pointer motion within one target needs no render.
      setHoveredUpgrade(previous => previous && previous.drainId === drainId && previous.x === x && previous.y === y
        ? previous : { drainId, areaSlug: area.slug, x, y, above, width });
    };
    m.on("mousemove", onHover);
    m.on("mouseout", clearHover);
    m.on("movestart", clearHover);
    m.on("resize", clearHover);
    return () => {
      m.off("mousemove", onHover);
      m.off("mouseout", clearHover);
      m.off("movestart", clearHover);
      m.off("resize", clearHover);
      clearHover();
    };
  }, [ready, withUpgrades, interventionKey, drains, area.slug]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (sites && sites.length > 0) {
      const features: GeoJSON.Feature[] = [];
      const accessFeatures: GeoJSON.Feature[] = [];
      for (const s of sites) {
        const points = s.boundary ?? [];
        const color = s.color || "#4f46e5";
        for (const coordinates of points) {
          features.push({ type: "Feature", properties: { color, id: s.id }, geometry: { type: "Point", coordinates } });
        }
        if (points.length >= 3 && s.closed !== false) {
          features.unshift({ type: "Feature", properties: { color, id: s.id }, geometry: { type: "Polygon", coordinates: [[...points, points[0]]] } });
        } else if (points.length >= 2) {
          features.unshift({ type: "Feature", properties: { color, id: s.id }, geometry: { type: "LineString", coordinates: points } });
        }
        if (s.access) {
          const match = streets.features.find(st => st.properties.id === s.access);
          if (match) accessFeatures.push(match);
        }
      }
      m.getSource<GeoJSONSource>("development-site")?.setData({ type: "FeatureCollection", features });
      m.getSource<GeoJSONSource>("development-access")?.setData({ type: "FeatureCollection", features: accessFeatures });
      return;
    }
    const points = siteBoundary ?? [];
    const features: GeoJSON.Feature[] = points.map(coordinates => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates } }));
    if (points.length >= 3 && siteClosed) features.unshift({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...points, points[0]]] } });
    else if (points.length >= 2) features.unshift({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } });
    m.getSource<GeoJSONSource>("development-site")?.setData({ type: "FeatureCollection", features });
    m.getSource<GeoJSONSource>("development-access")?.setData({ type: "FeatureCollection", features: streets.features.filter(s => s.properties.id === siteAccessRoad) });
  }, [ready, siteBoundary, siteClosed, siteAccessRoad, streets, sites]);

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

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let cancelled = false;
    const markers: import("maplibre-gl").Marker[] = [];
    void import("maplibre-gl").then(({ Marker }) => {
      if (cancelled) return;
      for (const d of JSON.parse(destinationKey) as MapDestination[]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "flex items-center gap-1 rounded-full border-2 bg-white px-2 py-1 text-xs font-bold shadow-md";
        button.style.borderColor = d.selected ? SAFE_ROUTE_COLOR : d.available ? "#15803d" : "#78716c";
        button.style.color = d.available ? "#166534" : "#57534e";
        button.style.cursor = d.available ? "pointer" : "default";
        button.textContent = `${d.available ? "⚑" : "⊘"} ${d.available ? "Safe point" : "Unavailable"}`;
        button.title = `${d.name} — ${d.available ? "Safe point · simulation only. Click to select." : "Currently unavailable in the simulation."}`;
        button.setAttribute("aria-label", button.title);
        button.setAttribute("aria-pressed", String(d.selected));
        button.setAttribute("aria-disabled", String(!d.available));
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          if (d.available) onDestinationClickRef.current?.(d.id);
        });
        markers.push(new Marker({ element: button, anchor: "bottom" }).setLngLat(d.point).addTo(m));
      }
    });
    return () => { cancelled = true; markers.forEach(marker => marker.remove()); };
  }, [ready, destinationKey]);

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
    const routeKey = JSON.stringify([routeOrigin, routeDestination]);
    if (safeRoute?.length && routeKey !== lastRoute.current) {
      const lngs = safeRoute.map((point) => point[0]);
      const lats = safeRoute.map((point) => point[1]);
      m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
        padding: 45, maxZoom: 16, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
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
  useEffect(() => {
    const m=map.current;
    if(!ready || !m || !trafficData) return;
    if(!m.getSource('traffic')) {
      m.addSource('traffic',{type:'geojson',data:trafficData});
      m.addLayer({id:'traffic-casing',type:'line',source:'traffic',paint:{'line-color':'#ffffff','line-width':['coalesce',['get','casingWidth'],8],'line-offset':3}});
      m.addLayer({id:'traffic-roads',type:'line',source:'traffic',paint:{'line-color':['get','color'],'line-width':['coalesce',['get','width'],4],'line-offset':3}});
      m.addLayer({id:'traffic-direction',type:'symbol',source:'traffic',layout:{'symbol-placement':'line','symbol-spacing':100,'text-field':'>','text-font':['Noto Sans Regular'],'text-size':18,'text-keep-upright':false,'text-rotation-alignment':'map'},paint:{'text-color':'#ffffff','text-halo-color':['get','color'],'text-halo-width':1}});
    } else m.getSource<GeoJSONSource>('traffic')?.setData(trafficData);
  },[ready,trafficData]);
  useEffect(()=>{
    const m=map.current;
    if(!ready || !m || !trafficData || !onTrafficPick) return;
    const click=(e:import('maplibre-gl').MapLayerMouseEvent)=>{const id=e.features?.[0]?.properties?.id;if(id) onTrafficPick(id);};
    m.on('click','traffic-roads',click);
    return ()=>{m.off('click','traffic-roads',click);};
  },[ready,trafficData,onTrafficPick]);
  const hoveredIntervention = withUpgrades && !onRoutePick && !onSitePick && hoveredUpgrade?.areaSlug === area.slug
    ? interventions.find(item => item.drain_id === hoveredUpgrade.drainId) : undefined;
  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={container} className="h-full w-full" />
      {storm && <StormRainOverlay key={`${area.slug}-${storm.source}`} storm={storm} />}
      {ready && flowMap && siteClosed && siteBoundary && siteBoundary.length >= 3 && flowDrain && (
        <DevelopmentFlowOverlay map={flowMap} boundary={siteBoundary} drain={flowDrain} />
      )}
      {siteCaption && (
        <div className="pointer-events-none absolute bottom-16 left-3 right-3 max-w-lg rounded-lg border border-indigo-200 bg-white/95 px-3 py-2 text-xs text-stone-800 shadow-sm">
          <strong>Development scenario</strong>
          <br />
          {siteCaption}
          <br />
          <span className="text-stone-500">Indigo: proposed site · dark line with white outline: selected access road. Zone street depths only.</span>
        </div>
      )}

      {hoveredIntervention && hoveredUpgrade && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 select-none rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-700 shadow-md"
          style={{ left: hoveredUpgrade.x, top: hoveredUpgrade.y, width: hoveredUpgrade.width, transform: hoveredUpgrade.above ? "translateY(-100%)" : undefined }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold text-stone-900">Drain {hoveredUpgrade.drainId}</span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">With upgrades</span>
          </div>
          <p className="text-sm font-semibold text-stone-900">
            {hoveredIntervention.kind === "bigger_drain" ? "Bigger culvert drain"
              : hoveredIntervention.kind === "retention_pond" ? "Retention pond" : "Green sponge park"}
          </p>
          <p className="mt-1 text-[11px] text-stone-500">
            {hoveredIntervention.kind === "bigger_drain" ? "Outflow ×1.5"
              : hoveredIntervention.kind === "retention_pond" ? "Catchment ×0.6" : "Catchment ×0.8"}
            {" · Demo assumption"}
          </p>
        </div>
      )}
    </div>
  );
}
