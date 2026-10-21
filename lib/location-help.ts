import "server-only";
import { randomUUID } from "node:crypto";
import { applyTaskAction, parseHelpName, type HelpRequest, type TaskAction } from "@/lib/engine/help";
import type { GuardTask, TaskOutcome } from "@/lib/engine/types";
import type { RoadPoint } from "@/lib/engine/route";
import { readSharedTownship } from "@/lib/shared-townships";
interface LocationSession { token: string; task: GuardTask; touched: number }
const globalHelp = globalThis as unknown as { __HYDROTWIN_LOCATION_HELP__?: Map<string, LocationSession> };
const sessions = globalHelp.__HYDROTWIN_LOCATION_HELP__ ??= new Map();
function prune() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [token, session] of sessions) if (session.touched < cutoff) sessions.delete(token);
}
export function locationTasks() { prune(); return [...sessions.values()].map((s) => structuredClone(s.task)); }
export function readLocationHelp(token: string) { prune(); return sessions.get(token)?.task ?? null; }
export async function requestLocationHelp(area: string, origin: RoadPoint, request: HelpRequest, nameInput: unknown, token?: string) {
  const name = parseHelpName(nameInput);
  prune();
  const bundle = await readSharedTownship(area);
  const street = bundle?.streets.features.find((s) => s.properties.id === origin?.street_id), p = origin?.position;
  if (!street || !p || !Number.isInteger(p.segment_index) || p.segment_index < 0 || p.segment_index + 1 >= street.geometry.coordinates.length || !Number.isFinite(p.fraction) || p.fraction < 0 || p.fraction > 1) throw new Error("Select a valid mapped location before asking for help");
  const existing = token ? sessions.get(token) : null;
  if (existing && !["done", "cancelled"].includes(existing.task.state)) {
    if (existing.task.area_slug !== area || existing.task.street_id !== origin.street_id || JSON.stringify(existing.task.position) !== JSON.stringify(p)) throw new Error("Cancel or finish your existing help request before moving its location");
    Object.assign(existing.task, request, { resident_name: name, check_in_state: "need_help" }); existing.touched = Date.now();
    return { token: existing.token, task: existing.task };
  }
  if (sessions.size >= 300) throw new Error("The demo desk has reached its session limit");
  const sessionToken = randomUUID();
  const task: GuardTask = { id: `location-${randomUUID()}`, resident_id: randomUUID(), resident_name: name, needs: null,
    area_slug: area, area_name: bundle!.area.name, position: { ...p }, street_id: street.properties.id, street_name: street.properties.name || street.properties.id,
    drain_id: street.properties.drain_id, state: "open", created_at: new Date().toISOString(), check_in_state: "need_help", ...request };
  sessions.set(sessionToken, { token: sessionToken, task, touched: Date.now() });
  return { token: sessionToken, task };
}
export function transitionLocationTask(id: string | number, action: TaskAction, responder: string | null, outcome: TaskOutcome | null, note: string | null) {
  prune();
  const session = [...sessions.values()].find((s) => String(s.task.id) === String(id));
  if (!session) return { ok: false as const, error: "unknown task" };
  const result = applyTaskAction(session.task, action, responder, new Date().toISOString(), outcome, note);
  if (result.ok) { session.task = result.task; session.touched = Date.now(); }
  return result;
}
export function updateLocationHelp(token: string, action: "safe" | "cancel") {
  prune();
  const session = sessions.get(token);
  if (!session) return { ok: false as const, error: "This demo help session is no longer available" };
  if (action === "cancel") return transitionLocationTask(session.task.id, "cancel", null, null, null);
  session.task.check_in_state = "safe"; session.touched = Date.now();
  return { ok: true as const, task: session.task };
}
