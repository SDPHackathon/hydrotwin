"use client";

// Resident phone page: your street's status, then the call-for-help loop — ask for help with what
// for, and follow the task live (sent → guard on the way → resolved). Rules: lib/engine/help.ts.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEMO_RESIDENTS } from "@/lib/residents-data";
import { HELP_TYPES, MAX_NOTE_CHARS, MAX_PEOPLE } from "@/lib/engine/help";
import type { DemoResident, DrainStatus, GuardTask, HelpType, Status, TaskState } from "@/lib/engine/types";

const POLL_MS = 1500;

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
const elapsed = (fromIso: string, now: number) => {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const helpLabel = (id: HelpType | null | undefined) => HELP_TYPES.find((t) => t.id === id)?.label ?? "Help needed";

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
  const [selectedResident, setSelectedResident] = useState<DemoResident>(DEMO_RESIDENTS[0]);
  const [statuses, setStatuses] = useState<Record<string, DrainStatus>>({});
  const [tasks, setTasks] = useState<GuardTask[]>([]); // this resident's tasks, newest first
  const [dismissedTaskId, setDismissedTaskId] = useState<string | number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [helpType, setHelpType] = useState<HelpType>("trapped");
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const previous = useRef<{ status: Status | null; taskState: TaskState | null }>({ status: null, taskState: null });

  // Poll the street status and this resident's tasks from the laptop running the server.
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const [statusRes, taskRes] = await Promise.all([
          fetch("/api/risk-engine"),
          fetch(`/api/guard-tasks?resident_id=${encodeURIComponent(selectedResident.id)}`),
        ]);
        if (!mounted) return;
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (mounted && data.statuses) setStatuses(data.statuses);
        }
        if (taskRes.ok) {
          const data = await taskRes.json();
          if (mounted && data.guardTasks) setTasks(data.guardTasks);
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

  // One-second clock for the elapsed timers (kept out of render on purpose).
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

  const latest = tasks[0] ?? null;
  const task = latest && latest.id !== dismissedTaskId ? latest : null;
  const liveTask = task && task.state !== "done" ? task : null;
  const taskState = task?.state ?? null;

  // Buzz when the street gets worse or the task moves on — not on first load.
  useEffect(() => {
    const prev = previous.current;
    if (prev.status !== null && prev.status !== drainStatus.status && drainStatus.status !== "green") vibrate([300, 150, 300]);
    if (prev.taskState !== null && taskState !== null && prev.taskState !== taskState) {
      vibrate(taskState === "done" ? [100, 80, 100] : [200, 100, 200, 100, 200]);
    }
    previous.current = { status: drainStatus.status, taskState };
  }, [drainStatus.status, taskState]);

  const pickResident = (id: string) => {
    const resident = DEMO_RESIDENTS.find((r) => r.id === id);
    if (!resident) return;
    setSelectedResident(resident);
    setTasks([]);
    setDismissedTaskId(null);
    setSheetOpen(false);
    setMessage(null);
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

  const sendHelp = async () => {
    setSubmitting(true);
    setMessage(null);
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
        setMessage(data.error ?? "Could not send. Try again, or call security directly.");
        return;
      }
      if (data.task) setTasks((prev) => [data.task, ...prev.filter((t) => t.id !== data.task.id)]);
      setDismissedTaskId(null);
      setSheetOpen(false);
      vibrate(80);
    } catch {
      setMessage("No connection to the HydroTwin server. Call security directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendSafe = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/resident/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resident_id: selectedResident.id, state: "safe" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      if (data.task) setTasks((prev) => [data.task, ...prev.filter((t) => t.id !== data.task.id)]);
      setMessage("Marked SAFE — the guards can see it.");
      vibrate(80);
    } catch {
      setMessage("Could not reach the HydroTwin server. Call security directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-full text-xs font-semibold border transition ${
      active ? "bg-rose-600 text-white border-rose-700" : "bg-white text-stone-700 border-stone-300 hover:border-stone-400"
    }`;

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
            onChange={(e) => pickResident(e.target.value)}
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
            isRed ? "bg-rose-50/70 border-rose-300" : isAmber ? "bg-amber-50/70 border-amber-300" : "bg-emerald-50/70 border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">Your Street Condition</span>
            <span
              className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                isRed ? "bg-rose-600 text-white" : isAmber ? "bg-amber-500 text-white animate-pulse" : "bg-emerald-600 text-white"
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

          <div className="mt-3 pt-3 border-t border-stone-200/60">
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">Recommended Action:</span>
            <p className="text-xs text-stone-800 font-medium mt-0.5">
              {isRed
                ? "Do NOT walk or drive through standing water. Move to an upper floor if the ground floor is inundated. Tap 'I Need Help' if stranded."
                : isAmber
                ? "MOVE YOUR VEHICLE to the elevated multi-storey car park or commercial area now. Secure ground-floor valuables."
                : "No immediate precautions required. Keep drainage grates clear of leaves."}
            </p>
          </div>
        </section>

        {/* Help tracker — the task is the source of truth, so a reload keeps it */}
        {task && (
          <section className={`rounded-xl border p-4 shadow-xs ${task.state === "done" ? "bg-emerald-50/60 border-emerald-300" : "bg-white border-rose-300 ring-2 ring-rose-200"}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-900">
                {task.check_in_state === "need_help" ? "Your help request" : "Guards are checking on you"}
              </h2>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${TASK_BADGE[task.state].className}`}>
                {TASK_BADGE[task.state].label}
              </span>
            </div>

            <ol className="space-y-2.5 text-xs">
              <li className="flex gap-2.5">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">✓</span>
                <div>
                  <div className="font-semibold text-stone-800">
                    {task.check_in_state === "need_help" ? "Request sent" : "Your street flooded"} · {timeOf(task.created_at)}
                  </div>
                  <div className="text-stone-600">
                    {task.check_in_state === "need_help"
                      ? `${helpLabel(task.help_type)} · ${task.people ?? 1} ${(task.people ?? 1) === 1 ? "person" : "people"}${task.note ? ` · “${task.note}”` : ""}`
                      : "Guards were told to check on you because of your profile."}
                  </div>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full text-white text-[10px] flex items-center justify-center ${task.accepted_at ? "bg-emerald-600" : "bg-stone-300 animate-pulse"}`}>
                  {task.accepted_at ? "✓" : ""}
                </span>
                <div>
                  <div className="font-semibold text-stone-800">
                    {task.accepted_at ? `Guard ${task.responder_name ?? ""} is on the way` : "Waiting for a guard"}
                  </div>
                  <div className="text-stone-600">
                    {task.accepted_at
                      ? `Left the post ${now ? elapsed(task.accepted_at, now) : "—"} ago · ${timeOf(task.accepted_at)}`
                      : `Sent ${now ? elapsed(task.created_at, now) : "—"} ago · guards on duty see it now`}
                  </div>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full text-white text-[10px] flex items-center justify-center ${task.done_at ? "bg-emerald-600" : "bg-stone-300"}`}>
                  {task.done_at ? "✓" : ""}
                </span>
                <div>
                  <div className="font-semibold text-stone-800">{task.done_at ? "Resolved" : "Resolved"}</div>
                  <div className="text-stone-600">
                    {task.done_at ? `${timeOf(task.done_at)} by Guard ${task.responder_name ?? ""}` : "—"}
                  </div>
                </div>
              </li>
            </ol>

            {task.check_in_state === "safe" && task.state !== "done" && (
              <p className="mt-3 text-xs text-emerald-700 font-medium">You told the guards you are safe. They will still close the task.</p>
            )}

            <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center gap-2">
              {liveTask ? (
                <>
                  <button onClick={openSheet} disabled={submitting} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300">
                    {liveTask.check_in_state === "need_help" ? "Update request" : "I need help"}
                  </button>
                  <button onClick={sendSafe} disabled={submitting || liveTask.check_in_state === "safe"} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 disabled:opacity-50">
                    I&apos;m safe now
                  </button>
                </>
              ) : (
                <button onClick={() => setDismissedTaskId(task.id)} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800">
                  OK
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              Guards see your registered street ({selectedResident.street_name}), not your live position.
            </p>
          </section>
        )}

        {/* Safety check-in: the two buttons, or the help sheet */}
        {(!liveTask || sheetOpen) && (
          <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
            {!sheetOpen ? (
              <>
                <h2 className="text-sm font-semibold text-stone-900 mb-1">Safety Status Check-In</h2>
                <p className="text-xs text-stone-500 mb-3">Tell the township guards how you are. A help request opens a task they must answer.</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={sendSafe}
                    disabled={submitting}
                    className="py-3 px-3 rounded-lg font-semibold text-xs flex flex-col items-center justify-center gap-1 border transition bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                  >
                    <span className="text-base">✅</span>
                    <span>I&apos;m Safe</span>
                  </button>
                  <button
                    onClick={openSheet}
                    disabled={submitting}
                    className="py-3 px-3 rounded-lg font-semibold text-xs flex flex-col items-center justify-center gap-1 border transition bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300"
                  >
                    <span className="text-base">🆘</span>
                    <span>I Need Help</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-stone-900 mb-1">{liveTask ? "Update your request" : "What do you need?"}</h2>
                <p className="text-xs text-stone-500 mb-3">Guards see this on their duty desk straight away.</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Type of help">
                  {HELP_TYPES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={helpType === t.id} onClick={() => setHelpType(t.id)} className={chip(helpType === t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700">People needing help</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Fewer people" onClick={() => setPeople((p) => Math.max(1, p - 1))} className="h-8 w-8 rounded-full border border-stone-300 text-lg leading-none">−</button>
                    <span className="w-6 text-center font-mono font-bold">{people}</span>
                    <button type="button" aria-label="More people" onClick={() => setPeople((p) => Math.min(MAX_PEOPLE, p + 1))} className="h-8 w-8 rounded-full border border-stone-300 text-lg leading-none">+</button>
                  </div>
                </div>
                <label className="block mt-3">
                  <span className="text-xs font-semibold text-stone-700">Anything the guard should know <span className="font-normal text-stone-400">(optional)</span></span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_CHARS))}
                    maxLength={MAX_NOTE_CHARS}
                    placeholder="e.g. back gate is open, water at knee height"
                    className="mt-1 w-full text-sm bg-stone-50 border border-stone-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <span className="block text-right text-[10px] text-stone-400">{note.length}/{MAX_NOTE_CHARS}</span>
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setSheetOpen(false)} disabled={submitting} className="py-2.5 rounded-lg text-xs font-semibold border border-stone-300 text-stone-700">
                    Cancel
                  </button>
                  <button type="button" onClick={sendHelp} disabled={submitting} className="col-span-2 py-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-60">
                    {submitting ? "Sending…" : liveTask ? "Update request" : "🆘 Send help request"}
                  </button>
                </div>
              </>
            )}
            {message && (
              <div className="mt-3 p-2.5 rounded-lg bg-stone-100 text-stone-800 text-xs border border-stone-200">{message}</div>
            )}
          </section>
        )}
        {message && liveTask && !sheetOpen && (
          <div className="p-2.5 rounded-lg bg-stone-100 text-stone-800 text-xs border border-stone-200">{message}</div>
        )}

        {/* Evacuation Route link */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-stone-900">Evacuation Safe Routes</h3>
            <p className="text-[11px] text-stone-500">Navigate to Bukit Raja High Ground avoiding flooded roads</p>
          </div>
          <Link href="/?tab=route" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition">
            View Route
          </Link>
        </section>
      </main>
    </div>
  );
}
