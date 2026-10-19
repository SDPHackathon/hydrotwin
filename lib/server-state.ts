import type { Drain, DrainStatus, GuardTask, HelpType } from "@/lib/engine/types";
import { assess } from "@/lib/engine/risk";
import { applyTaskAction, type HelpRequest, type TaskAction } from "@/lib/engine/help";
import { DEMO_RESIDENTS } from "@/lib/residents-data";
import { getServerSupabase } from "@/lib/supabase";
import drainsData from "@/public/data/bukit-raja/drains.json";

interface ServerStore {
  stormUpdatedAt: number | null;
  minute: number;
  running: boolean;
  speed: number;
  histories: Record<string, number[]>;
  statuses: Record<string, DrainStatus>;
  guardTasks: GuardTask[];
  checkIns: Array<{
    id: string | number; resident_id: string; state: "safe" | "need_help"; created_at: string;
    help_type: HelpType | null; people: number | null; note: string | null;
  }>;
}

const drains: Drain[] = drainsData as Drain[];

function initStore(): ServerStore {
  const histories: Record<string, number[]> = {};
  const statuses: Record<string, DrainStatus> = {};

  for (const d of drains) {
    histories[d.id] = [0];
    statuses[d.id] = assess(d, [0]);
  }

  return {
    stormUpdatedAt: null,
    minute: 0,
    running: false,
    speed: 1,
    histories,
    statuses,
    guardTasks: [],
    checkIns: [],
  };
}

// Global server singleton in Next.js Node runtime
const globalStore = globalThis as unknown as { __HYDROTWIN_STORE__?: ServerStore };
if (!globalStore.__HYDROTWIN_STORE__) {
  globalStore.__HYDROTWIN_STORE__ = initStore();
}
const store = globalStore.__HYDROTWIN_STORE__;

export function getDrains(): Drain[] {
  return drains;
}

export function getState() {
  return {
    stormAgeMs: store.stormUpdatedAt == null ? null : Math.max(0, Date.now() - store.stormUpdatedAt),
    minute: store.minute,
    running: store.running,
    speed: store.speed,
    statuses: store.statuses,
    guardTasks: store.guardTasks,
    checkIns: store.checkIns,
  };
}

export function resetState() {
  const fresh = initStore();
  store.minute = 0;
  store.running = false;
  store.speed = 1;
  store.stormUpdatedAt = Date.now();
  store.histories = fresh.histories;
  store.statuses = fresh.statuses;
  store.guardTasks = [];
  store.checkIns = [];

  // Reset in Supabase asynchronously
  try {
    const sb = getServerSupabase();
    sb.from("drain_status").update({ level_cm: 0, status: "green", rate_cm_per_min: 0, street_depth_cm: 0, minutes_to_red: null }).neq("drain_id", "").then();
  } catch {
    // Non-blocking
  }

  return getState();
}

export async function processReadings(readings: Array<{
  drain_id: string;
  level_cm: number;
  rain_mm?: number;
  sim_minute?: number;
  source?: "sim" | "device";
}>, minute?: number, running?: boolean, speed?: number) {
  if (minute !== undefined || running !== undefined || speed !== undefined) store.stormUpdatedAt = Date.now();
  if (minute !== undefined) store.minute = minute;
  if (running !== undefined) store.running = running;
  if (speed !== undefined) store.speed = speed;

  const previousStatuses = { ...store.statuses };
  const updatedStatuses: Record<string, DrainStatus> = { ...store.statuses };
  const drainsMap = new Map(drains.map((d) => [d.id, d]));

  for (const r of readings) {
    const drain = drainsMap.get(r.drain_id);
    if (!drain) continue;

    if (!store.histories[r.drain_id]) store.histories[r.drain_id] = [0];
    const history = store.histories[r.drain_id];
    history.push(r.level_cm);
    if (history.length > 30) history.shift();

    const newStatus = assess(drain, history);
    updatedStatuses[r.drain_id] = newStatus;
    store.statuses[r.drain_id] = newStatus;

    // Trigger Guard Task when a drain transitions to RED (level_cm >= bank_cm)
    const prevStatus = previousStatuses[r.drain_id]?.status ?? "green";
    if (newStatus.status === "red" && prevStatus !== "red") {
      openGuardTasksForDrain(r.drain_id);
    }
  }

  // Push updates to Supabase
  try {
    const sb = getServerSupabase();
    const rows = Object.values(updatedStatuses).map((s) => ({
      drain_id: s.drain_id,
      level_cm: s.level_cm,
      status: s.status,
      rate_cm_per_min: s.rate_cm_per_min,
      minutes_to_red: s.minutes_to_red,
      street_depth_cm: s.street_depth_cm,
      updated_at: new Date().toISOString(),
    }));

    sb.from("drain_status").upsert(rows).then();
  } catch (err) {
    console.error("Supabase sync non-blocking error:", err);
  }

  return getState();
}

function openGuardTasksForDrain(drainId: string) {
  // Find all vulnerable residents in this drain's zone
  const vulnerableResidents = DEMO_RESIDENTS.filter(
    (r) => r.drain_id === drainId && r.vulnerable,
  );

  for (const res of vulnerableResidents) {
    const existing = store.guardTasks.find(
      (t) => t.resident_id === res.id && t.state !== "done",
    );
    if (!existing) {
      const task: GuardTask = {
        id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        resident_id: res.id,
        resident_name: res.display_name,
        needs: res.needs,
        street_id: res.street_id,
        street_name: res.street_name,
        drain_id: drainId,
        state: "open",
        created_at: new Date().toISOString(),
      };
      store.guardTasks.unshift(task);

      // Async write to Supabase
      try {
        const sb = getServerSupabase();
        sb.from("guard_tasks").insert([{
          resident_id: res.id,
          drain_id: drainId,
          state: "open",
        }]).then();
      } catch {
        // Ignored
      }
    }
  }
}

// Best-effort copy to Supabase — the laptop's store is the demo's source of truth. Failures are logged, never thrown.
function mirror(write: (sb: ReturnType<typeof getServerSupabase>) => PromiseLike<{ error: unknown }>, what: string) {
  try {
    void write(getServerSupabase()).then(({ error }) => {
      if (error) console.error(`Supabase mirror failed (${what}):`, error);
    });
  } catch (err) {
    console.error(`Supabase mirror failed (${what}):`, err);
  }
}

const liveTaskOf = (residentId: string) =>
  store.guardTasks.find((t) => t.resident_id === residentId && t.state !== "done");

/** "safe" or "need_help" (+ what for). A call while a task is live updates the ask; the guard keeps their place. */
export function recordCheckIn(residentId: string, state: "safe" | "need_help", request: HelpRequest | null = null) {
  const resident = DEMO_RESIDENTS.find((r) => r.id === residentId);
  if (!resident) return { ok: false as const, error: "unknown resident" };
  const now = new Date().toISOString();
  const help: HelpRequest | null = state === "need_help" ? (request ?? { help_type: "other", people: 1, note: null }) : null;

  store.checkIns.unshift({
    id: `chk-${Date.now()}`, resident_id: residentId, state, created_at: now,
    help_type: help?.help_type ?? null, people: help?.people ?? null, note: help?.note ?? null,
  });

  const live = liveTaskOf(residentId);
  if (help) {
    if (live) {
      Object.assign(live, { check_in_state: "need_help", ...help });
    } else {
      store.guardTasks.unshift({
        id: `task-urgent-${Date.now()}`,
        resident_id: residentId,
        resident_name: resident.display_name,
        needs: resident.needs,
        street_id: resident.street_id,
        street_name: resident.street_name,
        drain_id: resident.drain_id,
        state: "open",
        check_in_state: "need_help",
        created_at: now,
        ...help,
      });
      mirror((sb) => sb.from("guard_tasks").insert([{ resident_id: residentId, drain_id: resident.drain_id, state: "open", ...help }]), "guard_tasks insert");
    }
  } else if (live) {
    live.check_in_state = "safe";
  }

  mirror((sb) => sb.from("check_ins").insert([{ resident_id: residentId, state, ...(help ?? {}) }]), "check_ins insert");
  return { ok: true as const, task: liveTaskOf(residentId) ?? null };
}

export function acceptGuardTask(taskId: string | number, responder: string | null) {
  return transitionTask(taskId, "accept", responder);
}

export function closeGuardTask(taskId: string | number, responder: string | null = null) {
  return transitionTask(taskId, "resolve", responder);
}

function transitionTask(taskId: string | number, action: TaskAction, responder: string | null) {
  const index = store.guardTasks.findIndex((t) => String(t.id) === String(taskId));
  if (index < 0) return { ok: false as const, error: "unknown task" };
  const result = applyTaskAction(store.guardTasks[index], action, responder, new Date().toISOString());
  if (!result.ok) return result;
  const task = result.task;
  store.guardTasks[index] = task;
  // Cloud ids differ from the laptop's; the live task is unique per resident (index guard_tasks_one_open).
  mirror((sb) => sb.from("guard_tasks")
    .update({ state: task.state, accepted_at: task.accepted_at ?? null, responder_name: task.responder_name ?? null, done_at: task.done_at ?? null })
    .eq("resident_id", task.resident_id).in("state", ["open", "on_the_way"]), "guard_tasks update");
  return { ok: true as const, task };
}
