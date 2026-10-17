import type { Status } from "./types.ts";

export interface StreetFeature {
  properties: { id: string; name: string | null; drain_id: string; highway: string };
  geometry: { type: "LineString"; coordinates: number[][] };
}

export interface RoadPosition {
  segment_index: number;
  fraction: number;
}

export interface RoadPoint {
  street_id: string;
  position: RoadPosition;
}

// Dropdown points use the first vertex; map pins use a position along a road segment.
export interface RouteDestination {
  id: string;
  name: string;
  street_id: string;
  kind: "demo";
  position?: RoadPosition;
}

export type RouteOutcome = "found" | "no_destinations" | "invalid_origin" | "origin_blocked" |
  "origin_unknown" | "destination_unavailable" | "disconnected" | "no_route";

export interface RouteResult {
  found: boolean;
  outcome: RouteOutcome;
  coordinates: [number, number][];
  origin: [number, number] | null;
  destination: [number, number] | null;
  distance_m: number;
  destination_name: string;
  destination_id: string | null;
  excluded_streets: number;
  unknown_streets: number;
  uses_amber: boolean;
}

type Coord = [number, number];
type Edge = { to: string; distance: number; amber: boolean };
const key = (c: number[]) => `${c[0]},${c[1]}`;
const coord = (c: number[]): Coord => [c[0], c[1]];
const distance = (a: number[], b: number[]) => Math.hypot(
  (b[0] - a[0]) * 111320 * Math.cos(a[1] * Math.PI / 180),
  (b[1] - a[1]) * 110574,
);

function anchor(street: StreetFeature | undefined, position?: RoadPosition): Coord | null {
  const coords = street?.geometry.coordinates;
  if (!coords?.length) return null;
  if (!position) return coord(coords[0]);
  const { segment_index: i, fraction: t } = position;
  if (!Number.isInteger(i) || i < 0 || i + 1 >= coords.length || !Number.isFinite(t) || t < 0 || t > 1) return null;
  if (t === 0) return coord(coords[i]);
  if (t === 1) return coord(coords[i + 1]);
  return [coords[i][0] + t * (coords[i + 1][0] - coords[i][0]), coords[i][1] + t * (coords[i + 1][1] - coords[i][1])];
}

/** Walks the supplied road graph. Shared vertices connect roads; visual crossings do not. */
export function findSafeRoute(
  streets: StreetFeature[],
  originStreetId: string,
  destinations: RouteDestination[],
  statuses: Record<string, Status | undefined>,
  selectedDestinationId: string | null = null,
  originPosition?: RoadPosition,
): RouteResult {
  const byId = new Map(streets.map((s) => [s.properties.id, s]));
  const originStreet = byId.get(originStreetId);
  const origin = anchor(originStreet, originPosition);
  const selected = destinations.find((d) => d.id === selectedDestinationId);
  const excluded = streets.filter((s) => statuses[s.properties.drain_id] === "red").length;
  const unknown = streets.filter((s) => !statuses[s.properties.drain_id]).length;
  const failure = (outcome: RouteOutcome): RouteResult => ({
    found: false, outcome, coordinates: [], origin: origin ? coord(origin) : null,
    destination: selected ? anchor(byId.get(selected.street_id), selected.position) : null,
    distance_m: 0, destination_name: selected?.name ?? "", destination_id: selected?.id ?? null,
    excluded_streets: excluded, unknown_streets: unknown, uses_amber: false,
  });
  if (!destinations.length) return failure("no_destinations");
  if (!origin || !originStreet) return failure("invalid_origin");
  const originStatus = statuses[originStreet.properties.drain_id];
  if (!originStatus) return failure("origin_unknown");
  if (originStatus === "red") return failure("origin_blocked");

  const eligible = destinations.filter((d) => {
    const street = byId.get(d.street_id);
    return (!selectedDestinationId || d.id === selectedDestinationId) &&
      anchor(street, d.position) && street && statuses[street.properties.drain_id] === "green";
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (!eligible.length) return failure("destination_unavailable");

  const graph = new Map<string, Edge[]>();
  const fullGraph = new Map<string, string[]>();
  const points = new Map<string, Coord>();
  for (const street of streets) {
    const state = statuses[street.properties.drain_id];
    const coords = street.geometry.coordinates;
    for (let i = 0; i + 1 < coords.length; i++) {
      const inserts: { fraction: number; point: Coord }[] = [];
      if (street.properties.id === originStreetId && originPosition?.segment_index === i) {
        inserts.push({ fraction: originPosition.fraction, point: origin });
      }
      for (const destination of eligible) {
        if (destination.street_id === street.properties.id && destination.position?.segment_index === i) {
          inserts.push({ fraction: destination.position.fraction, point: anchor(street, destination.position)! });
        }
      }
      inserts.sort((a, b) => a.fraction - b.fraction);
      const segment = [coord(coords[i]), ...inserts.map((insert) => insert.point), coord(coords[i + 1])];
      for (let j = 0; j + 1 < segment.length; j++) {
      const a = key(segment[j]), b = key(segment[j + 1]);
      if (a === b) continue;
      points.set(a, segment[j]); points.set(b, segment[j + 1]);
      fullGraph.set(a, [...(fullGraph.get(a) ?? []), b]);
      fullGraph.set(b, [...(fullGraph.get(b) ?? []), a]);
      if (!state || state === "red") continue;
      const edgeDistance = distance(segment[j], segment[j + 1]);
      graph.set(a, [...(graph.get(a) ?? []), { to: b, distance: edgeDistance, amber: state === "amber" }]);
      graph.set(b, [...(graph.get(b) ?? []), { to: a, distance: edgeDistance, amber: state === "amber" }]);
      }
    }
  }

  const start = key(origin);
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, { from: string; amber: boolean }>();
  const pending = new Set<string>([start]);
  const visited = new Set<string>();
  while (pending.size) {
    let current = "", best = Infinity;
    for (const node of pending) {
      if (distances.get(node)! < best) { current = node; best = distances.get(node)!; }
    }
    pending.delete(current); visited.add(current);
    for (const edge of graph.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      const next = best + edge.distance;
      if (next < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, next);
        previous.set(edge.to, { from: current, amber: edge.amber });
        pending.add(edge.to);
      }
    }
  }
  let chosen: RouteDestination | undefined;
  let bestDistance = Infinity;
  for (const destination of eligible) {
    const target = key(anchor(byId.get(destination.street_id), destination.position)!);
    const d = distances.get(target) ?? Infinity;
    if (d < bestDistance) { chosen = destination; bestDistance = d; }
  }
  if (!chosen) {
    const connected = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      for (const next of fullGraph.get(queue[i]) ?? []) {
        if (!connected.has(next)) { connected.add(next); queue.push(next); }
      }
    }
    return failure(eligible.some((d) => connected.has(key(anchor(byId.get(d.street_id), d.position)!)))
      ? "no_route" : "disconnected");
  }
  const targetCoord = anchor(byId.get(chosen.street_id), chosen.position)!;
  let current = key(targetCoord), usesAmber = false;
  const path: Coord[] = [coord(targetCoord)];
  while (current !== start) {
    const prev = previous.get(current)!;
    usesAmber ||= prev.amber;
    current = prev.from;
    path.push(points.get(current)!);
  }
  return {
    found: true, outcome: "found", coordinates: path.reverse(), origin: coord(origin),
    destination: coord(targetCoord), distance_m: Math.round(bestDistance),
    destination_name: chosen.name, destination_id: chosen.id,
    excluded_streets: excluded, unknown_streets: unknown, uses_amber: usesAmber,
  };
}
