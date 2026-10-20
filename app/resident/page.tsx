"use client";

// Resident phone page: your street's status, then the call-for-help loop — ask for help with what
// for, and follow the task live (sent → guard on the way → resolved). Rules: lib/engine/help.ts.

import {
  translate,
  translateResidentNeeds,
  translateHelpType,
} from "@/lib/translations";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PhoneHeader from "@/components/PhoneHeader";
import { useLanguage } from "@/lib/language";
import { DEMO_RESIDENTS } from "@/lib/residents-data";
import { useStoredValue } from "@/lib/useStoredValue";
import { HELP_TYPES, MAX_NOTE_CHARS, MAX_PEOPLE } from "@/lib/engine/help";
import type {
  DemoResident,
  Drain,
  DrainStatus,
  GuardTask,
  HelpType,
  Status,
  TaskState,
} from "@/lib/engine/types";
import drainsData from "@/public/data/bukit-raja/drains.json";

const POLL_MS = 1500;
const BANK_CM: Record<string, number> = Object.fromEntries(
  (drainsData as Drain[]).map((d) => [d.id, d.bank_cm]),
);
// Clears the sticky header (and the notch when installed full-screen) when scrolling a section into view.
const SCROLL_MARGIN = "scroll-mt-[calc(5.5rem+env(safe-area-inset-top))]";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
  });
const duration = (fromIso: string, to: number) => {
  const s = Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const helpLabel = (id: HelpType | null | undefined, language: "en" | "bm") =>
  translateHelpType(id, language);
const peopleLabel = (n: number | null | undefined, language: "en" | "bm") =>
  `${n ?? 1} ${
    language === "bm"
      ? (n ?? 1) === 1
        ? "orang"
        : "orang"
      : (n ?? 1) === 1
        ? "person"
        : "people"
  }`;

// Android only — iOS ignores navigator.vibrate. Never let it throw.
function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

const TASK_BADGE: Record<TaskState, { label: string; className: string }> = {
  open: { label: "Sent", className: "bg-amber-500 text-white animate-pulse" },
  on_the_way: { label: "On the way", className: "bg-blue-600 text-white" },
  done: { label: "Resolved", className: "bg-emerald-600 text-white" },
};

export default function ResidentPage() {
  const { language, toggleLanguage } = useLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [selectedResident, setSelectedResident] = useState<DemoResident>(
    DEMO_RESIDENTS[0],
  );
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>({});
  const [tasks, setTasks] = useState<GuardTask[]>([]); // this resident's tasks, newest first
  const [dismissedId, setDismissedId] = useStoredValue(
    `hydrotwin_dismissed_${selectedResident.id}`,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [helpType, setHelpType] = useState<HelpType>("trapped");
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const previous = useRef<{
    status: Status | null;
    taskState: TaskState | null;
  }>({ status: null, taskState: null });
  const mutation = useRef(0); // bumped by every successful send, so a poll that started before it can't undo it
  const sheetRef = useRef<HTMLElement>(null);

  // Poll the street status and this resident's tasks from the laptop running the server.
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const seq = mutation.current;
      try {
        const [statusRes, taskRes] = await Promise.all([
          fetch("/api/risk-engine"),
          fetch(
            `/api/guard-tasks?resident_id=${encodeURIComponent(selectedResident.id)}`,
          ),
        ]);
        if (!mounted) return;
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (mounted && data.statuses) setStatuses(data.statuses);
        }
        if (taskRes.ok) {
          const data = await taskRes.json();
          if (mounted && data.guardTasks && seq === mutation.current)
            setTasks(data.guardTasks);
        }
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
  }, [selectedResident.id]);

  // One-second clock for the running timers (kept out of render on purpose).
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const drainStatus = statuses[selectedResident.drain_id] ?? {
    drain_id: selectedResident.drain_id,
    level_cm: 0,
    status: "green" as Status,
    rate_cm_per_min: 0,
    minutes_to_red: null,
    street_depth_cm: 0,
  };
  const isRed = drainStatus.status === "red";
  const isAmber = drainStatus.status === "amber";
  // The engine sets minutes_to_red only while the drain is below its bank and rising.
  const rising = drainStatus.minutes_to_red !== null;
  const fullPct = Math.round(
    (drainStatus.level_cm / (BANK_CM[selectedResident.drain_id] ?? 120)) * 100,
  );

  const latest = tasks[0] ?? null;
  const task = latest && String(latest.id) !== dismissedId ? latest : null;
  const liveTask = task && task.state !== "done" ? task : null;
  const taskState = task?.state ?? null;

  // Buzz when the street gets worse or the task moves on — not on first load.
  useEffect(() => {
    const prev = previous.current;
    if (
      prev.status !== null &&
      prev.status !== drainStatus.status &&
      drainStatus.status !== "green"
    )
      vibrate([300, 150, 300]);
    if (
      prev.taskState !== null &&
      taskState !== null &&
      prev.taskState !== taskState
    ) {
      vibrate(
        taskState === "done" ? [100, 80, 100] : [200, 100, 200, 100, 200],
      );
    }
    previous.current = { status: drainStatus.status, taskState };
  }, [drainStatus.status, taskState]);

  // "Update request" opens the sheet below the tracker — bring it into view.
  const sheetBelowTracker = sheetOpen && Boolean(liveTask);
  useEffect(() => {
    if (sheetBelowTracker)
      sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sheetBelowTracker]);

  const resetForm = () => {
    setHelpType("trapped");
    setPeople(1);
    setNote("");
  };

  const pickResident = (id: string) => {
    const resident = DEMO_RESIDENTS.find((r) => r.id === id);
    if (!resident) return;
    mutation.current++;
    setSelectedResident(resident);
    setTasks([]);
    setSheetOpen(false);
    setMessage(null);
    resetForm();
    previous.current = { status: null, taskState: null };
  };

  const openSheet = () => {
    if (liveTask?.check_in_state === "need_help") {
      setHelpType(liveTask.help_type ?? "other");
      setPeople(liveTask.people ?? 1);
      setNote(liveTask.note ?? "");
    }
    setMessage(null);
    setSheetOpen(true);
  };

  const applyTask = (next: GuardTask | null | undefined) => {
    mutation.current++;
    if (next)
      setTasks((prev) => [next, ...prev.filter((t) => t.id !== next.id)]);
  };

  const sendHelp = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    const wasNew = !liveTask;
    try {
      const res = await fetch("/api/resident/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resident_id: selectedResident.id,
          state: "need_help",
          help_type: helpType,
          people,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? t("couldNotSendHelp"));
        return;
      }
      applyTask(data.task);
      setSheetOpen(false);
      if (wasNew) resetForm();
      vibrate(80);
    } catch {
      setMessage(t("noServerConnection"));
    } finally {
      setSubmitting(false);
    }
  };

  const sendSafe = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/resident/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resident_id: selectedResident.id,
          state: "safe",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      applyTask(data.task);
      setMessage(data.task ? t("markedSafeWithTask") : t("markedSafeNoTask"));
      vibrate(80);
    } catch {
      setMessage(t("couldNotReachServer"));
    } finally {
      setSubmitting(false);
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-2.5 rounded-full text-xs font-semibold border transition ${
      active
        ? "bg-rose-600 text-white border-rose-700"
        : "bg-white text-stone-700 border-stone-300 hover:border-stone-400"
    }`;

  // Second step of the tracker: who is coming, and for how long.
  const guardStep = (() => {
    if (!task) return null;

    if (!task.accepted_at) {
      return task.done_at
        ? { heading: t("resolvedByDesk"), detail: null }
        : {
            heading: t("waitingForGuard"),
            detail: `${language === "bm" ? "Menunggu" : "Waiting"} ${now ? duration(task.created_at, now) : "0:00"} · ${t("guardsSeeNow")}`,
          };
    }

    const guard =
      `${language === "bm" ? "Pengawal" : "Guard"} ${task.responder_name ?? ""}`.trim();

    if (task.done_at) {
      return {
        heading: `${guard} ${t("responded")}`,
        detail: `${t("leftPost")} ${timeOf(task.accepted_at)} · ${t("doneIn")} ${duration(task.accepted_at, new Date(task.done_at).getTime())}`,
      };
    }

    return {
      heading: `${guard} ${t("onTheWay")}`,
      detail: `${t("leftPost")} ${timeOf(task.accepted_at)} · ${now ? duration(task.accepted_at, now) : "0:00"}`,
    };
  })();
  return (
    <div className="min-h-screen touch-manipulation bg-stone-100 text-stone-900 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <PhoneHeader
        title={t("residentTitle")}
        badge="Bukit Raja"
        badgeClassName="bg-blue-100 text-blue-800"
        subtitle={t("residentSubtitle")}
        links={[
          { href: "/", label: t("map") },
          { href: "/control", label: t("control") },
          { href: "/guard", label: t("guard") },
        ]}
        language={language}
        onToggleLanguage={toggleLanguage}
      />
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Resident Persona Picker */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <label
            htmlFor="resident-select"
            className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5"
          >
            {t("selectResident")}
          </label>
          <select
            id="resident-select"
            value={selectedResident.id}
            onChange={(e) => pickResident(e.target.value)}
            className="w-full text-base font-medium bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {DEMO_RESIDENTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.vulnerable ? "⚠️ " : ""}
                {r.display_name} — {r.street_name}
              </option>
            ))}
          </select>

          <div className="mt-3 text-xs bg-stone-50 rounded-lg p-2.5 border border-stone-200/80 space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">
                {t("registeredStreetLabel")}
              </span>
              <span className="font-medium text-stone-800 text-right">
                {selectedResident.street_name}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">{t("drainLabel")}</span>
              <span className="font-mono font-medium text-stone-800">
                {selectedResident.drain_id}
              </span>
            </div>
            {selectedResident.vulnerable && (
              <div className="pt-1 border-t border-stone-200 flex items-start gap-2">
                <span className="shrink-0 whitespace-nowrap text-rose-700 font-medium">
                  ⚠️ {t("vulnerableLabel")}
                </span>

                <span className="min-w-0 text-stone-700">
                  {translateResidentNeeds(selectedResident.needs, language)}
                </span>
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
              {t("streetCondition")}
            </span>
            <span
              className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                isRed
                  ? "bg-rose-600 text-white"
                  : isAmber
                    ? `bg-amber-500 text-white ${rising ? "animate-pulse" : ""}`
                    : "bg-emerald-600 text-white"
              }`}
            >
              {isRed
                ? language === "bm"
                  ? "BAHAYA"
                  : "RED"
                : isAmber
                  ? language === "bm"
                    ? "AMARAN"
                    : "AMBER"
                  : language === "bm"
                    ? "SELAMAT"
                    : "GREEN"}
            </span>
          </div>

          <div className="my-2">
            {isRed ? (
              <div>
                <div className="text-2xl font-black text-rose-700">
                  {drainStatus.street_depth_cm.toFixed(1)} cm
                  <span className="text-xs font-medium text-rose-800 ml-1.5">
                    {t("streetWater")}
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium mt-1">
                  🚨{" "}
                  {language === "bm"
                    ? `Longkang ${selectedResident.drain_id} telah melimpah ke jalan.`
                    : `Drain ${selectedResident.drain_id} has overflowed onto the street.`}
                </p>
              </div>
            ) : isAmber && rising ? (
              <div>
                <div className="text-2xl font-black text-amber-800">
                  ~{drainStatus.minutes_to_red} min
                  <span className="text-xs font-medium text-amber-700 ml-1.5">
                    {t("untilStreet")}
                  </span>
                </div>
                <p className="text-xs text-amber-800 font-medium mt-1">
                  ⚠️ {t("waterRisingAlert")} {drainStatus.rate_cm_per_min}{" "}
                  cm/min · {t("drainLabel").toLowerCase()} {fullPct}%{" "}
                  {language === "bm" ? "penuh" : "full"}
                </p>
              </div>
            ) : isAmber ? (
              <div>
                <div className="text-2xl font-black text-amber-800">
                  {t("stillHigh")}
                </div>
                <p className="text-xs text-amber-800 font-medium mt-1">
                  {drainStatus.rate_cm_per_min < 0
                    ? t("waterGoingDown")
                    : t("waterSteady")}{" "}
                  · {t("drainLabel").toLowerCase()} {fullPct}%{" "}
                  {language === "bm" ? "penuh" : "full"}
                </p>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-black text-emerald-700">
                  {t("safeClear")}
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  {t("drainLevel")} {drainStatus.level_cm} cm ({fullPct}%{" "}
                  {language === "bm" ? "penuh" : "full"}). {t("drainageNormal")}
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-stone-200/60">
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">
              {t("recommendedActionLabel")}
            </span>
            <p className="text-xs text-stone-800 font-medium mt-0.5">
              {isRed
                ? t("actionRed")
                : isAmber && rising
                  ? t("actionRising")
                  : isAmber
                    ? t("actionAmber")
                    : t("actionGreen")}
            </p>
          </div>
        </section>

        {/* Help tracker — the task is the source of truth, so a reload keeps it */}
        {task && guardStep && (
          <section
            className={`rounded-xl border p-4 shadow-xs ${task.state === "done" ? "bg-emerald-50/60 border-emerald-300" : "bg-white border-rose-300 ring-2 ring-rose-200"}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-900">
                {task.check_in_state === "need_help"
                  ? t("helpRequest")
                  : t("guardsChecking")}
              </h2>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${TASK_BADGE[task.state].className}`}
              >
                {task.state === "open"
                  ? t("requestSent")
                  : task.state === "on_the_way"
                    ? t("onTheWay")
                    : t("resolved")}
              </span>
            </div>

            <ol className="space-y-2.5 text-xs">
              <li className="flex gap-2.5">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">
                  ✓
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-stone-800">
                    {task.check_in_state === "need_help"
                      ? t("requestSent")
                      : t("streetFlooded")}{" "}
                    · {timeOf(task.created_at)}
                  </div>
                  <div className="text-stone-600 wrap-break-word">
                    {task.check_in_state === "need_help" ? (
                      <>
                        {helpLabel(task.help_type, language)} ·{" "}
                        {peopleLabel(task.people, language)}
                        {task.note ? ` · “${task.note}”` : ""}
                      </>
                    ) : (
                      t("guardsTold")
                    )}
                  </div>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full text-white text-[10px] flex items-center justify-center ${task.accepted_at || task.done_at ? "bg-emerald-600" : "bg-stone-300 animate-pulse"}`}
                >
                  {task.accepted_at || task.done_at ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-stone-800">
                    {guardStep.heading}
                  </div>
                  {guardStep.detail && (
                    <div className="text-stone-600">{guardStep.detail}</div>
                  )}
                </div>
              </li>
              <li className="flex gap-2.5">
                <span
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full text-white text-[10px] flex items-center justify-center ${task.done_at ? "bg-emerald-600" : "bg-stone-300"}`}
                >
                  {task.done_at ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-stone-800">
                    {task.done_at
                      ? `${t("resolved")} · ${timeOf(task.done_at)}`
                      : t("resolved")}
                  </div>
                </div>
              </li>
            </ol>

            {task.check_in_state === "safe" && task.state !== "done" && (
              <p className="mt-3 text-xs text-emerald-700 font-medium">
                {t("residentSafe")}
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center gap-2">
              {liveTask ? (
                <>
                  <button
                    onClick={openSheet}
                    disabled={submitting}
                    className="flex-1 min-h-11 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300"
                  >
                    {liveTask.check_in_state === "need_help"
                      ? t("updateRequest")
                      : t("iNeedHelp")}
                  </button>
                  <button
                    onClick={sendSafe}
                    disabled={submitting || liveTask.check_in_state === "safe"}
                    className="flex-1 min-h-11 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 disabled:opacity-50"
                  >
                    {t("safeNow")}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDismissedId(String(task.id))}
                  className="flex-1 min-h-11 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800"
                >
                  OK
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              {t("guardsSeeStreet")} ({selectedResident.street_name}),{" "}
              {t("notLivePosition")}
            </p>
          </section>
        )}

        {/* Safety check-in: the two buttons, or the help sheet */}
        {(!liveTask || sheetOpen) && (
          <section
            ref={sheetRef}
            className={`bg-white rounded-xl border border-stone-200 p-4 shadow-xs ${SCROLL_MARGIN}`}
          >
            {!sheetOpen ? (
              <>
                <h2 className="text-sm font-semibold text-stone-900 mb-1">
                  {t("safetyStatus")}
                </h2>
                <p className="text-xs text-stone-500 mb-3">
                  {t("checkInDescription")}
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={sendSafe}
                    disabled={submitting}
                    className="py-3 px-3 rounded-lg font-semibold text-xs flex flex-col items-center justify-center gap-1 border transition bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                  >
                    <span className="text-base">✅</span>
                    <span>{t("imSafe")}</span>
                  </button>
                  <button
                    onClick={openSheet}
                    disabled={submitting}
                    className="py-3 px-3 rounded-lg font-semibold text-xs flex flex-col items-center justify-center gap-1 border transition bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300"
                  >
                    <span className="text-base">🆘</span>
                    <span>{t("iNeedHelp")}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-stone-900 mb-1">
                  {liveTask ? t("updateRequest") : t("helpNeeded")}
                </h2>
                <p className="text-xs text-stone-500 mb-3">
                  {t("guardsSeeStreet")}
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t("helpNeeded")}
                >
                  {HELP_TYPES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={helpType === item.id}
                      onClick={() => setHelpType(item.id)}
                      className={chip(helpType === item.id)}
                    >
                      {translateHelpType(item.id, language)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700">
                    {t("peopleNeedingHelp")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={
                        language === "bm"
                          ? "Kurangkan bilangan orang"
                          : "Fewer people"
                      }
                      onClick={() => setPeople((p) => Math.max(1, p - 1))}
                      className="h-10 w-10 rounded-full border border-stone-300 text-lg leading-none"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-mono font-bold select-none">
                      {people}
                    </span>
                    <button
                      type="button"
                      aria-label={
                        language === "bm"
                          ? "Tambah bilangan orang"
                          : "More people"
                      }
                      onClick={() =>
                        setPeople((p) => Math.min(MAX_PEOPLE, p + 1))
                      }
                      className="h-10 w-10 rounded-full border border-stone-300 text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
                <label className="block mt-3">
                  <span className="text-xs font-semibold text-stone-700">
                    {t("extraInformation")}{" "}
                    <span className="font-normal text-stone-500">
                      ({t("optional")})
                    </span>
                  </span>
                  <input
                    value={note}
                    onChange={(e) =>
                      setNote(e.target.value.slice(0, MAX_NOTE_CHARS))
                    }
                    maxLength={MAX_NOTE_CHARS}
                    placeholder={t("openGateExample")}
                    className="mt-1 w-full text-base bg-stone-50 border border-stone-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <span className="block text-right text-[11px] text-stone-500">
                    {note.length}/{MAX_NOTE_CHARS}
                  </span>
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    disabled={submitting}
                    className="min-h-11 rounded-lg text-xs font-semibold border border-stone-300 text-stone-700"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={sendHelp}
                    disabled={submitting}
                    className="col-span-2 min-h-11 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-60"
                  >
                    {submitting
                      ? t("sending")
                      : liveTask
                        ? t("updateRequest")
                        : `🆘 ${t("sendHelpRequest")}`}
                  </button>
                </div>
              </>
            )}
            {message && (
              <div className="mt-3 p-2.5 rounded-lg bg-stone-100 text-stone-800 text-xs border border-stone-200">
                {message}
              </div>
            )}
          </section>
        )}
        {message && liveTask && !sheetOpen && (
          <div className="p-2.5 rounded-lg bg-stone-100 text-stone-800 text-xs border border-stone-200">
            {message}
          </div>
        )}

        {/* Township map link — hidden in the installed app, which has no way back from the dashboard */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex items-center justify-between gap-3 [@media(display-mode:standalone)]:hidden">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-stone-900">
              {t("safeRoutes")}
            </h3>

            <p className="text-[11px] text-stone-500">
              {t("safeRoutesDescription")}
            </p>
          </div>

          <Link
            href="/"
            className="shrink-0 whitespace-nowrap min-h-10 inline-flex items-center text-xs font-semibold px-3 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition"
          >
            {t("openMap")}
          </Link>
        </section>
      </main>
    </div>
  );
}
