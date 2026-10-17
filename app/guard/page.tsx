"use client";

// Guard phone page — the duty desk. New help calls beep (after one "Start shift" tap: browsers block
// sound until a gesture), each card shows what was asked and how long it has waited, and moves
// On my way → Resolved. "Route" draws the way from the nearest guard post (lib/engine/help.ts).

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import ResponderMap from "@/components/ResponderMap";
import { GUARDS, GUARD_POSTS } from "@/lib/guards-data";
import { findResponderRoute, HELP_TYPES, type ResponderOutcome } from "@/lib/engine/help";
import type { StreetFeature } from "@/lib/engine/route";
import type { DrainStatus, GuardTask, HelpType, Status, TaskState } from "@/lib/engine/types";

const POLL_MS = 1500;
const GUARD_KEY = "hydrotwin_guard_name";
const BUKIT_RAJA_CENTER: [number, number] = [101.4392, 3.0865];

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
const elapsed = (fromIso: string, now: number) => {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const helpLabel = (id: HelpType | null | undefined) => HELP_TYPES.find((t) => t.id === id)?.label ?? "Help needed";

const ROUTE_MESSAGE: Record<Exclude<ResponderOutcome, "found">, string> = {
  posts_blocked: "Both guard posts are on flooded streets right now.",
  unreachable: "No road in our data connects a guard post to this street.",
  resident_unknown: "This street has no flood status yet.",
  invalid_resident: "This resident's street is missing from the road data.",
  no_posts: "No guard posts configured.",
};

const STATE_BADGE: Record<TaskState, { label: string; className: string }> = {
  open: { label: "Waiting", className: "bg-amber-100 text-amber-800" },
  on_the_way: { label: "On the way", className: "bg-blue-600 text-white" },
  done: { label: "Assisted", className: "bg-emerald-100 text-emerald-800" },
};

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported (iOS)
  }
}

function beep(ctx: AudioContext, freq: number, at: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + at);
  osc.stop(ctx.currentTime + at + dur + 0.05);
}

// Which guard this phone is — a per-phone convenience kept in localStorage (memory when that is blocked).
let memoryGuard = GUARDS[0];
const guardListeners = new Set<() => void>();
const guardStore = {
  subscribe(cb: () => void) {
    guardListeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      guardListeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  },
  get() {
    try {
      const saved = localStorage.getItem(GUARD_KEY);
      if (saved && GUARDS.includes(saved)) return saved;
    } catch {
      // storage unavailable
    }
    return memoryGuard;
  },
  getServerSnapshot: () => GUARDS[0],
  set(name: string) {
    memoryGuard = name;
    try {
      localStorage.setItem(GUARD_KEY, name);
    } catch {
      // storage unavailable
    }
    guardListeners.forEach((cb) => cb());
  },
};

export default function GuardPage() {
  const guard = useSyncExternalStore(guardStore.subscribe, guardStore.get, guardStore.getServerSnapshot);
  const [shiftOn, setShiftOn] = useState(false);
  const [tasks, setTasks] = useState<GuardTask[]>([]);
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>({});
  const [streets, setStreets] = useState<StreetFeature[] | null>(null);
  const [filter, setFilter] = useState<"all" | "sos" | "mine" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [routeTaskId, setRouteTaskId] = useState<string | number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const announced = useRef<Set<string> | null>(null); // live tasks already alerted; null until the first poll

  const pickGuard = guardStore.set;

  // Poll tasks and statuses from the laptop running the server.
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const [taskRes, statusRes] = await Promise.all([fetch("/api/guard-tasks"), fetch("/api/risk-engine")]);
        if (!mounted) return;
        if (taskRes.ok) {
          const data = await taskRes.json();
          if (mounted && data.guardTasks) setTasks(data.guardTasks);
        }
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (mounted && data.statuses) setStatuses(data.statuses);
        }
        if (mounted) setLoading(false);
      } catch {
        // offline: keep the last values on screen
      }
    };
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Road data for the route (Bukit Raja only — the phone pages are, like the residents).
  useEffect(() => {
    let mounted = true;
    fetch("/data/bukit-raja/streets.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (mounted && geo?.features) setStreets(geo.features as StreetFeature[]);
      })
      .catch(() => {
        // the route panel says so
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Alert on tasks that are new since the last poll (a resident escalating to need_help counts as new).
  useEffect(() => {
    const live = tasks.filter((t) => t.state !== "done");
    const keyOf = (t: GuardTask) => `${t.id}:${t.check_in_state ?? ""}`;
    if (announced.current === null) {
      announced.current = new Set(live.map(keyOf));
      return;
    }
    const fresh = live.filter((t) => !announced.current!.has(keyOf(t)));
    if (!fresh.length) return;
    for (const t of fresh) announced.current.add(keyOf(t));
    const sos = fresh.some((t) => t.check_in_state === "need_help");
    vibrate(sos ? [300, 100, 300, 100, 300] : [200]);
    const ctx = audio.current;
    if (ctx) {
      if (sos) {
        beep(ctx, 880, 0, 0.15);
        beep(ctx, 880, 0.22, 0.15);
        beep(ctx, 1175, 0.44, 0.3);
      } else {
        beep(ctx, 660, 0, 0.2);
      }
    }
  }, [tasks]);

  const startShift = () => {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      beep(audio.current, 660, 0, 0.12);
    } catch {
      // no Web Audio: the desk still works, silently
    }
    setShiftOn(true);
  };

  const act = async (taskId: string | number, action: "accept" | "resolve") => {
    try {
      const res = await fetch("/api/guard-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action, responder: guard }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Could not update the task.");
        setTimeout(() => setNotice(null), 3500);
        return;
      }
      if (data.task) setTasks((prev) => prev.map((t) => (t.id === data.task.id ? data.task : t)));
    } catch {
      setNotice("No connection to the HydroTwin server.");
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const statusMap = useMemo(
    () => Object.fromEntries(Object.entries(statuses).map(([id, s]) => [id, s.status])) as Record<string, Status>,
    [statuses],
  );
  const routeTask = tasks.find((t) => t.id === routeTaskId) ?? null;
  const route = useMemo(
    () => (routeTask && streets ? findResponderRoute(streets, GUARD_POSTS, routeTask.street_id, statusMap) : null),
    [routeTask, streets, statusMap],
  );

  const redDrains = Object.values(statuses).filter((s) => s.status === "red");
  const live = tasks.filter((t) => t.state !== "done");
  const sosCount = live.filter((t) => t.check_in_state === "need_help").length;
  const doneCount = tasks.length - live.length;

  const visible = tasks
    .filter((t) => {
      if (filter === "sos") return t.check_in_state === "need_help" && t.state !== "done";
      if (filter === "mine") return t.state === "on_the_way" && t.responder_name === guard;
      if (filter === "done") return t.state === "done";
      return true;
    })
    .sort((a, b) => {
      const rank = (t: GuardTask) => (t.state === "done" ? 3 : t.check_in_state === "need_help" ? 0 : t.state === "open" ? 1 : 2);
      return rank(a) - rank(b) || b.created_at.localeCompare(a.created_at);
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
        {/* Who is on duty + sound */}
        <section className="bg-white rounded-xl border border-stone-200 p-3 shadow-xs flex items-center gap-3">
          <label className="flex-1 text-xs">
            <span className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider">On duty</span>
            <select
              value={guard}
              onChange={(e) => pickGuard(e.target.value)}
              className="mt-0.5 w-full text-sm font-semibold bg-stone-50 border border-stone-300 rounded-lg p-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              {GUARDS.map((g) => (
                <option key={g} value={g}>Guard {g}</option>
              ))}
            </select>
          </label>
          {shiftOn ? (
            <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">🔔 Alerts on</span>
          ) : (
            <button onClick={startShift} className="px-3 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs whitespace-nowrap">
              🔔 Start shift
            </button>
          )}
        </section>
        {!shiftOn && (
          <p className="text-[11px] text-stone-500 -mt-2 px-1">One tap on Start shift lets this phone sound new help calls.</p>
        )}

        {/* Incident summary */}
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
              {live.length}
              <span className="text-xs text-stone-400 font-normal"> ({doneCount} done)</span>
            </div>
          </div>
        </div>

        {/* Route panel */}
        {routeTask && (
          <section className="bg-white rounded-xl border border-violet-300 p-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">Route to {routeTask.resident_name}</h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  {!streets
                    ? "Loading road data…"
                    : route?.found
                    ? `From ${route.post?.name} · ${route.dry_m} m dry${route.water_m ? ` + ${route.water_m} m through water` : ""}${route.uses_amber ? " · uses amber roads" : ""}`
                    : route
                    ? ROUTE_MESSAGE[route.outcome as Exclude<ResponderOutcome, "found">]
                    : ""}
                </p>
              </div>
              <button onClick={() => setRouteTaskId(null)} aria-label="Close route" className="px-2 py-1 rounded text-stone-500 hover:bg-stone-100">✕</button>
            </div>
            <div className="mt-2">
              <ResponderMap streets={streets ?? []} statuses={statusMap} route={route} center={BUKIT_RAJA_CENTER} />
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              Walking route on OpenStreetMap roads under the current simulated statuses; the dashed part is through water. Not a verified evacuation plan.
            </p>
          </section>
        )}

        {/* Filters */}
        <div className="flex rounded-lg bg-stone-200 p-0.5 text-xs font-medium">
          {([["all", `All (${tasks.length})`], ["sos", `SOS (${sosCount})`], ["mine", "Mine"], ["done", `Done (${doneCount})`]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`flex-1 py-1.5 rounded-md transition ${
                filter === id ? (id === "sos" ? "bg-rose-600 text-white shadow-xs" : "bg-white text-stone-900 shadow-xs") : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice && <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs">{notice}</div>}

        {/* Tasks */}
        <div className="space-y-3">
          {loading && <div className="text-center py-8 text-xs text-stone-500">Loading incident tasks...</div>}

          {!loading && visible.length === 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-xs text-stone-500 shadow-xs">
              <span className="text-2xl block mb-2">🛡️</span>
              {filter === "sos"
                ? "No SOS calls open."
                : filter === "mine"
                ? `Nothing on the way for Guard ${guard}.`
                : redDrains.length === 0
                ? "All drains within safe bank levels. No vulnerable residents currently at risk."
                : "No matching tasks."}
            </div>
          )}

          {visible.map((t) => {
            const drain = statuses[t.drain_id];
            const isRedZone = drain?.status === "red";
            const isDone = t.state === "done";
            const isSos = t.check_in_state === "need_help" && !isDone;
            const badge = STATE_BADGE[t.state];
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-4 shadow-xs transition-all ${
                  isDone ? "bg-stone-50 border-stone-200 opacity-70" : isSos ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400" : isRedZone ? "bg-amber-50/60 border-amber-300" : "bg-white border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-stone-900 text-sm">{t.resident_name}</span>
                      {isSos && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wide animate-pulse">🆘 SOS</span>
                      )}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {t.street_name || "Street"} · Zone <span className="font-mono font-semibold">{t.drain_id}</span>
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${isRedZone ? "bg-rose-100 text-rose-800" : drain?.status === "amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {isRedZone ? `${drain.street_depth_cm.toFixed(0)} cm water` : drain?.status === "amber" ? "Rising" : "Clear"}
                  </span>
                </div>

                {t.check_in_state === "need_help" && (
                  <div className="mt-2.5 p-2 bg-white/80 rounded-lg border border-rose-200 text-xs">
                    <span className="font-semibold text-rose-800">{helpLabel(t.help_type)}</span>
                    <span className="text-stone-700"> · {t.people ?? 1} {(t.people ?? 1) === 1 ? "person" : "people"}</span>
                    {t.note && <div className="text-stone-700 mt-0.5">“{t.note}”</div>}
                  </div>
                )}
                {t.needs && (
                  <div className="mt-2 p-2 bg-white/80 rounded-lg border border-stone-200/80 text-xs">
                    <span className="font-semibold text-stone-700">Profile: </span>
                    <span className="text-stone-600">{t.needs}</span>
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-stone-500">
                    {isDone
                      ? `Resolved ${t.done_at ? timeOf(t.done_at) : ""}${t.responder_name ? ` by ${t.responder_name}` : ""}`
                      : t.state === "on_the_way"
                      ? `${t.responder_name ?? "A guard"} on the way · ${now ? elapsed(t.accepted_at ?? t.created_at, now) : "—"}`
                      : t.check_in_state === "safe"
                      ? "✅ Resident reported safe"
                      : `Waiting · ${now ? elapsed(t.created_at, now) : "—"} · since ${timeOf(t.created_at)}`}
                  </span>
                  {!isDone ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setRouteTaskId(routeTaskId === t.id ? null : t.id)}
                        aria-pressed={routeTaskId === t.id}
                        className="px-2.5 py-1.5 rounded-lg border border-violet-300 text-violet-800 text-xs font-semibold hover:bg-violet-50"
                      >
                        Route
                      </button>
                      {t.state === "open" ? (
                        <button onClick={() => act(t.id, "accept")} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs">
                          On my way
                        </button>
                      ) : (
                        <button onClick={() => act(t.id, "resolve")} className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs">
                          Resolved ✓
                        </button>
                      )}
                    </div>
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
