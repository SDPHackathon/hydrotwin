"use client";

// Guard phone page — the duty desk. New help calls beep (after one "Start shift" tap: browsers block
// sound until a gesture), each card shows what was asked and how long it has waited, and moves
// On my way → Resolved. "Route" draws the way from the nearest guard post (lib/engine/help.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhoneHeader from "@/components/PhoneHeader";
import {
  translate,
  translateResidentNeeds,
  translateHelpType,
  translateTaskOutcome,
} from "@/lib/translations";
import { useLanguage } from "@/lib/language";
import ResponderMap, { MAP_ATTRIBUTION } from "@/components/ResponderMap";
import { GUARDS, GUARD_POSTS } from "@/lib/guards-data";
import { useStoredValue } from "@/lib/useStoredValue";
import { effectiveFlood } from "@/lib/engine/evacuation";
import {
  findResponderRoute,
  TASK_OUTCOMES,
  type ResponderOutcome,
} from "@/lib/engine/help";
import type { StreetFeature } from "@/lib/engine/route";
import type {
  DrainStatus,
  GuardTask,
  HelpType,
  Status,
  TaskOutcome,
  TaskState,
} from "@/lib/engine/types";

const POLL_MS = 1500;
const EMPTY_STATUSES: Record<string, Status | undefined> = {};
const GUARD_KEY = "hydrotwin_guard_name";
const BUKIT_RAJA_CENTER: [number, number] = [101.4392, 3.0865];
const ACTION_COOLDOWN_MS = 600; // "On my way" turns into "Resolved" in the same spot — swallow the second tap of a double-tap
// Clears the sticky header (and the notch when installed full-screen) when scrolling a section into view.
const SCROLL_MARGIN = "scroll-mt-[calc(5.5rem+env(safe-area-inset-top))]";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
  });
const elapsed = (fromIso: string, now: number) => {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const helpLabel = (id: HelpType | null | undefined, language: "en" | "bm") =>
  translateHelpType(id, language);

const ROUTE_MESSAGE: Record<
  Exclude<ResponderOutcome, "found">,
  { en: string; bm: string }
> = {
  posts_blocked: {
    en: "Both guard posts are on flooded streets right now.",
    bm: "Kedua-dua pos pengawal berada di jalan yang dinaiki air sekarang.",
  },
  unreachable: {
    en: "No road in our data connects a guard post to this street.",
    bm: "Tiada jalan dalam data kami yang menghubungkan pos pengawal ke jalan ini.",
  },
  resident_unknown: {
    en: "This street has no flood status yet.",
    bm: "Status banjir untuk jalan ini belum tersedia.",
  },
  invalid_resident: {
    en: "This resident's street is missing from the road data.",
    bm: "Jalan penduduk ini tiada dalam data jalan.",
  },
  no_posts: {
    en: "No guard posts configured.",
    bm: "Tiada pos pengawal yang dikonfigurasikan.",
  },
};

const STATE_BADGE: Record<TaskState, { label: string; className: string }> = {
  open: { label: "Waiting", className: "bg-amber-100 text-amber-800" },
  on_the_way: { label: "On the way", className: "bg-blue-600 text-white" },
  done: { label: "Resolved", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", className: "bg-stone-200 text-stone-700" },
};

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported (iOS)
  }
}

function playTone(ctx: AudioContext, freq: number, atSec: number, durSec: number) {
  try {
    const startTime = ctx.currentTime + atSec;
    const stopTime = startTime + durSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, stopTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(stopTime + 0.05);
  } catch {
    // audio output error ignored
  }
}

interface TaskSnapshot {
  state: TaskState;
  check_in_state?: "safe" | "need_help" | null;
  help_type?: HelpType | null;
  people?: number | null;
  note?: string | null;
}

export default function GuardPage() {
  const { language, toggleLanguage } = useLanguage("guard");
  const [storedGuard, pickGuard] = useStoredValue(GUARD_KEY); // which guard this phone is
  const guard =
    storedGuard && GUARDS.includes(storedGuard) ? storedGuard : GUARDS[0];
  const [shiftOn, setShiftOn] = useState(false);
  const [tasks, setTasks] = useState<GuardTask[]>([]);
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>({});
  const [routeContext, setRouteContext] = useState<{ area: string; streets: StreetFeature[]; statuses: Record<string, Status | undefined>; center: [number, number] } | null>(null);
  const [filter, setFilter] = useState<"all" | "sos" | "mine" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [routeTaskId, setRouteTaskId] = useState<string | number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | number | null>(null);
  const [resolvingTask, setResolvingTask] = useState<GuardTask | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<TaskOutcome>("confirmed_safe");
  const [otherOutcomeText, setOtherOutcomeText] = useState("");
  const [now, setNow] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const announced = useRef<Set<string> | null>(null); // live tasks already alerted; null until the first poll lands
  const prevTaskSnapshots = useRef<Map<string | number, TaskSnapshot>>(new Map());
  const mutation = useRef(0); // bumped by every successful action, so a poll that started before it can't undo it
  const routePanel = useRef<HTMLElement>(null);

  // Poll tasks and statuses from the laptop running the server.
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const seq = mutation.current;
      try {
        const [taskRes, statusRes] = await Promise.all([
          fetch("/api/guard-tasks"),
          fetch("/api/risk-engine"),
        ]);
        if (!mounted) return;
        if (taskRes.ok) {
          const data = await taskRes.json();
          if (mounted && data.guardTasks && seq === mutation.current)
            setTasks(data.guardTasks);
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

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Notices clear themselves; the timer is cancelled if the page goes away first.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  // iOS suspends the AudioContext when the phone sleeps or the app goes to the background — wake it on return.
  useEffect(() => {
    const wake = () => {
      if (
        document.visibilityState === "visible" &&
        audio.current &&
        audio.current.state !== "running"
      )
        void audio.current.resume();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, []);

  // Bring the route panel (above the list) into view when a card's Route is tapped.
  useEffect(() => {
    if (routeTaskId !== null)
      routePanel.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [routeTaskId]);

  // Auto-unlock audio on ANY user interaction on the page (touch, click, keydown)
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audio.current) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            audio.current = new AudioContextClass();
          }
        }
        if (audio.current && audio.current.state === "suspended") {
          void audio.current.resume();
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("click", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const getAudioContext = async (): Promise<AudioContext | null> => {
    try {
      if (!audio.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audio.current = new AudioContextClass();
        }
      }
      if (audio.current && audio.current.state === "suspended") {
        await audio.current.resume();
      }
      return audio.current;
    } catch {
      return null;
    }
  };

  const soundAlert = useCallback(async (type: "sos" | "task" | "cancelled" | "update" | "safe") => {
    // 1. Device vibration
    if (type === "sos") {
      vibrate([300, 100, 300, 100, 300]);
    } else if (type === "cancelled") {
      vibrate([200, 100, 200]);
    } else {
      vibrate([150, 80, 150]);
    }

    // 2. Audio chime
    const ctx = await getAudioContext();
    if (!ctx) return;

    if (type === "sos") {
      playTone(ctx, 880, 0, 0.15);
      playTone(ctx, 880, 0.22, 0.15);
      playTone(ctx, 1175, 0.44, 0.3);
    } else if (type === "cancelled") {
      // Descending cancellation chime
      playTone(ctx, 600, 0, 0.15);
      playTone(ctx, 440, 0.18, 0.25);
    } else if (type === "update") {
      // Rising update chime
      playTone(ctx, 520, 0, 0.12);
      playTone(ctx, 780, 0.14, 0.2);
    } else if (type === "safe") {
      // Friendly confirmation chime
      playTone(ctx, 600, 0, 0.12);
      playTone(ctx, 880, 0.14, 0.2);
    } else {
      playTone(ctx, 660, 0, 0.2);
    }
  }, []);

  // Alert on tasks that are new since the last poll, or when updated/cancelled by resident.
  useEffect(() => {
    const isInactive = (t: GuardTask) => t.state === "done" || t.state === "cancelled";
    const live = tasks.filter((t) => !isInactive(t));

    // On initial load, establish baseline snapshots without firing alerts
    if (announced.current === null) {
      if (loading) return;
      announced.current = new Set(live.map((t) => String(t.id)));
      for (const t of tasks) {
        prevTaskSnapshots.current.set(t.id, {
          state: t.state,
          check_in_state: t.check_in_state,
          help_type: t.help_type,
          people: t.people,
          note: t.note,
        });
      }
      return;
    }

    // Check for updates or cancellations on existing tasks
    for (const t of tasks) {
      const prev = prevTaskSnapshots.current.get(t.id);
      if (prev) {
        // 1. Cancellation by resident
        if ((prev.state === "open" || prev.state === "on_the_way") && t.state === "cancelled") {
          setNotice(translate(language, "guardCancelledNotice", t.resident_name));
          void soundAlert("cancelled");
        }
        // 2. Safe check-in by resident
        else if (prev.check_in_state !== "safe" && t.check_in_state === "safe" && t.state !== "cancelled" && t.state !== "done") {
          setNotice(translate(language, "guardSafeNotice", t.resident_name));
          void soundAlert("safe");
        }
        // 3. Request details updated by resident (need type, people, note, or renewed need_help)
        else if (
          (prev.state === "open" || prev.state === "on_the_way") &&
          (prev.help_type !== t.help_type ||
           prev.people !== t.people ||
           prev.note !== t.note ||
           (prev.check_in_state !== t.check_in_state && t.check_in_state === "need_help"))
        ) {
          setNotice(translate(language, "guardUpdatedNotice", t.resident_name));
          void soundAlert("update");
        }
      }

      prevTaskSnapshots.current.set(t.id, {
        state: t.state,
        check_in_state: t.check_in_state,
        help_type: t.help_type,
        people: t.people,
        note: t.note,
      });
    }

    // Detect brand new live tasks
    const fresh = live.filter((t) => !announced.current!.has(String(t.id)));
    if (fresh.length) {
      for (const t of fresh) announced.current.add(String(t.id));
      const sos = fresh.some((t) => t.check_in_state === "need_help");
      void soundAlert(sos ? "sos" : "task");
    }
  }, [tasks, loading, language, soundAlert]);

  const startShift = async () => {
    const ctx = await getAudioContext();
    if (ctx) {
      playTone(ctx, 660, 0, 0.15);
    }
    setShiftOn(true);
  };

  const act = async (
    taskId: string | number,
    action: "accept" | "resolve",
    outcome?: TaskOutcome,
    outcome_note?: string | null,
  ) => {
    if (busyTaskId !== null) return;
    setBusyTaskId(taskId);
    try {
      const res = await fetch("/api/guard-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          action,
          responder: guard,
          outcome: action === "resolve" ? outcome : undefined,
          outcome_note: action === "resolve" ? outcome_note : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? translate(language, "couldNotUpdateTask"));
        return;
      }
      if (data.task) {
        mutation.current++;
        setTasks((prev) =>
          prev.map((t) => (t.id === data.task.id ? data.task : t)),
        );
      }
    } catch {
      setNotice(translate(language, "noServerConnection"));
    } finally {
      setTimeout(() => setBusyTaskId(null), ACTION_COOLDOWN_MS);
    }
  };

  const routeTask =
    tasks.find((t) => t.id === routeTaskId && t.state !== "cancelled") ?? null;
  const routeArea = routeTask?.area_slug ?? "bukit-raja";
  useEffect(() => {
    if (routeTaskId === null) return;
    let active = true, deadline = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      const started = Date.now();
      try {
        const [roadsRes, stateRes] = await Promise.all([
          fetch(`/api/township/shared?area=${encodeURIComponent(routeArea)}`, { signal: controller.signal }),
          fetch(`/api/risk-engine?area=${encodeURIComponent(routeArea)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) }),
        ]);
        if (!roadsRes.ok || !stateRes.ok) throw new Error("Route conditions unavailable");
        const bundle = await roadsRes.json(), snapshot = await stateRes.json();
        const flood = effectiveFlood(snapshot.statuses, snapshot.floodEvidence, snapshot.serverNow);
        deadline = started + Math.min(6000, flood.expires_at === null ? 6000 : Math.max(0, flood.expires_at - snapshot.serverNow));
        if (active) setRouteContext({ area: routeArea, streets: bundle.streets.features, center: bundle.area.center,
          statuses: Object.fromEntries(Object.entries(flood.statuses).map(([id, s]) => [id, s.status])) });
      } catch { if (active) setRouteContext(null); }
      finally { if (active) timer = setTimeout(poll, 1500); }
    };
    void poll();
    const expiry = setInterval(() => { if (deadline && Date.now() >= deadline) setRouteContext(null); }, 500);
    return () => { active = false; controller.abort(); clearTimeout(timer); clearInterval(expiry); };
  }, [routeTaskId, routeArea]);
  const streets = routeContext?.area === routeArea ? routeContext.streets : null;
  const routeStatuses = routeContext?.area === routeArea ? routeContext.statuses : EMPTY_STATUSES;
  const route = useMemo(
    () =>
      routeTask && streets
        ? findResponderRoute(streets, routeArea === "bukit-raja" ? GUARD_POSTS : [], routeTask.street_id, routeStatuses, routeTask.position)
        : null,
    [routeTask, streets, routeStatuses, routeArea],
  );

  const redDrains = Object.values(statuses).filter((s) => s.status === "red");
  const isInactive = (t: GuardTask) => t.state === "done" || t.state === "cancelled";
  const live = tasks.filter((t) => !isInactive(t));
  const sosCount = live.filter((t) => t.check_in_state === "need_help").length;
  const doneCount = tasks.filter(isInactive).length;

  const visible = tasks
    .filter((t) => {
      if (filter === "sos")
        return t.check_in_state === "need_help" && !isInactive(t);
      if (filter === "mine")
        return t.state === "on_the_way" && t.responder_name === guard;
      if (filter === "done") return isInactive(t);
      return true;
    })
    .sort((a, b) => {
      const rank = (t: GuardTask) =>
        isInactive(t)
          ? 3
          : t.check_in_state === "need_help"
            ? 0
            : t.state === "open"
              ? 1
              : 2;
      return rank(a) - rank(b) || b.created_at.localeCompare(a.created_at);
    });

  return (
    <div className="min-h-screen touch-manipulation bg-stone-100 text-stone-900 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <PhoneHeader
        title={translate(language, "guardTitle")}
        badge={language === "en" ? "Duty Desk" : "Meja Kawalan"}
        badgeClassName="bg-stone-200 text-stone-800"
        subtitle={translate(language, "guardSubtitle")}
        language={language}
        onToggleLanguage={toggleLanguage}
      />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Guard Persona Picker + Shift Toggle */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="guard-select"
                className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1"
              >
                {language === "en" ? "On Duty" : "Sedang bertugas"}
              </label>
              <select
                id="guard-select"
                value={guard}
                onChange={(e) => pickGuard(e.target.value)}
                className="w-full text-base font-bold bg-stone-50 border border-stone-300 rounded-lg p-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                {GUARDS.map((g) => (
                  <option key={g} value={g}>
                    {language === "en"
                      ? `Guard ${g}`
                      : `Pengawal ${g}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="shrink-0 text-right">
              {shiftOn ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {language === "en" ? "Alerts on" : "Makluman aktif"}
                </div>
              ) : (
                <button
                  onClick={startShift}
                  className="min-h-11 px-3.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  <span>
                    {language === "en" ? "Start shift" : "Mula syif"}
                  </span>
                </button>
              )}
            </div>
          </div>
          {!shiftOn && (
            <p className="mt-2 text-[11px] text-stone-500">
              {language === "en"
                ? "One tap on Start shift lets this phone sound new help calls."
                : "Satu sentuhan pada Mula syif membolehkan telefon membunyikan panggilan bantuan baharu."}
            </p>
          )}
        </section>

        {/* Status Strip */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div
            className={`p-2.5 rounded-xl border ${redDrains.length > 0 ? "bg-rose-50 border-rose-300 text-rose-900" : "bg-white border-stone-200 text-stone-700"} shadow-xs`}
          >
            <div className="text-xl font-black">{redDrains.length}</div>
            <div className="text-[11px] font-medium text-stone-500">
              {language === "en" ? "Red Zones" : "Zon Bahaya"}
            </div>
          </div>
          <div
            className={`p-2.5 rounded-xl border ${sosCount > 0 ? "bg-rose-50 border-rose-300 text-rose-900 animate-pulse" : "bg-white border-stone-200 text-stone-700"} shadow-xs`}
          >
            <div className="text-xl font-black">{sosCount}</div>
            <div className="text-[11px] font-medium text-stone-500">
              {language === "en" ? "SOS Calls" : "Panggilan SOS"}
            </div>
          </div>
          <div className="p-2.5 rounded-xl border bg-white border-stone-200 text-stone-700 shadow-xs">
            <div className="text-xl font-black">{live.length}</div>
            <div className="text-[11px] font-medium text-stone-500">
              {language === "en" ? "Active Tasks" : "Tugasan Aktif"}
            </div>
          </div>
        </div>

        {/* Route panel */}
        {routeTask && (
          <section
            ref={routePanel}
            className={`bg-white rounded-xl border border-violet-300 p-4 shadow-sm ${SCROLL_MARGIN}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
                    {language === "en"
                      ? `Route to ${routeTask.resident_name}`
                      : `Laluan ke ${routeTask.resident_name}`}
                  </span>
                  {routeTask.check_in_state === "need_help" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wide">
                      SOS
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mt-0.5 font-medium">
                  {!streets
                    ? language === "en"
                      ? "Loading road data…"
                      : "Memuatkan data jalan…"
                    : route?.found
                      ? language === "en"
                        ? `From ${route.post?.name} · ${route.dry_m} m dry${route.water_m ? ` + ${route.water_m} m through water` : ""}${route.uses_amber ? " · uses amber roads" : ""}`
                        : `Dari ${route.post?.name} · ${route.dry_m} m laluan kering${route.water_m ? ` + ${route.water_m} m melalui air` : ""}${route.uses_amber ? " · menggunakan jalan ambar" : ""}`
                      : route
                        ? ROUTE_MESSAGE[
                            route.outcome as Exclude<ResponderOutcome, "found">
                          ][language]
                        : ""}
                </p>
              </div>
              <button
                onClick={() => setRouteTaskId(null)}
                aria-label="Close route"
                className="h-10 w-10 -mr-1.5 -mt-1.5 shrink-0 rounded-lg text-stone-500 hover:bg-stone-100 flex items-center justify-center font-bold"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-2">
              <ResponderMap
                streets={streets ?? []}
                statuses={routeStatuses}
                route={route}
                center={routeContext?.center ?? BUKIT_RAJA_CENTER}
                key={routeArea}
              />
            </div>
            <p className="mt-1 text-[10px] text-stone-500">{MAP_ATTRIBUTION}</p>
            <p className="mt-1.5 text-[11px] text-stone-500">
              {translate(language, "guardRouteDisclaimer")}
            </p>
          </section>
        )}

        {/* Filters */}
        <div className="flex rounded-lg bg-stone-200 p-0.5 text-xs font-medium">
          {(
            [
              [
                "all",
                `${language === "en" ? "All" : "Semua"} (${tasks.length})`,
              ],
              ["sos", `SOS (${sosCount})`],
              ["mine", language === "en" ? "Mine" : "Tugasan Saya"],
              [
                "done",
                `${language === "en" ? "Done" : "Selesai"} (${doneCount})`,
              ],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`flex-1 min-h-10 rounded-md transition ${
                filter === id
                  ? id === "sos"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-amber-700"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="truncate">{notice}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-stone-500 hover:text-stone-800 text-sm font-bold px-1"
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Tasks */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-8 text-xs text-stone-500">
              {language === "en"
                ? "Loading incident tasks..."
                : "Memuatkan tugasan insiden..."}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-xs text-stone-500 shadow-xs">
              <div className="flex justify-center mb-2.5 text-stone-400">
                <svg
                  aria-hidden="true"
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12l3 3 5-6" />
                </svg>
              </div>
              {filter === "sos"
                ? language === "en"
                  ? "No SOS calls open."
                  : "Tiada panggilan SOS aktif."
                : filter === "mine"
                  ? language === "en"
                    ? `Nothing on the way for Guard ${guard}.`
                    : `Tiada tugasan dalam perjalanan untuk Pengawal ${guard}.`
                  : redDrains.length === 0
                    ? language === "en"
                      ? "All drains within safe bank levels. No vulnerable residents currently at risk."
                      : "Semua longkang berada pada paras yang selamat. Tiada penduduk berisiko yang memerlukan bantuan buat masa ini."
                    : language === "en"
                      ? "No matching tasks."
                      : "Tiada tugasan yang sepadan."}
            </div>
          )}

          {visible.map((t) => {
            const drain = !t.area_slug || t.area_slug === "bukit-raja" ? statuses[t.drain_id] : undefined;
            const isRedZone = drain?.status === "red";
            const isDone = t.state === "done";
            const isCancelled = t.state === "cancelled";
            const isSos = t.check_in_state === "need_help" && !isDone && !isCancelled;
            const badge = STATE_BADGE[t.state];
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-4 shadow-xs transition-all ${
                  isCancelled
                    ? "bg-stone-50 border-stone-200 opacity-60"
                    : isDone
                      ? "bg-stone-50 border-stone-200 opacity-75"
                      : isSos
                        ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400"
                        : isRedZone
                          ? "bg-amber-50/60 border-amber-300"
                          : "bg-white border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-stone-900 text-sm">
                        {t.resident_name}
                      </span>
                      {isSos && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wide animate-pulse">
                          <svg
                            aria-hidden="true"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="shrink-0"
                          >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                          </svg>
                          <span>SOS</span>
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.className}`}
                      >
                        {language === "en"
                          ? badge.label
                          : t.state === "open"
                            ? "Menunggu"
                            : t.state === "on_the_way"
                              ? "Dalam perjalanan"
                              : t.state === "cancelled"
                                ? "Dibatalkan"
                                : "Selesai"}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {t.area_name ? `${t.area_name} · ` : ""}{t.street_name || "Street"} · Zone{" "}
                      <span className="font-mono font-semibold">
                        {t.drain_id}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${isRedZone ? "bg-rose-100 text-rose-800" : drain?.status === "amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                  >
                    {isRedZone
                      ? language === "en"
                        ? `${drain.street_depth_cm.toFixed(0)} cm water`
                        : `Air ${drain.street_depth_cm.toFixed(0)} cm`
                      : drain?.status === "amber"
                        ? language === "en"
                          ? "Rising"
                          : "Meningkat"
                        : language === "en"
                          ? "Clear"
                          : "Selamat"}
                  </span>
                </div>

                {t.check_in_state === "need_help" && (
                  <div className="mt-2.5 p-2 bg-white/80 rounded-lg border border-rose-200 text-xs">
                    <span className="font-semibold text-rose-800">
                      {helpLabel(t.help_type, language)}
                    </span>
                    <span className="text-stone-700">
                      {" "}
                      · {t.people ?? 1}{" "}
                      {language === "en"
                        ? (t.people ?? 1) === 1
                          ? "person"
                          : "people"
                        : "orang"}
                    </span>
                    {t.note && (
                      <div className="text-stone-700 mt-0.5 wrap-break-word">
                        “{t.note}”
                      </div>
                    )}
                  </div>
                )}
                {t.needs && (
                  <div className="mt-2 p-2 bg-white/80 rounded-lg border border-stone-200/80 text-xs">
                    <span className="font-semibold text-stone-700">
                      {language === "en" ? "Profile:" : "Profil:"}{" "}
                    </span>
                    <span className="text-stone-600">
                      {translateResidentNeeds(t.needs, language)}
                    </span>
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between gap-2">
                  <span className="min-w-0 text-[11px] leading-snug text-stone-500">
                    {isCancelled
                      ? language === "en"
                        ? `Cancelled by resident${t.cancelled_at ? ` · ${timeOf(t.cancelled_at)}` : ""}`
                        : `Dibatalkan oleh penduduk${t.cancelled_at ? ` · ${timeOf(t.cancelled_at)}` : ""}`
                      : isDone
                        ? `${
                            language === "en"
                              ? `Resolved ${t.done_at ? timeOf(t.done_at) : ""}${t.responder_name ? ` by Guard ${t.responder_name}` : ""}`
                              : `Selesai ${t.done_at ? timeOf(t.done_at) : ""}${t.responder_name ? ` oleh Pengawal ${t.responder_name}` : ""}`
                          }${t.outcome ? ` · ${translateTaskOutcome(t.outcome, language)}${t.outcome === "other" && t.outcome_note ? ` — ${t.outcome_note}` : ""}` : ""}`
                        : t.state === "on_the_way"
                          ? language === "en"
                            ? `Guard ${t.responder_name ?? ""} on the way · ${now ? elapsed(t.accepted_at ?? t.created_at, now) : "0:00"}`
                            : `Pengawal ${t.responder_name ?? ""} dalam perjalanan · ${now ? elapsed(t.accepted_at ?? t.created_at, now) : "0:00"}`
                          : t.check_in_state === "safe"
                            ? language === "en"
                              ? "Resident reported safe"
                              : "Penduduk melaporkan diri selamat"
                            : language === "en"
                              ? `Waiting · ${now ? elapsed(t.created_at, now) : "0:00"} · since ${timeOf(t.created_at)}`
                              : `Menunggu · ${now ? elapsed(t.created_at, now) : "0:00"} · sejak ${timeOf(t.created_at)}`}
                  </span>
                  {!isDone && !isCancelled && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() =>
                          setRouteTaskId(routeTask?.id === t.id ? null : t.id)
                        }
                        aria-pressed={routeTask?.id === t.id}
                        className={`min-h-10 px-3 rounded-lg border text-xs font-semibold ${
                          routeTask?.id === t.id
                            ? "bg-violet-600 border-violet-600 text-white"
                            : "border-violet-300 text-violet-800 hover:bg-violet-50"
                        }`}
                      >
                        {language === "en" ? "Route" : "Laluan"}
                      </button>
                      {t.state === "open" ? (
                        <button
                          onClick={() => act(t.id, "accept")}
                          disabled={busyTaskId !== null}
                          className="min-h-10 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60"
                        >
                          {language === "en" ? "On my way" : "Dalam perjalanan"}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setResolvingTask(t);
                            setSelectedOutcome("confirmed_safe");
                            setOtherOutcomeText("");
                          }}
                          disabled={busyTaskId !== null}
                          className="min-h-10 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs disabled:opacity-60"
                        >
                          <span className="inline-flex items-center gap-1">
                            <span>{language === "en" ? "Resolved" : "Selesai"}</span>
                            <svg
                              aria-hidden="true"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="shrink-0"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Outcome Selection Modal */}
      {resolvingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {translate(language, "selectOutcomeTitle")}
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                <span className="font-semibold text-stone-800">
                  {resolvingTask.resident_name}
                </span>{" "}
                · {resolvingTask.street_name || "Street"}
              </p>
              <p className="text-xs text-stone-500 mt-2">
                {translate(language, "selectOutcomeDesc")}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {TASK_OUTCOMES.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                    selectedOutcome === item.id
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs"
                      : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="task-outcome"
                    value={item.id}
                    checked={selectedOutcome === item.id}
                    onChange={() => setSelectedOutcome(item.id)}
                    className="accent-emerald-600 h-4 w-4"
                  />
                  <span>{translateTaskOutcome(item.id, language)}</span>
                </label>
              ))}

              {selectedOutcome === "other" && (
                <div className="pt-1.5">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {translate(language, "specifyOtherOutcome")}
                  </label>
                  <input
                    type="text"
                    value={otherOutcomeText}
                    onChange={(e) => setOtherOutcomeText(e.target.value)}
                    maxLength={120}
                    placeholder={translate(language, "otherOutcomePlaceholder")}
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 bg-white"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-stone-200/80">
              <button
                type="button"
                onClick={() => setResolvingTask(null)}
                disabled={busyTaskId !== null}
                className="flex-1 min-h-11 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300"
              >
                {translate(language, "cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const tid = resolvingTask.id;
                  const outcome = selectedOutcome;
                  const note = outcome === "other" ? otherOutcomeText.trim() || null : null;
                  setResolvingTask(null);
                  act(tid, "resolve", outcome, note);
                }}
                disabled={busyTaskId !== null}
                className="flex-1 min-h-11 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>{translate(language, "confirmResolveBtn")}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
