"use client";

import { useMemo } from "react";
import TownshipMap from "@/components/TownshipMap";
import type { Area, Streets } from "@/lib/area";
import { STATUS_COLOR } from "@/lib/colors";
import type { Drain, DrainStatus, Status } from "@/lib/engine/types";
import { STORM_MINUTES } from "@/lib/engine/storm";
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

export default function Dashboard({ area, drains, streets }: { area: Area; drains: Drain[]; streets: Streets }) {
  const storm = useLocalStorm(drains);

  const streetCounts = useMemo(() => {
    const counts: Record<Status, number> = { green: 0, amber: 0, red: 0 };
    for (const f of streets.features) counts[storm.statuses[f.properties.drain_id]?.status ?? "green"]++;
    return counts;
  }, [streets, storm.statuses]);

  const ranked = useMemo(
    () =>
      drains
        .map((d) => ({ drain: d, s: storm.statuses[d.id] }))
        .sort((a, b) => SEVERITY[a.s.status] - SEVERITY[b.s.status] || b.s.level_cm / b.drain.bank_cm - a.s.level_cm / a.drain.bank_cm),
    [drains, storm.statuses],
  );

  return (
    <div className="grid h-dvh grid-rows-[1fr_auto] lg:grid-cols-[1fr_380px] lg:grid-rows-1">
      <TownshipMap area={area} drains={drains} streets={streets} statuses={storm.statuses} />

      <aside className="flex max-h-[50dvh] flex-col gap-5 overflow-y-auto border-stone-200 bg-white p-5 lg:max-h-none lg:border-l">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">HydroTwin</h1>
          <p className="text-sm text-stone-500">{area.name} · live drain status</p>
        </header>

        <section className="rounded-xl border border-stone-200 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-stone-500">Storm time</span>
            <span className="font-mono text-2xl tabular-nums">
              {clock(storm.minute)} <span className="text-sm text-stone-400">/ {clock(STORM_MINUTES)}</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Rain: <strong className="tabular-nums">{storm.rainMmPerHour} mm/h</strong>
            <span className="text-stone-400"> · simulated storm</span>
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={storm.running ? storm.pause : storm.start}
              disabled={storm.finished}
              className="flex-1 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {storm.running ? "Pause" : storm.minute === 0 ? "Start storm" : "Resume"}
            </button>
            <button onClick={storm.reset} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
              Reset
            </button>
            <div className="flex overflow-hidden rounded-lg border border-stone-300 text-sm">
              {SPEEDS.map((x) => (
                <button
                  key={x}
                  onClick={() => storm.setSpeed(x)}
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
            {ranked.map(({ drain, s }) => (
              <li key={drain.id} className="rounded-lg border border-stone-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[s.status] }} />
                  <span className="font-medium">{drain.id}</span>
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
            ))}
          </ul>
        </section>

        <footer className="mt-auto text-xs leading-relaxed text-stone-400">
          Drains and the storm are simulated; drain elevations are real (Open-Meteo). Water height is drawn
          ×{WATER_HEIGHT_SCALE} so it can be seen. Streets and buildings © OpenStreetMap contributors.
        </footer>
      </aside>
    </div>
  );
}
