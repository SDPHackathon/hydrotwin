import type { Drain, DrainStatus, GuardTask } from "@/lib/engine/types";
import { assess } from "@/lib/engine/risk";
import { DEMO_RESIDENTS } from "@/lib/residents-data";
import { getServerSupabase } from "@/lib/supabase";
import drainsData from "@/public/data/bukit-raja/drains.json";

interface ServerStore {
  minute: number;
  running: boolean;
  speed: number;
  histories: Record<string, number[]>;
  statuses: Record<string, DrainStatus>;
  guardTasks: GuardTask[];
  checkIns: Array<{ id: string | number; resident_id: string; state: "safe" | "need_help"; created_at: string }>;
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
      (t) => t.resident_id === res.id && t.state === "open",
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

export function recordCheckIn(residentId: string, state: "safe" | "need_help") {
  const resident = DEMO_RESIDENTS.find((r) => r.id === residentId);
  const checkIn = {
    id: `chk-${Date.now()}`,
    resident_id: residentId,
    state,
    created_at: new Date().toISOString(),
  };
  store.checkIns.unshift(checkIn);

  // If need_help, open or escalate guard task
  if (state === "need_help" && resident) {
    const existingTask = store.guardTasks.find(
      (t) => t.resident_id === residentId && t.state === "open",
    );
    if (existingTask) {
      existingTask.check_in_state = "need_help";
    } else {
      store.guardTasks.unshift({
        id: `task-urgent-${Date.now()}`,
        resident_id: residentId,
        resident_name: resident.display_name,
        needs: resident.needs || "Resident urgently requested assistance",
        street_id: resident.street_id,
        street_name: resident.street_name,
        drain_id: resident.drain_id,
        state: "open",
        check_in_state: "need_help",
        created_at: new Date().toISOString(),
      });
    }
  } else if (state === "safe") {
    const existingTask = store.guardTasks.find(
      (t) => t.resident_id === residentId && t.state === "open",
    );
    if (existingTask) {
      existingTask.check_in_state = "safe";
    }
  }

  // Push to Supabase asynchronously
  try {
    const sb = getServerSupabase();
    sb.from("check_ins").insert([{
      resident_id: residentId,
      state,
    }]).then();
  } catch {
    // Non-blocking
  }

  return { ok: true, checkIn };
}

export function closeGuardTask(taskId: string | number) {
  const task = store.guardTasks.find((t) => t.id === taskId);
  if (task) {
    task.state = "done";
  }

  try {
    const sb = getServerSupabase();
    sb.from("guard_tasks").update({ state: "done", done_at: new Date().toISOString() }).eq("id", taskId).then();
  } catch {
    // Non-blocking
  }

  return { ok: true, task };
}
