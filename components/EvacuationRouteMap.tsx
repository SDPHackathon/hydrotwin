"use client";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import type { StreetFeature } from "@/lib/engine/route";
import { eligibleDestinations, type RouteEnvelope } from "@/lib/engine/evacuation";
import { anchor } from "@/lib/engine/route";
import "maplibre-gl/dist/maplibre-gl.css";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
export default function EvacuationRouteMap({ streets, envelope, language = "en" }: { streets: StreetFeature[]; envelope: RouteEnvelope; language?: "en" | "bm" }) {
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
          "circle-radius": 8, "circle-color": ["match", ["get", "kind"], "origin", "#1c1917", "available", "#15803d", "#78716c"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
        } });
        instance.addLayer({ id: "evac-point-labels", type: "symbol", source: "evac-points", layout: {
          "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.4], "text-anchor": "top",
        }, paint: { "text-color": "#1c1917", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
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
    const current = envelope.conditions === "current" || envelope.conditions === "frozen";
    const eligible = new Set(current && envelope.catalogue ? eligibleDestinations(envelope.catalogue,
      Object.fromEntries(Object.entries(envelope.statuses).map(([id, s]) => [id, s.status])), streets, envelope.calculated_at).map(d => d.id) : []);
    const points: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [
      ...(route.origin ? [{ type: "Feature" as const, properties: { kind: "origin", label: language === "bm" ? "Lokasi anda" : "Your location" }, geometry: { type: "Point" as const, coordinates: route.origin } }] : []),
      ...(envelope.catalogue?.destinations.flatMap(d => {
        const coordinates = anchor(streets.find(s => s.properties.id === d.street_id), d.position);
        const available = eligible.has(d.id);
        return coordinates ? [{ type: "Feature" as const, properties: { kind: available ? "available" : "unavailable",
          label: available ? (language === "bm" ? "Titik selamat" : "Safe point") : (language === "bm" ? "Tidak tersedia" : "Unavailable") },
          geometry: { type: "Point" as const, coordinates } }] : [];
      }) ?? []),
    ] };
    (m.getSource("evac-streets") as GeoJSONSource)?.setData(roads);
    (m.getSource("evac-route") as GeoJSONSource)?.setData(line);
    (m.getSource("evac-points") as GeoJSONSource)?.setData(points);
    const nextFit = `${envelope.resident_id}:${route.origin?.join()}:${route.found ? route.destination_id : "overview"}:${envelope.catalogue_revision}`;
    const framing = route.found ? route.coordinates : points.features.map(f => f.geometry.coordinates);
    if (framing.length && nextFit !== fitKey.current) {
      fitKey.current = nextFit;
      const xs = framing.map((c) => c[0]), ys = framing.map((c) => c[1]);
      m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 35, maxZoom: 16, duration: 0 });
    }
  }, [ready, streets, envelope, language]);
  return <div className="space-y-1">
    <div ref={container} role="region" aria-label="Simulated evacuation route map" className="h-60 w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-100" />
    {failed && <p className="text-xs text-amber-900">Some map resources are unavailable. Read the route status below; help remains available.</p>}
  </div>;
}
