// Call-for-help loop: what a resident may ask for, how a guard task moves from open to done, and
// the guard's route to the resident. Pure TypeScript — these rules live here only (AGENTS.md rule 2).

import type { GuardTask, HelpType, Status, TaskOutcome } from "./types.ts";
import type { StreetFeature } from "./route.ts";

// ---------------------------------------------------------------------------------------------
// Help request
// ---------------------------------------------------------------------------------------------

export const HELP_TYPES: ReadonlyArray<{ id: HelpType; label: string }> = [
  { id: "trapped", label: "Trapped by rising water" },
  { id: "medical", label: "Medical emergency" },
  { id: "evacuate", label: "Need help to evacuate" },
  { id: "water_in_house", label: "Water entering the house" },
  { id: "other", label: "Something else" },
];
export const MAX_PEOPLE = 10;
export const MAX_NOTE_CHARS = 80;

export interface HelpRequest {
  help_type: HelpType;
  people: number;
  note: string | null;
}

/** Normalises what the resident page sends. Missing fields mean a plain "something else, 1 person" call. */
export function parseHelpRequest(
  input: unknown,
): { ok: true; request: HelpRequest } | { ok: false; error: string } {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const help_type = body.help_type ?? "other";
  if (!HELP_TYPES.some((t) => t.id === help_type)) return { ok: false, error: "unknown help_type" };
  const people = body.people ?? 1;
  if (typeof people !== "number" || !Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) {
    return { ok: false, error: `people must be a whole number from 1 to ${MAX_PEOPLE}` };
  }
  let note: string | null = null;
  if (body.note != null) {
    if (typeof body.note !== "string") return { ok: false, error: "note must be text" };
    const trimmed = body.note.trim();
    if (trimmed.length > MAX_NOTE_CHARS) return { ok: false, error: `note longer than ${MAX_NOTE_CHARS} characters` };
    note = trimmed || null;
  }
  return { ok: true, request: { help_type: help_type as HelpType, people, note } };
}

// ---------------------------------------------------------------------------------------------
// Task lifecycle: open → on_the_way → done | cancelled (resolve also works straight from open)
// ---------------------------------------------------------------------------------------------

export const TASK_OUTCOMES: ReadonlyArray<{ id: TaskOutcome; label: string }> = [
  { id: "assisted_upstairs", label: "Assisted upstairs" },
  { id: "evacuated", label: "Evacuated" },
  { id: "confirmed_safe", label: "Resident confirmed safe" },
  { id: "other", label: "Other" },
];

export const MAX_OUTCOME_NOTE_CHARS = 140;

export type TaskAction = "accept" | "resolve" | "cancel";

/** Returns a new task; never mutates the one passed in. */
export function applyTaskAction(
  task: GuardTask,
  action: TaskAction,
  responder: string | null,
  now: string,
  outcome: TaskOutcome | null = null,
  outcome_note: string | null = null,
): { ok: true; task: GuardTask } | { ok: false; error: string } {
  if (task.state === "done") return { ok: false, error: "task already resolved" };
  if (task.state === "cancelled") return { ok: false, error: "task already cancelled" };

  if (action === "cancel") {
    return {
      ok: true,
      task: {
        ...task,
        state: "cancelled",
        cancelled_at: now,
      },
    };
  }

  if (action === "accept") {
    if (task.state === "on_the_way") {
      return { ok: false, error: `${task.responder_name ?? "a guard"} is already on the way` };
    }
    return { ok: true, task: { ...task, state: "on_the_way", accepted_at: now, responder_name: responder } };
  }

  if (outcome !== null && !TASK_OUTCOMES.some((o) => o.id === outcome)) {
    return { ok: false, error: "unknown resolution outcome" };
  }

  let note: string | null = null;
  if (outcome_note != null) {
    if (typeof outcome_note !== "string") return { ok: false, error: "outcome note must be text" };
    const trimmed = outcome_note.trim();
    if (trimmed.length > MAX_OUTCOME_NOTE_CHARS) {
      return { ok: false, error: `outcome note longer than ${MAX_OUTCOME_NOTE_CHARS} characters` };
    }
    note = trimmed || null;
  }

  return {
    ok: true,
    task: {
      ...task,
      state: "done",
      done_at: now,
      responder_name: responder ?? task.responder_name ?? null,
      outcome: outcome ?? "other",
      outcome_note: note,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Responder route: nearest guard post → the resident's street
// ---------------------------------------------------------------------------------------------

export interface GuardPost {
  id: string;
  name: string;
  street_id: string;
}

export interface RouteLeg {
  status: Status;
  coordinates: [number, number][];
}

export type ResponderOutcome =
  | "found"
  | "invalid_resident"
  | "resident_unknown"
  | "no_posts"
  | "posts_blocked"
  | "unreachable";

export interface ResponderRoute {
  found: boolean;
  outcome: ResponderOutcome;
  post: GuardPost | null;
  coordinates: [number, number][];
  legs: RouteLeg[]; // consecutive stretches with the same status, for drawing
  origin: [number, number] | null;
  destination: [number, number] | null;
  dry_m: number; // green + amber metres
  water_m: number; // red metres
  uses_amber: boolean;
}

/** A metre through flood water costs as much as this many dry metres: water is used only where no dry road reaches the resident. */
export const WATER_PENALTY = 4;

type Coord = [number, number];
type Edge = { to: string; cost: number; metres: number; status: Status };
const key = (c: number[]) => `${c[0]},${c[1]}`;
const coord = (c: number[]): Coord => [c[0], c[1]];
const metres = (a: number[], b: number[]) =>
  Math.hypot((b[0] - a[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110574);

/**
 * Shortest route from the nearest guard post to the middle of the resident's street (the house is
 * somewhere along it). Unlike `findSafeRoute` (evacuation: red roads are never an option), a
 * responder may wade — red roads stay in the graph at WATER_PENALTY × their length. Roads with an
 * unknown status are left out. Roads connect only at shared vertices, like the evacuation router.
 */
export function findResponderRoute(
  streets: StreetFeature[],
  posts: GuardPost[],
  residentStreetId: string,
  statuses: Record<string, Status | undefined>,
): ResponderRoute {
  const byId = new Map(streets.map((s) => [s.properties.id, s]));
  const fail = (outcome: ResponderOutcome, destination: Coord | null = null): ResponderRoute => ({
    found: false, outcome, post: null, coordinates: [], legs: [], origin: null, destination,
    dry_m: 0, water_m: 0, uses_amber: false,
  });

  const resident = byId.get(residentStreetId);
  const residentCoords = resident?.geometry.coordinates ?? [];
  if (!resident || !residentCoords.length) return fail("invalid_resident");
  const target = coord(residentCoords[Math.floor(residentCoords.length / 2)]);
  if (!statuses[resident.properties.drain_id]) return fail("resident_unknown", target);
  if (!posts.length) return fail("no_posts", target);

  const graph = new Map<string, Edge[]>();
  const points = new Map<string, Coord>();
  for (const street of streets) {
    const status = statuses[street.properties.drain_id];
    if (!status) continue;
    const coords = street.geometry.coordinates;
    for (let i = 0; i + 1 < coords.length; i++) {
      const a = coord(coords[i]), b = coord(coords[i + 1]);
      const ka = key(a), kb = key(b);
      if (ka === kb) continue;
      points.set(ka, a);
      points.set(kb, b);
      const m = metres(a, b);
      const cost = status === "red" ? m * WATER_PENALTY : m;
      graph.set(ka, [...(graph.get(ka) ?? []), { to: kb, cost, metres: m, status }]);
      graph.set(kb, [...(graph.get(kb) ?? []), { to: ka, cost, metres: m, status }]);
    }
  }

  // A post on a red (or unknown) street cannot start a route; another post may.
  const openPosts = posts.filter((p) => {
    const street = byId.get(p.street_id);
    const status = street && statuses[street.properties.drain_id];
    return Boolean(street?.geometry.coordinates.length && status && status !== "red");
  });
  if (!openPosts.length) return fail("posts_blocked", target);

  const targetKey = key(target);
  let best: { post: GuardPost; start: string; cost: number; previous: Map<string, { from: string; edge: Edge }> } | null = null;
  for (const post of openPosts) {
    const start = key(byId.get(post.street_id)!.geometry.coordinates[0]);
    const result = dijkstra(graph, start, targetKey);
    if (result.cost < (best?.cost ?? Infinity)) best = { post, start, ...result };
  }
  if (!best) return fail("unreachable", target);

  // Walk back from the resident to the post, then group the edges into same-status legs.
  const steps: { point: Coord; edge: Edge }[] = [];
  for (let current = targetKey; current !== best.start; ) {
    const prev = best.previous.get(current)!;
    steps.push({ point: points.get(current)!, edge: prev.edge });
    current = prev.from;
  }
  steps.reverse();
  const origin = points.get(best.start)!;
  const legs: RouteLeg[] = [];
  let dry = 0, water = 0, usesAmber = false, last: Coord = origin;
  for (const { point, edge } of steps) {
    if (edge.status === "red") water += edge.metres;
    else dry += edge.metres;
    usesAmber ||= edge.status === "amber";
    const leg = legs[legs.length - 1];
    if (leg && leg.status === edge.status) leg.coordinates.push(point);
    else legs.push({ status: edge.status, coordinates: [last, point] });
    last = point;
  }
  return {
    found: true, outcome: "found", post: best.post,
    coordinates: [origin, ...steps.map((s) => s.point)], legs,
    origin, destination: target,
    dry_m: Math.round(dry), water_m: Math.round(water), uses_amber: usesAmber,
  };
}

function dijkstra(graph: Map<string, Edge[]>, start: string, target: string) {
  const cost = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, { from: string; edge: Edge }>();
  const pending = new Set<string>([start]);
  const visited = new Set<string>();
  while (pending.size) {
    let current = "", best = Infinity;
    for (const node of pending) {
      if (cost.get(node)! < best) { current = node; best = cost.get(node)!; }
    }
    pending.delete(current);
    visited.add(current);
    if (current === target) break;
    for (const edge of graph.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      const next = best + edge.cost;
      if (next < (cost.get(edge.to) ?? Infinity)) {
        cost.set(edge.to, next);
        previous.set(edge.to, { from: current, edge });
        pending.add(edge.to);
      }
    }
  }
  return { cost: cost.get(target) ?? Infinity, previous };
}
