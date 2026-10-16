"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_RESIDENTS } from "@/lib/residents-data";
import type { DemoResident, DrainStatus } from "@/lib/engine/types";

export default function ResidentPage() {
  const [selectedResident, setSelectedResident] = useState<DemoResident>(DEMO_RESIDENTS[0]);
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>({});
  const [checkInState, setCheckInState] = useState<"safe" | "need_help" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Poll status from risk engine
  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/risk-engine");
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.statuses) {
            setStatuses(data.statuses);
          }
        }
      } catch {
        // Ignored
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCheckIn = async (state: "safe" | "need_help") => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/resident/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resident_id: selectedResident.id,
          state,
        }),
      });
      if (res.ok) {
        setCheckInState(state);
        setMessage(
          state === "safe"
            ? "Status recorded: You are marked SAFE. Guards have been informed."
            : "SOS Sent! Emergency response guards have been alerted with your location and specific needs.",
        );
      }
    } catch {
      setMessage("Failed to transmit check-in. Please contact security directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const drainStatus = statuses[selectedResident.drain_id] ?? {
    drain_id: selectedResident.drain_id,
    level_cm: 0,
    status: "green",
    rate_cm_per_min: 0,
    minutes_to_red: null,
    street_depth_cm: 0,
  };

  const isRed = drainStatus.status === "red";
  const isAmber = drainStatus.status === "amber";

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900 tracking-tight">HydroTwin Resident</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">Bukit Raja</span>
            </div>
            <p className="text-[11px] text-stone-500">Live Resident Early Warning & Safety</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Map</Link>
            <Link href="/control" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Control</Link>
            <Link href="/guard" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Guard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Resident Persona Picker */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <label htmlFor="resident-select" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
            Select Resident Persona
          </label>
          <select
            id="resident-select"
            value={selectedResident.id}
            onChange={(e) => {
              const res = DEMO_RESIDENTS.find((r) => r.id === e.target.value);
              if (res) {
                setSelectedResident(res);
                setCheckInState(null);
                setMessage(null);
              }
            }}
            className="w-full text-sm font-medium bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {DEMO_RESIDENTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name} — {r.street_name} (Zone {r.drain_id})
                {r.vulnerable ? " ⚠️" : ""}
              </option>
            ))}
          </select>

          <div className="mt-3 text-xs bg-stone-50 rounded-lg p-2.5 border border-stone-200/80 space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Registered Street:</span>
              <span className="font-medium text-stone-800">{selectedResident.street_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Drain Sub-basin:</span>
              <span className="font-mono font-medium text-stone-800">{selectedResident.drain_id}</span>
            </div>
            {selectedResident.vulnerable && (
              <div className="pt-1 border-t border-stone-200 text-rose-700 font-medium flex items-center gap-1">
                <span>⚠️ Vulnerable profile:</span>
                <span className="text-stone-700">{selectedResident.needs}</span>
              </div>
            )}
          </div>
        </section>

        {/* Live Status Card */}
        <section
          className={`rounded-xl border p-4 shadow-xs transition-colors duration-300 ${
            isRed
              ? "bg-rose-50/70 border-rose-300"
              : isAmber
              ? "bg-amber-50/70 border-amber-300"
              : "bg-emerald-50/70 border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Your Street Condition
            </span>
            <span
              className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                isRed
                  ? "bg-rose-600 text-white"
                  : isAmber
                  ? "bg-amber-500 text-white animate-pulse"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {drainStatus.status}
            </span>
          </div>

          <div className="my-2">
            {isRed ? (
              <div>
                <div className="text-2xl font-black text-rose-700">
                  {drainStatus.street_depth_cm.toFixed(1)} cm
                  <span className="text-xs font-medium text-rose-800 ml-1.5">water on street</span>
                </div>
                <p className="text-xs text-rose-700 font-medium mt-1">
                  🚨 Drain {selectedResident.drain_id} has exceeded bank capacity. Flooding in progress.
                </p>
              </div>
            ) : isAmber ? (
              <div>
                <div className="text-2xl font-black text-amber-800">
                  {drainStatus.minutes_to_red ? `~${drainStatus.minutes_to_red} mins` : "Approaching Bank"}
                  <span className="text-xs font-medium text-amber-700 ml-1.5">to street overflow</span>
                </div>
                <p className="text-xs text-amber-800 font-medium mt-1">
                  ⚠️ Water is rising at {drainStatus.rate_cm_per_min} cm/min. Canal is {Math.round((drainStatus.level_cm / 120) * 100)}% full.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-black text-emerald-700">Safe & Clear</div>
                <p className="text-xs text-emerald-700 mt-1">
                  Canal level at {drainStatus.level_cm} cm. Water drainage is functioning normally.
                </p>
              </div>
            )}
          </div>

          {/* Action guidance */}
          <div className="mt-3 pt-3 border-t border-stone-200/60">
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">Recommended Action:</span>
            <p className="text-xs text-stone-800 font-medium mt-0.5">
              {isRed
                ? "Do NOT walk or drive through standing water. Move to upper floor if ground floor is inundated. Tap 'I Need Help' if stranded."
                : isAmber
                ? "MOVE YOUR VEHICLE to the elevated multi-storey car park or commercial area now. Secure ground-floor valuables."
                : "No immediate precautions required. Keep drainage grates clear of leaves."}
            </p>
          </div>
        </section>

        {/* Safety Check-in Section */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-stone-900 mb-1">Safety Status Check-In</h2>
          <p className="text-xs text-stone-500 mb-3">
            Inform township security guards and response teams of your condition.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleCheckIn("safe")}
              disabled={submitting}
              className={`py-3 px-3 rounded-lg font-semibold text-xs flex flex-col items-center justify-center gap-1 border transition ${
                checkInState === "safe"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
              }`}
            >
              <span className="text-base">✅</span>
              <span>I&apos;m Safe</span>
            </button>

            <button
              onClick={() => handleCheckIn("need_help")}
              disabled={submitting}
              className={`py-3 px-3 rounded-lg font-semibold text-xs flex flex-col items-center justify-center gap-1 border transition ${
                checkInState === "need_help"
                  ? "bg-rose-600 text-white border-rose-700 shadow-xs animate-pulse"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300"
              }`}
            >
              <span className="text-base">🆘</span>
              <span>I Need Help</span>
            </button>
          </div>

          {message && (
            <div className="mt-3 p-2.5 rounded-lg bg-stone-100 text-stone-800 text-xs border border-stone-200">
              {message}
            </div>
          )}
        </section>

        {/* Evacuation Route link */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-stone-900">Evacuation Safe Routes</h3>
            <p className="text-[11px] text-stone-500">Navigate to Bukit Raja High Ground avoiding flooded roads</p>
          </div>
          <Link
            href="/?tab=route"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition"
          >
            View Route
          </Link>
        </section>
      </main>
    </div>
  );
}
