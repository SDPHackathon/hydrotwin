"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { LocalTownship } from "@/lib/storage/township-db";
import { saveLocalTownship } from "@/lib/storage/township-db";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";

interface AddTownshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloaded: (township: LocalTownship) => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

const POPULAR_HOTSPOTS = [
  { name: "Kajang, Selangor", lat: 2.9935, lon: 101.7874 },
  { name: "Batu Pahat, Johor", lat: 1.8548, lon: 102.9325 },
  { name: "Cyberjaya, Selangor", lat: 2.9213, lon: 101.6559 },
  { name: "Georgetown, Penang", lat: 5.4141, lon: 100.3288 },
  { name: "Kampung Baru, KL", lat: 3.1625, lon: 101.7061 },
  { name: "Kuantan, Pahang", lat: 3.8077, lon: 103.326 },
];

const STEPS = [
  "Connecting to OpenStreetMap servers...",
  "Extracting road networks & 3D buildings...",
  "Sampling ground elevations (Open-Meteo DEM)...",
  "Clustering 10 drainage zones & flood coefficients...",
  "Constructing 3D water-slab flood zones...",
  "Saving permanently to local device storage...",
];

export default function AddTownshipModal({ isOpen, onClose, onDownloaded }: AddTownshipModalProps) {
  // Form state
  const [name, setName] = useState("Kajang Town, Selangor");
  const [slug, setSlug] = useState("kajang-town");
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Map & Box state
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapLibreMap | null>(null);
  const [boxDimensions, setBoxDimensions] = useState<{ widthKm: number; heightKm: number; diagonalKm: number } | null>(null);

  // Downloading state
  const [downloading, setDownloading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !downloading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, downloading]);

  const updateBoxFromCenter = (lng: number, lat: number, m: MapLibreMap) => {
    const deltaLat = 0.007;
    const deltaLon = 0.0075;
    const s = Math.round((lat - deltaLat) * 1e6) / 1e6;
    const n = Math.round((lat + deltaLat) * 1e6) / 1e6;
    const w = Math.round((lng - deltaLon) * 1e6) / 1e6;
    const e = Math.round((lng + deltaLon) * 1e6) / 1e6;

    const newBbox: [number, number, number, number] = [s, w, n, e];
    setBbox(newBbox);

    const latKm = Math.abs(n - s) * 111;
    const lngKm = Math.abs(e - w) * 111 * Math.cos((lat * Math.PI) / 180);
    const diagonalKm = Math.hypot(latKm, lngKm);
    setBoxDimensions({
      widthKm: Math.round(lngKm * 10) / 10,
      heightKm: Math.round(latKm * 10) / 10,
      diagonalKm: Math.round(diagonalKm * 10) / 10,
    });

    const source = m.getSource("selection-box") as { setData: (data: unknown) => void } | undefined;
    if (source) {
      source.setData({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
      });
    }
  };

  // Search Nominatim with debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 3) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          trimmed,
        )}&countrycodes=my&format=json&limit=5`;
        const res = await fetch(url, {
          headers: { "User-Agent": "hydrotwin/0.1 (SDP University Hackathon prototype)" },
        });
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setSearchResults(data);
        }
      } catch {
        // network error handled gracefully
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Jump map to a coordinate
  const jumpToCoord = (targetLat: number, targetLon: number, locationName: string) => {
    setName(locationName);
    setSlug(
      locationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    );
    setSearchResults([]);
    setSearchQuery("");

    if (mapInstance.current) {
      mapInstance.current.flyTo({ center: [targetLon, targetLat], zoom: 14.5 });
      updateBoxFromCenter(targetLon, targetLat, mapInstance.current);
    }
  };

  // Initialize MapLibre
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;

    let cancelled = false;

    (async () => {
      const { Map, NavigationControl, setWorkerUrl } = await import("maplibre-gl");
      if (cancelled || !mapContainer.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const initialCenter: [number, number] = [101.7874, 2.9935]; // Kajang by default

      const m = new Map({
        container: mapContainer.current,
        style: BASE_STYLE,
        center: initialCenter,
        zoom: 14.2,
      });

      m.addControl(new NavigationControl({ visualizePitch: true }), "top-left");
      mapInstance.current = m;

      m.on("load", () => {
        m.addSource("selection-box", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        m.addLayer({
          id: "selection-fill",
          type: "fill",
          source: "selection-box",
          paint: {
            "fill-color": "#0284c7",
            "fill-opacity": 0.15,
          },
        });

        m.addLayer({
          id: "selection-line",
          type: "line",
          source: "selection-box",
          paint: {
            "line-color": "#0284c7",
            "line-width": 2,
            "line-dasharray": [3, 2],
          },
        });

        updateBoxFromCenter(initialCenter[0], initialCenter[1], m);
      });

      m.on("move", () => {
        const c = m.getCenter();
        updateBoxFromCenter(c.lng, c.lat, m);
      });
    })();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [isOpen]);

  const handleDownload = async () => {
    if (!name.trim() || !bbox) return;

    setDownloading(true);
    setCurrentStep(0);
    setErrorMessage(null);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 2 ? prev + 1 : prev));
    }, 2800);

    try {
      const res = await fetch("/api/township/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, bbox }),
      });

      clearInterval(stepInterval);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to download township");
      }

      setCurrentStep(STEPS.length - 1);

      const localTownship: LocalTownship = {
        slug: json.data.area.slug,
        name: json.data.area.name,
        bbox: json.data.area.bbox,
        center: json.data.area.center,
        attribution: json.data.area.attribution,
        downloadedAt: new Date().toISOString(),
        data: json.data,
      };

      await saveLocalTownship(localTownship);

      setTimeout(() => {
        setDownloading(false);
        onDownloaded(localTownship);
        onClose();
      }, 700);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setDownloading(false);
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  };

  if (!isOpen) return null;

  const isTooLarge = boxDimensions ? boxDimensions.diagonalKm > 5.0 : false;

  return (
    <div className="fixed inset-0 z-50 grid h-dvh grid-rows-[1fr_auto] lg:grid-cols-[1fr_380px] lg:grid-rows-1 bg-white text-stone-900 animate-in fade-in duration-150">
      {/* Left Column: Full-Height Map */}
      <div className="relative h-full w-full bg-stone-100">
        <div ref={mapContainer} className="h-full w-full" />

        {/* Floating Alignment Badge */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-3.5 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur-xs">
          <span className="font-semibold text-stone-900">Map alignment:</span>
          <span>Pan to position your neighbourhood within the dashed blue boundary</span>
        </div>

        {/* Floating Dimension Badge */}
        {boxDimensions && (
          <div className="pointer-events-none absolute bottom-5 left-4 z-10 flex items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-3.5 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur-xs">
            <span className={`size-2 rounded-full ${isTooLarge ? "bg-red-500" : "bg-emerald-500"}`} />
            <span className="font-mono tabular-nums text-stone-800">
              {boxDimensions.widthKm} km × {boxDimensions.heightKm} km ({boxDimensions.diagonalKm} km diagonal)
            </span>
            <span className={`text-[11px] font-semibold ${isTooLarge ? "text-red-600" : "text-emerald-700"}`}>
              {isTooLarge ? "· Exceeds 5km limit" : "· Optimal"}
            </span>
          </div>
        )}
      </div>

      {/* Right Column: Aside matching main dashboard */}
      <aside className="flex max-h-[50dvh] flex-col gap-5 overflow-y-auto border-stone-200 bg-white p-5 lg:max-h-none lg:border-l">
        {/* Header */}
        <header className="flex flex-col gap-1 border-b border-stone-100 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">Download Township</h1>
            <button
              onClick={onClose}
              disabled={downloading}
              className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              ✕ Close
            </button>
          </div>
          <p className="text-sm text-stone-500">Extract real 3D buildings, roads, and 10 drainage zones</p>
        </header>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
            <div className="font-semibold">Extraction issue:</div>
            <div className="mt-0.5">{errorMessage}</div>
          </div>
        )}

        {/* Search Section */}
        <section className="rounded-xl border border-stone-200 p-4 bg-stone-50/50 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Search Location</label>
            <div className="relative mt-1">
              <input
                type="text"
                placeholder="Type any Malaysian town..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (!val.trim() || val.length < 3) setSearchResults([]);
                }}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 shadow-xs focus:border-stone-900 focus:outline-none"
              >
              </input>
              {searching && (
                <span className="absolute right-3 top-2.5 text-xs text-stone-400 animate-pulse">Searching...</span>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
                {searchResults.map((item) => (
                  <button
                    key={item.place_id}
                    type="button"
                    onClick={() =>
                      jumpToCoord(
                        parseFloat(item.lat),
                        parseFloat(item.lon),
                        item.display_name.split(",").slice(0, 2).join(",").trim(),
                      )
                    }
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-stone-50 transition"
                  >
                    <span className="text-sm font-medium text-stone-900">
                      {item.display_name.split(",").slice(0, 2).join(",")}
                    </span>
                    <span className="truncate text-xs text-stone-500">{item.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-[11px] font-medium text-stone-500">Quick presets:</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {POPULAR_HOTSPOTS.map((spot) => (
                <button
                  key={spot.name}
                  type="button"
                  onClick={() => jumpToCoord(spot.lat, spot.lon, spot.name)}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 shadow-2xs hover:border-stone-400 transition"
                >
                  {spot.name.split(",")[0]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Selected Area Details */}
        <section className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Township Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, ""),
                );
              }}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Slug Identifier</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-mono text-stone-600"
            />
          </div>

          {bbox && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
              <span className="font-semibold text-stone-800">Target Bounds:</span>
              <div className="mt-0.5 font-mono text-[11px] text-stone-600">
                [{bbox[0]}, {bbox[1]}, {bbox[2]}, {bbox[3]}]
              </div>
            </div>
          )}
        </section>

        {/* Download Action */}
        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!name.trim() || !bbox || isTooLarge || downloading}
            className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-stone-800 disabled:opacity-40"
          >
            {isTooLarge ? "Selection too large (Zoom in)" : "Download & Save to Device"}
          </button>
          <p className="text-center text-[11px] text-stone-400">
            Saved permanently to device storage for zero-lag 3D simulation.
          </p>
        </div>

        <footer className="mt-auto pt-4 border-t border-stone-100 text-xs leading-relaxed text-stone-400">
          Streets and buildings © OpenStreetMap contributors. Elevations via Open-Meteo DEM. Runs directly in your browser.
        </footer>
      </aside>

      {/* Downloading Stepper Overlay */}
      {downloading && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4 flex h-12 w-12 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-3 border-stone-200 border-t-stone-900" />
                <span className="text-lg">💧</span>
              </div>
              <h3 className="text-base font-semibold text-stone-900">Building 3D Digital Twin</h3>
              <p className="mt-0.5 text-xs text-stone-500">{STEPS[currentStep]}</p>

              <div className="mt-5 flex w-full flex-col gap-2 text-left">
                {STEPS.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        idx < currentStep
                          ? "bg-emerald-600 text-white"
                          : idx === currentStep
                          ? "bg-stone-900 text-white animate-pulse"
                          : "bg-stone-200 text-stone-500"
                      }`}
                    >
                      {idx < currentStep ? "✓" : idx + 1}
                    </span>
                    <span className={idx === currentStep ? "font-medium text-stone-900" : "text-stone-400"}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
