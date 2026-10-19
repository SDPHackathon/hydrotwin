"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { rainAt, STORM_MINUTES } from "@/lib/engine/storm";
import { stepLevel } from "@/lib/engine/sim";
import type { Drain, DrainStatus } from "@/lib/engine/types";
import drainsData from "@/public/data/bukit-raja/drains.json";

const drains: Drain[] = drainsData as Drain[];
const END_MINUTE = STORM_MINUTES + 30;

export default function ControlPage() {
  const [minute, setMinute] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [levels, setLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(drains.map((d) => [d.id, 0])),
  );
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>({});
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const minuteRef = useRef(0);
  const levelsRef = useRef(levels);
  useEffect(() => {
    levelsRef.current = levels;
  }, [levels]);

  // Sync state to API
  const pushReadings = useCallback(async (currentMinute: number, currentLevels: Record<string, number>, isRunning: boolean, currentSpeed: number) => {
    try {
      setSyncStatus("syncing");
      const rain = rainAt(currentMinute);
      const readings = drains.map((d) => ({
        drain_id: d.id,
        level_cm: currentLevels[d.id] ?? 0,
        rain_mm: rain,
        sim_minute: currentMinute,
        source: "sim" as const,
      }));

      const res = await fetch("/api/risk-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readings,
          minute: currentMinute,
          running: isRunning,
          speed: currentSpeed,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.statuses) setStatuses(data.statuses);
        setSyncStatus("synced");
      } else {
        setSyncStatus("error");
      }
    } catch {
      setSyncStatus("error");
    }
  }, []);

  // Tick simulation forward
  const tick = useCallback(() => {
    const m = minuteRef.current;
    if (m >= END_MINUTE) {
      setRunning(false);
      pushReadings(m, levelsRef.current, false, speed);
      return;
    }
    const nextMinute = m + 1;
    minuteRef.current = nextMinute;
    setMinute(nextMinute);

    const rain = rainAt(m);
    const nextLevels: Record<string, number> = {};
    for (const d of drains) {
      const prev = levelsRef.current[d.id] ?? 0;
      nextLevels[d.id] = Math.round(stepLevel(d, prev, rain) * 10) / 10;
    }
    setLevels(nextLevels);
    const nextRunning = nextMinute < END_MINUTE;
    if (!nextRunning) setRunning(false);
    pushReadings(nextMinute, nextLevels, nextRunning, speed);
  }, [pushReadings, speed]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(tick, 1000 / speed);
    return () => clearInterval(interval);
  }, [running, speed, tick]);

  const handleStart = () => {
    if (minuteRef.current >= END_MINUTE) return;
    setRunning(true);
    pushReadings(minuteRef.current, levelsRef.current, true, speed);
  };

  const handlePause = () => {
    setRunning(false);
    pushReadings(minuteRef.current, levelsRef.current, false, speed);
  };

  const handleReset = async () => {
    setRunning(false);
    setSpeed(1);
    minuteRef.current = 0;
    setMinute(0);
    const zeroLevels = Object.fromEntries(drains.map((d) => [d.id, 0]));
    setLevels(zeroLevels);
    try {
      await fetch("/api/risk-engine/reset", { method: "POST" });
      setSyncStatus("synced");
    } catch {
      // Ignored
    }
  };

  const handleLevelChange = (drainId: string, val: number) => {
    const updated = { ...levels, [drainId]: val };
    setLevels(updated);
    pushReadings(minuteRef.current, updated, running, speed);
  };

  const currentRainMmPerHour = Math.round(rainAt(minute) * 60);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900 tracking-tight">HydroTwin Control</span>
              <span className={`inline-block w-2 h-2 rounded-full ${syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-pulse" : "bg-rose-500"}`} />
            </div>
            <p className="text-[11px] text-stone-500">Bukit Raja · Live Phone Controller</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Map</Link>
            <Link href="/resident" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Resident</Link>
            <Link href="/guard" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Guard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Storm Controller Card */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Storm Simulation</span>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-0.5">
                {String(Math.floor(minute / 60)).padStart(2, "0")}:{String(minute % 60).padStart(2, "0")}
                <span className="text-xs font-normal text-stone-500 ml-1.5">/ 03:30</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-500">Rain Intensity</span>
              <div className="text-lg font-semibold text-blue-600 font-mono">
                {currentRainMmPerHour} <span className="text-xs text-stone-500">mm/h</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mb-4">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (minute / END_MINUTE) * 100)}%` }}
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {!running ? (
              <button
                onClick={handleStart}
                disabled={minute >= END_MINUTE}
                className="col-span-2 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-40"
              >
                <span>▶</span> {minute >= END_MINUTE ? "Storm complete" : "Start Storm"}
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="col-span-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <span>⏸</span> Pause Storm
              </button>
            )}
            <button
              onClick={handleReset}
              className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-medium text-sm transition"
            >
              Reset
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <span className="text-xs text-stone-500 font-medium">Replay Speed</span>
            <div className="flex gap-1">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSpeed(s);
                    pushReadings(minuteRef.current, levelsRef.current, running, s);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${speed === s ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Live Drain Injection Sliders */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Per-Drain Sensors & Override</h2>
              <p className="text-xs text-stone-500">Drag sliders to test emergency overflows</p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
              Bank = 120cm
            </span>
          </div>

          <div className="divide-y divide-stone-100 mt-2">
            {drains.map((d) => {
              const lvl = levels[d.id] ?? 0;
              const st = statuses[d.id]?.status ?? (lvl >= d.bank_cm ? "red" : lvl >= d.bank_cm * 0.7 ? "amber" : "green");
              const isRed = st === "red";
              const isAmber = st === "amber";

              return (
                <div key={d.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-stone-800 font-mono">{d.id}</span>
                      <span className="text-stone-500">({d.elevation_m}m DEM)</span>
                      {d.id === "D08" || d.id === "D07" ? (
                        <span className="text-[10px] px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded font-medium">Low-lying</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-stone-900 font-semibold">{lvl.toFixed(1)} cm</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isRed
                            ? "bg-rose-100 text-rose-700"
                            : isAmber
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {st}
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={1}
                    value={lvl}
                    onChange={(e) => handleLevelChange(d.id, parseFloat(e.target.value))}
                    className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-200 rounded-lg appearance-none"
                  />
                  {lvl > d.bank_cm && (
                    <p className="text-[11px] text-rose-600 font-medium">
                      ⚠️ Overflow: +{(lvl - d.bank_cm).toFixed(1)} cm on streets
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
