"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import { coveredSegments, insideCoverage, type Coordinate, type CoverageArea, type CoverageMatch } from "@/lib/engine/coverage";
import { parseRouteTownship } from "@/lib/engine/township";
import type { Language } from "@/lib/language";
import "maplibre-gl/dist/maplibre-gl.css";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
export default function ResidentCoverageMap({ areas, selection, point, focusSlug, onPick, language, children }: {
  areas: CoverageArea[]; selection: CoverageMatch | null; point: Coordinate | null;
  focusSlug: string | null; onPick?: (point: Coordinate) => void; language: Language; children?: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null), map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const onPickRef = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);
  const fitKey = useRef("");
  const bm = language === "bm";
  const containing = point ? areas.find((area) => insideCoverage(area, point)) : null;
  const roadArea = selection?.area.slug ?? focusSlug ?? containing?.slug ?? null;
  const [roads, setRoads] = useState<{ slug: string; data: GeoJSON.FeatureCollection; failed: boolean } | null>(null);
  useEffect(() => {
    if (!roadArea) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/township/shared?area=${encodeURIComponent(roadArea)}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error("Roads unavailable");
        const bundle = parseRouteTownship(await response.json());
        const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: bundle.streets.features.flatMap((street) => {
          const segments = coveredSegments(street, bundle.area);
          return segments.length ? [{ type: "Feature" as const, properties: {}, geometry: { type: "MultiLineString" as const,
            coordinates: segments.map((segment) => [segment.a, segment.b]) } }] : [];
        }) };
        if (!controller.signal.aborted) setRoads({ slug: roadArea, data, failed: false });
      } catch { if (!controller.signal.aborted) setRoads({ slug: roadArea, data: EMPTY, failed: true }); }
    })();
    return () => controller.abort();
  }, [roadArea]);
  useEffect(() => {
    let active = true, instance: LibreMap | null = null;
    void import("maplibre-gl").then(({ Map, NavigationControl, setWorkerUrl }) => {
      if (!active || !container.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      instance = new Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/positron",
        center: [101.65, 3.02], zoom: 10, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: false });
      map.current = instance;
      instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
      instance.on("error", () => { if (active) setFailed(true); });
      instance.on("click", (event) => onPickRef.current?.([event.lngLat.lng, event.lngLat.lat]));
      instance.on("load", () => {
        if (!active || !instance) return;
        const label = instance.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
        instance.addSource("resident-coverage", { type: "geojson", data: EMPTY });
        instance.addSource("resident-location", { type: "geojson", data: EMPTY });
        instance.addSource("resident-loaded-roads", { type: "geojson", data: EMPTY });
        instance.addLayer({ id: "resident-coverage-fill", type: "fill", source: "resident-coverage",
          paint: { "fill-color": "#7c3aed", "fill-opacity": ["case", ["get", "selected"], 0.16, 0.06] } }, label);
        instance.addLayer({ id: "resident-coverage-edge", type: "line", source: "resident-coverage",
          paint: { "line-color": "#7c3aed", "line-width": 2, "line-dasharray": [3, 2] } }, label);
        instance.addLayer({ id: "resident-loaded-roads", type: "line", source: "resident-loaded-roads",
          paint: { "line-color": "#0369a1", "line-width": 3, "line-opacity": 0.9 } }, label);
        instance.addLayer({ id: "resident-location-point", type: "circle", source: "resident-location", paint: {
          "circle-radius": ["case", ["get", "anchor"], 7, 5], "circle-color": ["case", ["get", "anchor"], "#1c1917", "#d97706"],
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
        } });
        setReady(true);
      });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; instance?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("resident-loaded-roads") as GeoJSONSource).setData(roads?.slug === roadArea ? roads.data : EMPTY);
  }, [ready, roads, roadArea]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const displayed = selection && !areas.some((area) => area.slug === selection.area.slug) ? [...areas, selection.area] : areas;
    const coverage: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: displayed.map((area) => {
      const [south, west, north, east] = area.bbox;
      return { type: "Feature", properties: { selected: selection?.area.slug === area.slug },
        geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] } };
    }) };
    const points: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [
      ...(point ? [{ type: "Feature" as const, properties: { anchor: false }, geometry: { type: "Point" as const, coordinates: point } }] : []),
      ...(selection ? [{ type: "Feature" as const, properties: { anchor: true }, geometry: { type: "Point" as const, coordinates: selection.coordinate } }] : []),
    ] };
    (m.getSource("resident-coverage") as GeoJSONSource).setData(coverage);
    (m.getSource("resident-location") as GeoJSONSource).setData(points);
    // Result and catalogue polls must not reset a manually panned map.
    const containing = point ? displayed.find((area) => insideCoverage(area, point)) : null;
    // Keep a rejected pin in view; it must not zoom back out to all townships.
    if (point && !selection && !focusSlug && !containing) return;
    const key = selection?.area.slug ?? focusSlug ?? containing?.slug ?? "all";
    if (fitKey.current === key) return;
    const frame = key === "all" ? displayed : displayed.filter((area) => area.slug === key);
    if (!frame.length) return;
    fitKey.current = key;
    m.fitBounds([
      [Math.min(...frame.map((a) => a.bbox[1])), Math.min(...frame.map((a) => a.bbox[0]))],
      [Math.max(...frame.map((a) => a.bbox[3])), Math.max(...frame.map((a) => a.bbox[2]))],
    ], { padding: 28, maxZoom: 15, duration: 0 });
  }, [areas, selection, point, focusSlug, ready]);
  return <div className="space-y-2">
    <div ref={container} role="region" aria-label={bm ? "Peta liputan HydroTwin" : "HydroTwin coverage map"} className="h-64 w-full overflow-hidden rounded-lg bg-stone-200" />
    {children}
    {onPick && <button type="button" disabled={!ready} onClick={() => { const center = map.current?.getCenter(); if (center) onPick([center.lng, center.lat]); }} className="min-h-11 w-full rounded-lg border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-900 disabled:opacity-50">{bm ? "Semak titik di tengah peta" : "Check the centre of the map"}</button>}
    {failed && <p role="status" className="text-xs text-amber-900">{bm ? "Sebahagian peta tidak tersedia. Gunakan carian jalan jika perlu." : "Some map resources are unavailable. Street search is still available."}</p>}
    <p className="text-[11px] text-stone-600">{bm ? "Garis biru: jalan yang dimuatkan, bukan status banjir. Batas ungu: kawasan demo. Titik hitam: titik permulaan yang boleh disahkan. Jingga: pin anda sahaja." : "Blue lines: loaded roads, not flood status. Purple outline: demo boundary. Black: matched starting point. Orange: your pin only."}</p>
    {!roadArea && <p className="text-xs text-stone-600">{bm ? "Zum ke kawasan liputan untuk melihat jalan yang dimuatkan." : "Zoom to a coverage area to see its loaded roads."}</p>}
    {roadArea && roads?.slug !== roadArea && <p role="status" className="text-xs text-stone-600">{bm ? "Memuatkan jalan yang boleh dipilih…" : "Loading selectable roads…"}</p>}
    {roads?.slug === roadArea && roads.failed && <p role="status" className="text-xs text-amber-900">{bm ? "Jalan yang boleh dipilih tidak dapat dipaparkan. Cuba carian jalan." : "Selectable roads could not be displayed. Try street search."}</p>}
    <p className="text-[10px] text-stone-500">Map © OpenStreetMap contributors (ODbL) · OpenFreeMap / OpenMapTiles · MapLibre</p>
  </div>;
}
