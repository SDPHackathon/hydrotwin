"use client";

import "./Dashboard.css";
import { useEffect, useMemo, useRef, useState } from "react";
import AddTownshipModal from "@/components/AddTownshipModal";
import MobileLinksModal from "@/components/MobileLinksModal";
import TownshipMap from "@/components/TownshipMap";
import MapModeNavigation from "@/components/MapModeNavigation";
import EvacuationPanel from "@/components/EvacuationPanel";
import DevelopmentPanel from "@/components/DevelopmentPanel";
import { developmentError, evaluateDevelopment, newDevelopment, DEVELOPMENT_LABELS, type DevelopmentStage } from "@/lib/engine/development";
import type { Area, Streets } from "@/lib/area";
import { STATUS_COLOR } from "@/lib/colors";
import { applyInterventions, recommendInterventions, replayStorm } from "@/lib/engine/plan";
import { findSafeRoute, type RoadPoint, type RoadPosition, type RouteDestination, type RouteResult } from "@/lib/engine/route";
import { STORM_MINUTES } from "@/lib/engine/storm";
import type { Drain, DrainStatus, InterventionKind, PlanIntervention, Status } from "@/lib/engine/types";
import { supabase } from "@/lib/supabase";
import {
  getLocalTownship,
  listLocalTownships,
  type LocalTownship,
  type LocalTownshipMeta,
} from "@/lib/storage/township-db";
import { useLocalStorm } from "@/lib/useLocalStorm";
import { WATER_HEIGHT_SCALE } from "@/lib/water";

const SEVERITY: Record<Status, number> = { red: 0, amber: 1, green: 2 };
const SPEEDS = [1, 2, 4];

const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

function describe(s: DrainStatus, drain: Drain) {
  if (s.status === "red") return `Overflowing · ${s.street_depth_cm} cm on the street`;
  if (s.minutes_to_red !== null && s.minutes_to_red <= 60) return `Red in ~${s.minutes_to_red} min`;
  return `${Math.round((s.level_cm / drain.bank_cm) * 100)}% full`;
}

interface SavedScenario {
  id: string;
  name: string;
  changes: PlanIntervention[];
  results: {
    streets_flooded: number;
    deepest_cm: number;
    minutes_to_first_red: number | null;
  };
  created_at: string;
}

interface DashboardViewProps {
  currentArea: Area;
  currentDrains: Drain[];
  currentStreets: Streets;
  currentBuildings?: GeoJSON.FeatureCollection;
  currentFloodZones?: GeoJSON.FeatureCollection;
  areas: Area[];
  localTownships: LocalTownshipMeta[];
  onSelectArea: (slug: string) => void;
  onOpenModal: () => void;
}

function DashboardView({
  currentArea,
  currentDrains,
  currentStreets,
  currentBuildings,
  currentFloodZones,
  areas,
  localTownships,
  onSelectArea,
  onOpenModal,
}: DashboardViewProps) {
  // Mode: "live" (Realtime / local simulation), "plan" (Plan mode civil fixes), or "route" (Evacuation Safe Routes)
  const [mode, setMode] = useState<"live" | "plan" | "route">("live");
  const [modePhase, setModePhase] = useState<"idle" | "leaving" | "entering">("idle");
  const modeTimers = useRef<number[]>([]);

  useEffect(() => () => modeTimers.current.forEach(window.clearTimeout), []);

  const changeMode = (next: typeof mode) => {
    if (next === mode && modePhase === "idle") return;
    modeTimers.current.forEach(window.clearTimeout);
    modeTimers.current = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode(next);
      setModePhase("idle");
      return;
    }
    setModePhase("leaving");
    modeTimers.current.push(window.setTimeout(() => {
      setMode(next);
      setModePhase("entering");
      modeTimers.current.push(window.setTimeout(() => setModePhase("idle"), 360));
    }, 180));
  };

  // Live data source: "local" (in-browser simulation) or "cloud" (Supabase / Phone /control sync)
  const [liveSource, setLiveSource] = useState<"local" | "cloud">("local");
  const [cloudStatuses, setCloudStatuses] = useState<Record<string, DrainStatus>>({});
  const [cloudStormState, setCloudStormState] = useState<{ minute: number; running: boolean } | null>(null);

  // Mobile companion launcher modal
  const [mobileModalOpen, setMobileModalOpen] = useState(false);

  // Safe Routes (ROUTE-1) state
  const [startStreetId, setStartStreetId] = useState(currentStreets.features[0]?.properties.id ?? "");
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [originPosition, setOriginPosition] = useState<RoadPosition>();
  const [routePickMode, setRoutePickMode] = useState<"origin" | "destination" | null>(null);
  const [routePickMessage, setRoutePickMessage] = useState("");
  const [destinations, setDestinations] = useState<RouteDestination[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(`hydrotwin_destinations_${currentArea.slug}`) ?? "[]");
      return Array.isArray(stored) ? stored.filter((d): d is RouteDestination =>
        typeof d?.id === "string" && typeof d?.name === "string" && typeof d?.street_id === "string" && d?.kind === "demo") : [];
    } catch { return []; }
  });
  const [destinationSaveError, setDestinationSaveError] = useState(false);
  const updateDestinations = (next: RouteDestination[]) => {
    setDestinations(next);
    setDestinationId(null);
    try {
      localStorage.setItem(`hydrotwin_destinations_${currentArea.slug}`, JSON.stringify(next));
      setDestinationSaveError(false);
    } catch { setDestinationSaveError(true); }
  };
  const pickRoutePoint = (point: RoadPoint | null) => {
    if (!point) {
      setRoutePickMessage("No road near that click. Click closer to a mapped road.");
      return;
    }
    if (routePickMode === "origin") {
      setStartStreetId(point.street_id);
      setOriginPosition(point.position);
      setRoutePickMessage("Starting pin placed on the road.");
    } else {
      const id = crypto.randomUUID();
      const street = currentStreets.features.find((s) => s.properties.id === point.street_id);
      updateDestinations([...destinations, { id, ...point, name: `Demo pin · ${street?.properties.name || point.street_id}`, kind: "demo" }]);
      setDestinationId(id);
      setRoutePickMessage("Safe destination pin added and selected.");
    }
    setRoutePickMode(null);
  };

  // Plan Mode state
  const [planMode, setPlanMode] = useState<"upgrades" | "development">("upgrades");
  const [development, setDevelopment] = useState(() => newDevelopment(currentDrains[0]?.id ?? ""));
  const [drawingSite, setDrawingSite] = useState(false);
  const [developmentStage, setDevelopmentStage] = useState<DevelopmentStage>("proposed");
  const developmentActive = mode === "plan" && planMode === "development";
  const developmentValidation = developmentError(development, currentDrains, currentStreets.features, currentArea.bbox);
  const developmentResult = useMemo(() => drawingSite || developmentValidation ? null : evaluateDevelopment(development, currentDrains, currentStreets.features, currentArea.bbox),
    [drawingSite, developmentValidation, development, currentDrains, currentStreets, currentArea.bbox]);
  const [interventions, setInterventions] = useState<PlanIntervention[]>([]);
  const [selectedDrainId, setSelectedDrainId] = useState<string>(currentDrains[0]?.id || "D08");
  const [selectedKind, setSelectedKind] = useState<InterventionKind>("retention_pond");
  const [scenarioName, setScenarioName] = useState("Retention Pond on D08");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`hydrotwin_scenarios_${currentArea.slug}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Street count map for accurate street flooding calculation
  const streetCountsByDrain = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of currentStreets.features) {
      counts[f.properties.drain_id] = (counts[f.properties.drain_id] ?? 0) + 1;
    }
    return counts;
  }, [currentStreets]);

  // Plan Mode Calculations
  const upgradedDrains = useMemo(
    () => applyInterventions(currentDrains, interventions),
    [currentDrains, interventions],
  );

  const baselineResult = useMemo(
    () => replayStorm(currentDrains, streetCountsByDrain),
    [currentDrains, streetCountsByDrain],
  );

  const recommendation = useMemo(
    () => recommendInterventions(currentDrains, streetCountsByDrain),
    [currentDrains, streetCountsByDrain],
  );

  const plannedResult = useMemo(
    () => replayStorm(upgradedDrains, streetCountsByDrain),
    [upgradedDrains, streetCountsByDrain],
  );

  // Simulation Scenario: "baseline" (original drains) or "plan" (with applied civil upgrades)
  const [simulationScenario, setSimulationScenario] = useState<"baseline" | "plan">("baseline");

  // Live storm simulation uses upgradedDrains when in Plan Mode OR when "With Upgrades" is toggled in Live Warning!
  const activeSimulationDrains =
    (mode === "plan" || simulationScenario === "plan") && interventions.length > 0
      ? upgradedDrains
      : currentDrains;
  const storm = useLocalStorm(activeSimulationDrains);

  // Supabase Realtime & Periodic Poll when liveSource is "cloud"
  useEffect(() => {
    if (liveSource !== "cloud") return;

    let mounted = true;
    const fetchCloud = async () => {
      try {
        const res = await fetch("/api/risk-engine");
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.statuses) setCloudStatuses(data.statuses);
          if (data.minute !== undefined) setCloudStormState({ minute: data.minute, running: data.running });
        }
      } catch {
        // Ignored
      }
    };
    fetchCloud();
    const interval = setInterval(fetchCloud, 1500);

    const channel = supabase
      .channel("public:drain_status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drain_status" },
        (payload) => {
          if (!mounted) return;
          const updated = payload.new as Partial<DrainStatus>;
          if (updated && updated.drain_id) {
            setCloudStatuses((prev) => ({
              ...prev,
              [updated.drain_id!]: updated as DrainStatus,
            }));
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [liveSource]);

  // Active statuses: in Cloud mode use cloudStatuses, else local simulation
  const activeStatuses = useMemo(() => {
    if (liveSource === "cloud" && Object.keys(cloudStatuses).length > 0) {
      return cloudStatuses;
    }
    return storm.statuses;
  }, [liveSource, cloudStatuses, storm.statuses]);

  // Safe Routes (ROUTE-1) Calculation
  const safeRouteResult: RouteResult | null = useMemo(() => {
    if (mode !== "route") return null;

    return findSafeRoute(
      currentStreets.features,
      startStreetId,
      destinations,
      Object.fromEntries(Object.entries(liveSource === "cloud" ? cloudStatuses : activeStatuses).map(([id, st]) => [id, st.status])),
      destinationId,
      originPosition,
    );
  }, [mode, startStreetId, destinations, destinationId, originPosition, currentStreets, activeStatuses, liveSource, cloudStatuses]);

  const streetCounts = useMemo(() => {
    const counts: Record<Status, number> = { green: 0, amber: 0, red: 0 };
    for (const f of currentStreets.features) counts[activeStatuses[f.properties.drain_id]?.status ?? "green"]++;
    return counts;
  }, [currentStreets, activeStatuses]);

  const ranked = useMemo(
    () =>
      activeSimulationDrains
        .map((d) => ({ drain: d, s: activeStatuses[d.id] ?? storm.statuses[d.id] }))
        .sort((a, b) => SEVERITY[a.s.status] - SEVERITY[b.s.status] || b.s.level_cm / b.drain.bank_cm - a.s.level_cm / a.drain.bank_cm),
    [activeSimulationDrains, activeStatuses, storm.statuses],
  );

  const addIntervention = (drainId: string, kind: InterventionKind) => {
    setInterventions((prev) => [
      ...prev.filter((inv) => inv.drain_id !== drainId),
      { drain_id: drainId, kind },
    ]);
  };

  const removeIntervention = (drainId: string) => {
    setInterventions((prev) => prev.filter((inv) => inv.drain_id !== drainId));
  };

  const applyRecommendedPlan = () => {
    if (!recommendation) return;
    setInterventions(recommendation.interventions);
    setScenarioName(`Recommended plan for ${currentArea.name}`);
  };

  const saveScenario = () => {
    if (!scenarioName.trim()) return;

    const newScenario: SavedScenario = {
      id: `scen-${Date.now()}`,
      name: scenarioName.trim(),
      changes: interventions,
      results: {
        streets_flooded: plannedResult.streets_flooded,
        deepest_cm: plannedResult.deepest_cm,
        minutes_to_first_red: plannedResult.minutes_to_first_red,
      },
      created_at: new Date().toISOString(),
    };

    const updated = [newScenario, ...savedScenarios.filter((s) => s.name !== newScenario.name)];
    setSavedScenarios(updated);
    try {
      localStorage.setItem(`hydrotwin_scenarios_${currentArea.slug}`, JSON.stringify(updated));
    } catch {
      // ignore
    }

    setSaveStatus("Scenario saved to device & ready for report");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const loadScenario = (s: SavedScenario) => {
    setInterventions(s.changes);
    setScenarioName(s.name);
  };

  const deleteScenario = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedScenarios.filter((s) => s.id !== id);
    setSavedScenarios(updated);
    try {
      localStorage.setItem(`hydrotwin_scenarios_${currentArea.slug}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Active interventions shown on the 3D map:
  // - Plan mode: always visible so civil engineers can design and test upgrades
  // - Live Warning / Safe Routes: only visible when "With Upgrades" scenario is active
  const activeInterventions = useMemo(() => {
    if (mode === "plan") return interventions;
    if (simulationScenario === "plan") return interventions;
    return [];
  }, [mode, simulationScenario, interventions]);

  return (
    <div className="grid h-dvh overflow-hidden grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-[minmax(0,1fr)]">
      <div className="relative min-h-0 min-w-0">
      <div className="dashboard-mode-surface h-full w-full" data-mode-phase={modePhase}>
      <TownshipMap
        area={currentArea}
        drains={activeSimulationDrains}
        streets={currentStreets}
        buildings={currentBuildings}
        floodZones={currentFloodZones}
        statuses={developmentActive ? developmentResult?.stages[developmentStage].peak_statuses ?? {} : activeStatuses}
        interventions={developmentActive ? (developmentResult && developmentStage === "mitigated" && development.mitigation !== "none" ? [{ drain_id: development.drain_id, kind: development.mitigation }] : []) : activeInterventions}
        siteBoundary={developmentActive ? development.boundary : undefined}
        siteClosed={developmentActive && !drawingSite}
        siteCaption={developmentActive ? (developmentResult ? `${DEVELOPMENT_LABELS[developmentStage]} · each zone at its own peak` : "Draw site and complete inputs · no scenario preview yet") : undefined}
        siteAccessRoad={developmentActive ? development.access_street_id : undefined}
        onSitePick={developmentActive && drawingSite ? (point) => setDevelopment(prev => prev.boundary.length >= 50 ? prev : { ...prev, boundary: [...prev.boundary, point] }) : undefined}
        safeRoute={mode === "route" ? safeRouteResult?.coordinates : null}
        routeOrigin={mode === "route" ? safeRouteResult?.origin : null}
        routeDestination={mode === "route" ? safeRouteResult?.destination : null}
        onRoutePick={mode === "route" && routePickMode ? pickRoutePoint : undefined}
        onDrainClick={(drainId) => {
          if (developmentActive) { setDevelopment(prev => ({ ...prev, drain_id: drainId })); return; }
          setSelectedDrainId(drainId);
          if (mode !== "plan") changeMode("plan");
        }}
      />
      </div>
      <MapModeNavigation mode={mode} onChange={changeMode} />
      </div>

      <aside className="dashboard-mode-surface flex max-h-[50dvh] flex-col gap-5 overflow-y-auto border-stone-200 bg-white p-5 lg:max-h-none lg:border-l" data-mode-phase={modePhase}>
        {/* Top Header */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">HydroTwin</h1>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              3D Digital Twin
            </span>
          </div>

          {/* Township Location Selector */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="area-select" className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Township Location
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileModalOpen(true)}
                  className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-2 py-0.5 transition flex items-center gap-1"
                >
                  <span>📱</span> Phone Links
                </button>
                <button
                  type="button"
                  onClick={onOpenModal}
                  className="text-xs font-semibold text-stone-900 hover:underline"
                >
                  + Download new
                </button>
              </div>
            </div>
            <div className="relative mt-1">
              <select
                id="area-select"
                value={currentArea.slug}
                onChange={(e) => onSelectArea(e.target.value)}
                className="w-full appearance-none rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 pr-8 text-sm font-medium text-stone-900 shadow-sm transition hover:bg-stone-100 focus:border-stone-900 focus:bg-white focus:outline-none"
              >
                <optgroup label="Pre-bundled Townships">
                  {areas.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
                {localTownships.length > 0 && (
                  <optgroup label="Downloaded on this Device">
                    {localTownships.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name} (Custom)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-stone-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

        </header>

        {mode === "plan" ? (
          <>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 text-xs">
            <button className={`rounded-md px-2 py-2 ${planMode === "upgrades" ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`} onClick={() => { setPlanMode("upgrades"); setDrawingSite(false); }}>Improve township</button>
            <button className={`rounded-md px-2 py-2 ${planMode === "development" ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`} onClick={() => setPlanMode("development")}>New development</button>
          </div>
          {planMode === "development" ? <DevelopmentPanel area={currentArea} drains={currentDrains} streets={currentStreets} draft={development} onChange={setDevelopment} drawing={drawingSite} onDrawing={setDrawingSite} result={developmentResult} error={developmentValidation} stage={developmentStage} onStage={setDevelopmentStage} /> : (
          /* ================= PLAN MODE VIEW ================= */
          <div className="flex flex-col gap-5">
            {/* Before vs After Impact Scorecard */}
            <section className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">Before vs After Impact</span>
                <span className="text-[11px] font-mono text-stone-500">Instant Replay (3h Storm)</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {/* Metric 1: Flooded Streets */}
                <div className="rounded-lg border border-stone-200 bg-white p-2.5">
                  <div className="text-xs text-stone-500">Flooded Streets</div>
                  <div className="mt-1 flex items-baseline justify-center gap-1 font-semibold tabular-nums text-stone-900">
                    <span className="text-stone-400 line-through text-xs">{baselineResult.streets_flooded}</span>
                    <span className="text-base text-emerald-600">{plannedResult.streets_flooded}</span>
                  </div>
                  <div className="text-[10px] font-medium text-emerald-700">
                    {baselineResult.streets_flooded > plannedResult.streets_flooded
                      ? `-${baselineResult.streets_flooded - plannedResult.streets_flooded} streets`
                      : "No change"}
                  </div>
                </div>

                {/* Metric 2: Deepest Water */}
                <div className="rounded-lg border border-stone-200 bg-white p-2.5">
                  <div className="text-xs text-stone-500">Max Depth</div>
                  <div className="mt-1 flex items-baseline justify-center gap-1 font-semibold tabular-nums text-stone-900">
                    <span className="text-stone-400 line-through text-xs">{baselineResult.deepest_cm}</span>
                    <span className="text-base text-emerald-600">{plannedResult.deepest_cm}</span>
                    <span className="text-[10px] text-stone-400">cm</span>
                  </div>
                  <div className="text-[10px] font-medium text-emerald-700">
                    {baselineResult.deepest_cm > plannedResult.deepest_cm
                      ? `-${(baselineResult.deepest_cm - plannedResult.deepest_cm).toFixed(1)} cm`
                      : "No change"}
                  </div>
                </div>

                {/* Metric 3: Time to First Red */}
                <div className="rounded-lg border border-stone-200 bg-white p-2.5">
                  <div className="text-xs text-stone-500">1st Flood Time</div>
                  <div className="mt-1 flex items-baseline justify-center gap-1 font-semibold tabular-nums text-stone-900">
                    <span className="text-stone-400 line-through text-xs">
                      {baselineResult.minutes_to_first_red ? `${baselineResult.minutes_to_first_red}m` : "None"}
                    </span>
                    <span className="text-base text-blue-600">
                      {plannedResult.minutes_to_first_red ? `${plannedResult.minutes_to_first_red}m` : "Safe!"}
                    </span>
                  </div>
                  <div className="text-[10px] font-medium text-blue-700">
                    {plannedResult.minutes_to_first_red === null
                      ? "Zero overflow!"
                      : plannedResult.minutes_to_first_red > (baselineResult.minutes_to_first_red ?? 0)
                      ? `+${plannedResult.minutes_to_first_red - (baselineResult.minutes_to_first_red ?? 0)}m buffer`
                      : "Same buffer"}
                  </div>
                </div>
              </div>
            </section>

            {/* Live 3D Storm Simulation with Upgrades */}
            <section className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">Watch Plan in Action (3D Map)</span>
                  <p className="text-[11px] text-stone-500">Run storm simulation to see your upgrades perform live</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-stone-900">
                    {clock(storm.minute)}
                  </span>
                  <span className="text-[10px] text-stone-400 block font-normal">/ {clock(STORM_MINUTES)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={storm.running ? storm.pause : storm.start}
                  disabled={storm.finished}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  {storm.running ? "⏸ Pause Replay" : storm.minute === 0 ? "▶ Play Storm with Upgrades" : "▶ Resume Replay"}
                </button>
                <button
                  type="button"
                  onClick={storm.reset}
                  disabled={storm.minute === 0 && !storm.running}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 transition"
                >
                  Reset
                </button>
                <div className="flex rounded-lg border border-stone-200 text-xs">
                  {SPEEDS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => storm.setSpeed(x)}
                      className={`px-2 py-1 ${storm.speed === x ? "bg-stone-900 text-white font-semibold" : "text-stone-600"}`}
                    >
                      {x}×
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Active Interventions Manager */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Active Upgrades ({interventions.length})
                </h2>
                {interventions.length === 0 && (
                  <button
                    type="button"
                    onClick={applyRecommendedPlan}
                    disabled={!recommendation}
                    className="text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-stone-400"
                  >
                    {recommendation
                      ? `Apply Recommended (${recommendation.interventions.map((inv) => `${inv.drain_id} ${inv.kind.replaceAll("_", " ")}`).join(" + ")})`
                      : "No upgrade improves this storm"}
                  </button>
                )}
              </div>

              {recommendation && interventions.length === 0 && (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  Under the demo storm, the recommended plan reduces flooded streets from {recommendation.baseline.streets_flooded} to {recommendation.result.streets_flooded}
                  {recommendation.baseline.deepest_cm > recommendation.result.deepest_cm
                    ? ` and peak water depth from ${recommendation.baseline.deepest_cm} cm to ${recommendation.result.deepest_cm} cm.`
                    : "."}
                  {recommendation.baseline.minutes_to_first_red !== recommendation.result.minutes_to_first_red && (
                    <> First overflow changes from {recommendation.baseline.minutes_to_first_red === null ? "none" : `minute ${recommendation.baseline.minutes_to_first_red}`} to {recommendation.result.minutes_to_first_red === null ? "none" : `minute ${recommendation.result.minutes_to_first_red}`}.</>
                  )}
                </p>
              )}

              {interventions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-200 p-3.5 text-center text-xs text-stone-400">
                  Click any drain on the map or add a civil intervention below.
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {interventions.map((inv) => (
                    <li
                      key={inv.drain_id}
                      className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${
                            inv.kind === "retention_pond"
                              ? "bg-sky-500"
                              : inv.kind === "green_area"
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <span className="font-semibold text-stone-900">{inv.drain_id}</span>
                        <span className="text-stone-600">
                          {inv.kind === "retention_pond"
                            ? "Retention Pond (Takungan · Catchment ×0.6)"
                            : inv.kind === "green_area"
                            ? "Green Sponge Park (Catchment ×0.8)"
                            : "Bigger Culvert Drain (Outflow ×1.5)"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIntervention(inv.drain_id)}
                        className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Add New Fix Tool */}
            <section className="rounded-xl border border-stone-200 p-4 bg-white flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-700">Add Civil Intervention</h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-stone-500">Target Drain</label>
                  <select
                    value={selectedDrainId}
                    onChange={(e) => setSelectedDrainId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-stone-900 focus:outline-none"
                  >
                    {currentDrains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.id} ({d.elevation_m}m elev)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-stone-500">Fix Type</label>
                  <select
                    value={selectedKind}
                    onChange={(e) => setSelectedKind(e.target.value as InterventionKind)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-stone-900 focus:outline-none"
                  >
                    <option value="retention_pond">Retention Pond (-40% inflow)</option>
                    <option value="bigger_drain">Bigger Drain (+50% outflow)</option>
                    <option value="green_area">Green Sponge Park (-20% inflow)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => addIntervention(selectedDrainId, selectedKind)}
                className="mt-1 w-full rounded-lg bg-stone-900 py-2 text-xs font-medium text-white shadow-xs hover:bg-stone-800 transition"
              >
                + Apply Intervention to {selectedDrainId}
              </button>
            </section>

            {/* Save & Load Scenarios */}
            <section className="rounded-xl border border-stone-200 p-4 bg-stone-50/50 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-700">Save Scenario</h3>
                {saveStatus && <span className="text-[10px] text-emerald-600 font-semibold">{saveStatus}</span>}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Phase 1 Retention Pond"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveScenario}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
                >
                  Save
                </button>
              </div>

              {savedScenarios.length > 0 && (
                <div className="pt-2 border-t border-stone-200">
                  <span className="text-[11px] font-medium text-stone-500">Saved Plans:</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {savedScenarios.map((scen) => {
                      const isSelected = scenarioName === scen.name;
                      return (
                        <div
                          key={scen.id}
                          className={`inline-flex items-center rounded-lg border text-xs overflow-hidden transition shadow-2xs ${
                            isSelected
                              ? "border-stone-900 bg-stone-900 text-white"
                              : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => loadScenario(scen)}
                            className="px-2.5 py-1 text-left font-medium hover:underline"
                          >
                            {scen.name}
                          </button>
                          <button
                            type="button"
                            title={`Delete plan "${scen.name}"`}
                            onClick={(e) => deleteScenario(scen.id, e)}
                            className={`px-1.5 py-1 transition border-l flex items-center justify-center text-[11px] ${
                              isSelected
                                ? "border-stone-700 text-stone-400 hover:bg-stone-800 hover:text-white"
                                : "border-stone-100 text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                            }`}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
          )}
          </>
        ) : mode === "route" ? (
          <EvacuationPanel
            streets={currentStreets.features}
            startStreetId={startStreetId}
            onStartChange={(id) => { setStartStreetId(id); setOriginPosition(undefined); setRoutePickMessage(""); }}
            destinations={destinations}
            onDestinationsChange={updateDestinations}
            selectedDestinationId={destinationId}
            onDestinationChange={setDestinationId}
            result={safeRouteResult}
            saveError={destinationSaveError}
            pickMode={routePickMode}
            onPickModeChange={(value) => { setRoutePickMode(value); setRoutePickMessage(""); }}
            pickMessage={routePickMessage}
          />
        ) : (
          /* ================= LIVE MODE VIEW ================= */
          <>
            {/* Live Data Source Selector */}
            <div className="rounded-xl border border-stone-200 p-2.5 bg-stone-50 flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700">Data Source:</span>
              <div className="flex rounded-md bg-stone-200 p-0.5 font-medium">
                <button
                  type="button"
                  onClick={() => setLiveSource("local")}
                  className={`px-2.5 py-1 rounded transition ${
                    liveSource === "local" ? "bg-white text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Local Sim
                </button>
                <button
                  type="button"
                  onClick={() => setLiveSource("cloud")}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 ${
                    liveSource === "cloud" ? "bg-white text-stone-900 shadow-xs font-semibold" : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Cloud Phone Sync
                </button>
              </div>
            </div>

            {/* Simulation Infrastructure Scenario Toggle */}
            <div className="rounded-xl border border-stone-200 p-2.5 bg-stone-50 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-stone-800">Drain Infrastructure:</span>
                <p className="text-[10px] text-stone-500">
                  {simulationScenario === "plan" && interventions.length > 0
                    ? `Testing with ${interventions.length} active civil upgrades`
                    : "Simulating default baseline drainage"}
                </p>
              </div>
              <div className="flex rounded-md bg-stone-200 p-0.5 font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setSimulationScenario("baseline");
                    storm.reset();
                  }}
                  className={`px-2.5 py-1 rounded transition ${
                    simulationScenario === "baseline" ? "bg-white text-stone-900 shadow-xs font-semibold" : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Baseline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (interventions.length === 0) {
                      applyRecommendedPlan();
                    }
                    setSimulationScenario("plan");
                    storm.reset();
                  }}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                    simulationScenario === "plan" ? "bg-emerald-600 text-white shadow-xs font-semibold" : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <span>With Upgrades</span>
                  {interventions.length > 0 && (
                    <span className="px-1 rounded bg-emerald-700 text-[10px]">{interventions.length}</span>
                  )}
                </button>
              </div>
            </div>

            {liveSource === "cloud" && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center justify-between">
                <span>🟢 Connected to Supabase Cloud & Phone Controller</span>
                <button
                  type="button"
                  onClick={() => setMobileModalOpen(true)}
                  className="underline font-semibold"
                >
                  Open /control
                </button>
              </div>
            )}

            <section className="rounded-xl border border-stone-200 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-500">Storm time</span>
                <span className="font-mono text-2xl tabular-nums">
                  {clock(liveSource === "cloud" && cloudStormState ? cloudStormState.minute : storm.minute)}{" "}
                  <span className="text-sm text-stone-400">/ {clock(STORM_MINUTES)}</span>
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                Rain: <strong className="tabular-nums">{storm.rainMmPerHour} mm/h</strong>
                <span className="text-stone-400"> · simulated storm</span>
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={storm.running ? storm.pause : storm.start}
                  disabled={storm.finished || liveSource === "cloud"}
                  className="flex-1 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {liveSource === "cloud" ? (cloudStormState?.running ? "Running (Phone Sync)" : "Paused (Phone Sync)") : storm.running ? "Pause" : storm.minute === 0 ? "Start storm" : "Resume"}
                </button>
                <button onClick={storm.reset} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
                  Reset
                </button>
                <div className="flex overflow-hidden rounded-lg border border-stone-300 text-sm">
                  {SPEEDS.map((x) => (
                    <button
                      key={x}
                      onClick={() => storm.setSpeed(x)}
                      disabled={liveSource === "cloud"}
                      className={`px-2.5 ${storm.speed === x ? "bg-stone-900 text-white" : ""}`}
                    >
                      {x}×
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-2 text-center">
              {(["red", "amber", "green"] as const).map((k) => (
                <div key={k} className="rounded-xl border border-stone-200 p-3">
                  <div className="text-2xl font-semibold tabular-nums" style={{ color: STATUS_COLOR[k] }}>
                    {streetCounts[k]}
                  </div>
                  <div className="text-xs text-stone-500">{k === "red" ? "flooded" : k === "amber" ? "at risk" : "clear"} streets</div>
                </div>
              ))}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-stone-500">Drains</h2>
              <ul className="flex flex-col gap-2">
                {ranked.map(({ drain, s }) => {
                  const activeInv =
                    simulationScenario === "plan"
                      ? interventions.find((inv) => inv.drain_id === drain.id)
                      : null;

                  return (
                    <li key={drain.id} className="rounded-lg border border-stone-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[s.status] }} />
                        <span className="font-medium">{drain.id}</span>
                        {activeInv && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${
                              activeInv.kind === "retention_pond"
                                ? "bg-sky-100 text-sky-800"
                                : activeInv.kind === "bigger_drain"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {activeInv.kind === "retention_pond"
                              ? "Pond (-40% Runoff)"
                              : activeInv.kind === "bigger_drain"
                                ? "Culvert (1.5× Outflow)"
                                : "Sponge (-20% Runoff)"}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-stone-500">{describe(s, drain)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.min(100, (s.level_cm / drain.bank_cm) * 100)}%`,
                            background: STATUS_COLOR[s.status],
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        <footer className="mt-auto pt-4 border-t border-stone-100 text-xs leading-relaxed text-stone-400">
          Drains and storm are simulated; drain elevations are real (Open-Meteo). Water height is drawn
          ×{WATER_HEIGHT_SCALE} so it can be seen. Streets and buildings © OpenStreetMap contributors.
        </footer>
      </aside>

      <MobileLinksModal
        isOpen={mobileModalOpen}
        onClose={() => setMobileModalOpen(false)}
      />
    </div>
  );
}

export default function Dashboard({
  area,
  areas = [],
  drains,
  streets,
}: {
  area: Area;
  areas?: Area[];
  drains: Drain[];
  streets: Streets;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [localTownships, setLocalTownships] = useState<LocalTownshipMeta[]>([]);
  const [activeCustomTownship, setActiveCustomTownship] = useState<LocalTownship | null>(null);

  // Check IndexedDB on mount
  useEffect(() => {
    listLocalTownships().then(setLocalTownships);

    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get("area");
    if (slugParam && !areas.some((a) => a.slug === slugParam)) {
      getLocalTownship(slugParam).then((res) => {
        if (res) setActiveCustomTownship(res);
      });
    }
  }, [areas]);

  const currentArea = activeCustomTownship?.data.area ?? area;
  const currentDrains = activeCustomTownship?.data.drains ?? drains;
  const currentStreets = activeCustomTownship?.data.streets ?? streets;
  const currentBuildings = activeCustomTownship?.data.buildings;
  const currentFloodZones = activeCustomTownship?.data.floodZones;

  const handleSelectArea = (targetSlug: string) => {
    if (areas.some((a) => a.slug === targetSlug)) {
      setActiveCustomTownship(null);
      const url = new URL(window.location.href);
      url.searchParams.set("area", targetSlug);
      window.location.href = url.toString();
      return;
    }

    getLocalTownship(targetSlug).then((local) => {
      if (local) {
        setActiveCustomTownship(local);
        const url = new URL(window.location.href);
        url.searchParams.set("area", targetSlug);
        window.history.pushState({}, "", url.toString());
      }
    });
  };

  return (
    <>
      <DashboardView
        key={currentArea.slug}
        currentArea={currentArea}
        currentDrains={currentDrains}
        currentStreets={currentStreets}
        currentBuildings={currentBuildings}
        currentFloodZones={currentFloodZones}
        areas={areas}
        localTownships={localTownships}
        onSelectArea={handleSelectArea}
        onOpenModal={() => setModalOpen(true)}
      />

      <AddTownshipModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onDownloaded={(newTownship) => {
          setLocalTownships((prev) => [
            ...prev.filter((t) => t.slug !== newTownship.slug),
            {
              slug: newTownship.slug,
              name: newTownship.name,
              bbox: newTownship.bbox,
              center: newTownship.center,
              downloadedAt: newTownship.downloadedAt,
            },
          ]);
          setActiveCustomTownship(newTownship);
          const url = new URL(window.location.href);
          url.searchParams.set("area", newTownship.slug);
          window.history.pushState({}, "", url.toString());
        }}
      />
    </>
  );
}
