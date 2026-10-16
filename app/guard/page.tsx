"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DrainStatus, GuardTask } from "@/lib/engine/types";

export default function GuardPage() {
  const [tasks, setTasks] = useState<GuardTask[]>([]);
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>({});
  const [filter, setFilter] = useState<"all" | "sos" | "done">("all");
  const [loading, setLoading] = useState(true);

  // Poll tasks and status
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const [taskRes, statusRes] = await Promise.all([
          fetch("/api/guard-tasks"),
          fetch("/api/risk-engine"),
        ]);
        if (taskRes.ok && statusRes.ok && mounted) {
          const taskData = await taskRes.json();
          const statusData = await statusRes.json();
          if (taskData.guardTasks) setTasks(taskData.guardTasks);
          if (statusData.statuses) setStatuses(statusData.statuses);
          setLoading(false);
        }
      } catch {
        // Ignored
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCloseTask = async (taskId: string | number) => {
    try {
      const res = await fetch("/api/guard-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, state: "done" } : t)),
        );
      }
    } catch {
      // Ignored
    }
  };

  const redDrains = Object.values(statuses).filter((s) => s.status === "red");
  const sosCount = tasks.filter((t) => t.check_in_state === "need_help" && t.state === "open").length;
  const openCount = tasks.filter((t) => t.state === "open").length;
  const doneCount = tasks.filter((t) => t.state === "done").length;

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filter === "sos") return t.check_in_state === "need_help";
    if (filter === "done") return t.state === "done";
    return true;
  }).sort((a, b) => {
    // SOS priority first
    if (a.check_in_state === "need_help" && b.check_in_state !== "need_help") return -1;
    if (b.check_in_state === "need_help" && a.check_in_state !== "need_help") return 1;
    // Open before done
    if (a.state === "open" && b.state === "done") return -1;
    if (a.state === "done" && b.state === "open") return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900 tracking-tight">HydroTwin Guard Response</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-white font-medium">Duty Desk</span>
            </div>
            <p className="text-[11px] text-stone-500">Bukit Raja Security & Auxiliary Police</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Map</Link>
            <Link href="/control" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Control</Link>
            <Link href="/resident" className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium">Resident</Link>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Incident Summary Metric Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs">
            <div className="text-[11px] text-stone-500 font-medium">Red Zones</div>
            <div className="text-xl font-bold font-mono text-rose-600 mt-0.5">
              {redDrains.length}
              <span className="text-xs text-stone-400 font-normal"> / 10</span>
            </div>
          </div>
          <div className={`p-3 rounded-xl border shadow-xs ${sosCount > 0 ? "bg-rose-50 border-rose-300 animate-pulse" : "bg-white border-stone-200"}`}>
            <div className="text-[11px] text-rose-700 font-medium">SOS Help Calls</div>
            <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">{sosCount}</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs">
            <div className="text-[11px] text-stone-500 font-medium">Active Tasks</div>
            <div className="text-xl font-bold font-mono text-stone-900 mt-0.5">
              {openCount}
              <span className="text-xs text-stone-400 font-normal"> ({doneCount} done)</span>
            </div>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex rounded-lg bg-stone-200 p-0.5 text-xs font-medium">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-1.5 rounded-md transition ${filter === "all" ? "bg-white text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"}`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setFilter("sos")}
            className={`flex-1 py-1.5 rounded-md transition ${filter === "sos" ? "bg-rose-600 text-white shadow-xs" : "text-stone-600 hover:text-stone-900"}`}
          >
            SOS Calls ({sosCount})
          </button>
          <button
            onClick={() => setFilter("done")}
            className={`flex-1 py-1.5 rounded-md transition ${filter === "done" ? "bg-white text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"}`}
          >
            Completed ({doneCount})
          </button>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-8 text-xs text-stone-500">Loading incident tasks...</div>
          )}

          {!loading && filteredTasks.length === 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-xs text-stone-500 shadow-xs">
              <span className="text-2xl block mb-2">🛡️</span>
              {filter === "sos"
                ? "No SOS distress calls received."
                : redDrains.length === 0
                ? "All drains within safe bank levels. No vulnerable residents currently at risk."
                : "No matching tasks found."}
            </div>
          )}

          {filteredTasks.map((t) => {
            const drain = statuses[t.drain_id];
            const isRedZone = drain?.status === "red";
            const isDone = t.state === "done";
            const isSos = t.check_in_state === "need_help";

            return (
              <div
                key={t.id}
                className={`rounded-xl border p-4 shadow-xs transition-all ${
                  isDone
                    ? "bg-stone-50 border-stone-200 opacity-60"
                    : isSos
                    ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400"
                    : isRedZone
                    ? "bg-amber-50/60 border-amber-300"
                    : "bg-white border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-stone-900 text-sm">{t.resident_name}</span>
                      {isSos && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wide animate-pulse">
                          🆘 SOS HELP
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Assisted
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {t.street_name || "Street"} · Zone <span className="font-mono font-semibold">{t.drain_id}</span>
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      isRedZone
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {drain?.street_depth_cm ? `${drain.street_depth_cm}cm water` : "At Risk"}
                  </span>
                </div>

                {t.needs && (
                  <div className="mt-2.5 p-2 bg-white/80 rounded-lg border border-stone-200/80 text-xs">
                    <span className="font-semibold text-stone-700">Special Vulnerability: </span>
                    <span className="text-stone-600">{t.needs}</span>
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-stone-500">
                    {t.check_in_state === "safe" ? "✅ Resident reported safe" : isSos ? "🚨 Needs evacuation support" : "Awaiting check-in"}
                  </span>

                  {!isDone ? (
                    <button
                      onClick={() => handleCloseTask(t.id)}
                      className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition"
                    >
                      Mark Assisted ✓
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-700 font-semibold">Done ✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
