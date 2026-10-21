"use client";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import type { StreetFeature } from "@/lib/engine/route";
import type { RouteEnvelope } from "@/lib/engine/evacuation";
import "maplibre-gl/dist/maplibre-gl.css";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
export default function EvacuationRouteMap({ streets, envelope }: { streets: StreetFeature[]; envelope: RouteEnvelope }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fitKey = useRef("");
  const initialCenter = useRef<[number, number]>(envelope.route.origin ?? (streets[0]?.geometry.coordinates[0] as [number, number] | undefined) ?? [101.43925, 3.0865]);
  useEffect(() => {
    let active = true;
    let instance: LibreMap | null = null;
    void import("maplibre-gl").then(({ Map, setWorkerUrl }) => {
      if (!active || !container.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      instance = new Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/positron",
        center: initialCenter.current, zoom: 14, cooperativeGestures: true, dragRotate: false, attributionControl: { compact: true } });
      map.current = instance;
      instance.on("error", () => { if (active) setFailed(true); });
      instance.on("load", () => {
        if (!instance || !active) return;
        const label = instance.getStyle().layers.find((l) => l.type === "symbol")?.id;
        for (const id of ["evac-streets", "evac-route", "evac-points"]) instance.addSource(id, { type: "geojson", data: EMPTY });
        instance.addLayer({ id: "evac-streets", type: "line", source: "evac-streets", paint: {
          "line-color": ["match", ["get", "status"], "green", "#059669", "amber", "#d97706", "red", "#e11d48", "#a8a29e"], "line-width": 3,
        } }, label);
        instance.addLayer({ id: "evac-casing", type: "line", source: "evac-route", paint: { "line-color": "#ffffff", "line-width": 9 } }, label);
        instance.addLayer({ id: "evac-route", type: "line", source: "evac-route", paint: { "line-color": "#6d28d9", "line-width": 5 } }, label);
        instance.addLayer({ id: "evac-points", type: "circle", source: "evac-points", paint: {
          "circle-radius": 7, "circle-color": ["match", ["get", "kind"], "origin", "#1c1917", "#7c3aed"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
        } });
        setReady(true);
      });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; instance?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const route = envelope.route;
    const roads: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: streets.map((s) => ({ type: "Feature", geometry: s.geometry as GeoJSON.LineString,
      properties: { status: envelope.statuses[s.properties.drain_id]?.status ?? "unknown" } })) };
    const line: GeoJSON.FeatureCollection = route.found && route.coordinates.length > 1 ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.coordinates } }] } : EMPTY;
    const points: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: route.found ? [
      { type: "Feature", properties: { kind: "origin" }, geometry: { type: "Point", coordinates: route.origin! } },
      { type: "Feature", properties: { kind: "destination" }, geometry: { type: "Point", coordinates: route.destination! } },
    ] : [] };
    (m.getSource("evac-streets") as GeoJSONSource)?.setData(roads);
    (m.getSource("evac-route") as GeoJSONSource)?.setData(line);
    (m.getSource("evac-points") as GeoJSONSource)?.setData(points);
    const nextFit = `${envelope.resident_id}:${route.origin?.join()}:${route.destination_id}`;
    if (route.found && nextFit !== fitKey.current) {
      fitKey.current = nextFit;
      const xs = route.coordinates.map((c) => c[0]), ys = route.coordinates.map((c) => c[1]);
      m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 35, maxZoom: 16, duration: 0 });
    }
  }, [ready, streets, envelope]);
  return <div className="space-y-1">
    <div ref={container} role="region" aria-label="Simulated evacuation route map" className="h-60 w-full overflow-hidden rounded-lg bg-stone-200" />
    {failed && <p className="text-xs text-amber-900">Some map resources are unavailable. Read the route status below; help remains available.</p>}
    <p className="text-[10px] text-stone-500">Map © OpenStreetMap contributors (ODbL) · OpenFreeMap / OpenMapTiles · MapLibre</p>
  </div>;
}
