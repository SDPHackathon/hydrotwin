// Safe evacuation route finder on the street network.
// Blocks red (flooded) streets and finds the shortest path to high ground/safety point.
// Follows docs/spec.md ROUTE-1. Pure TypeScript (no React, Next, or Supabase).

export interface StreetFeature {
  properties: {
    id: string;
    name: string | null;
    drain_id: string;
    highway: string;
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
}

export interface RouteResult {
  found: boolean;
  coordinates: [number, number][];
  distance_m: number;
  blocked_streets_avoided: number;
  destination_name: string;
}

interface Edge {
  to: string;
  dist: number;
  drain_id: string;
  street_id: string;
  coords: [number, number][];
}

// Convert degrees to approximate meters at Malaysia latitude (~3 deg N)
function distanceMeters(p1: number[], p2: number[]): number {
  const dLng = (p2[0] - p1[0]) * 111320 * Math.cos((p1[1] * Math.PI) / 180);
  const dLat = (p2[1] - p1[1]) * 110574;
  return Math.sqrt(dLng * dLng + dLat * dLat);
}

function coordKey(c: number[]): string {
  return `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
}

export function findSafeRoute(
  streets: StreetFeature[],
  startCoord: number[],
  destCoord: number[],
  destName: string,
  blockedDrainIds: Set<string>,
): RouteResult {
  const graph = new Map<string, Edge[]>();
  let blockedEdgeCount = 0;

  // 1. Build adjacency list
  for (const s of streets) {
    const isBlocked = blockedDrainIds.has(s.properties.drain_id);
    if (isBlocked) {
      blockedEdgeCount++;
      continue; // Block flooded street
    }

    const coords = s.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const u = coordKey(coords[i]);
      const v = coordKey(coords[i + 1]);
      const dist = distanceMeters(coords[i], coords[i + 1]);

      if (!graph.has(u)) graph.set(u, []);
      if (!graph.has(v)) graph.set(v, []);

      const edgeCoords: [number, number][] = [
        [coords[i][0], coords[i][1]],
        [coords[i + 1][0], coords[i + 1][1]],
      ];

      graph.get(u)!.push({
        to: v,
        dist,
        drain_id: s.properties.drain_id,
        street_id: s.properties.id,
        coords: edgeCoords,
      });
      graph.get(v)!.push({
        to: u,
        dist,
        drain_id: s.properties.drain_id,
        street_id: s.properties.id,
        coords: [[coords[i + 1][0], coords[i + 1][1]], [coords[i][0], coords[i][1]]],
      });
    }
  }

  // 2. Find nearest graph nodes to start and dest
  let startNode = "";
  let startMinDist = Infinity;
  let destNode = "";
  let destMinDist = Infinity;

  for (const nodeKey of graph.keys()) {
    const [lng, lat] = nodeKey.split(",").map(Number);
    const dStart = distanceMeters([lng, lat], startCoord);
    if (dStart < startMinDist) {
      startMinDist = dStart;
      startNode = nodeKey;
    }
    const dDest = distanceMeters([lng, lat], destCoord);
    if (dDest < destMinDist) {
      destMinDist = dDest;
      destNode = nodeKey;
    }
  }

  if (!startNode || !destNode) {
    return {
      found: false,
      coordinates: [],
      distance_m: 0,
      blocked_streets_avoided: blockedEdgeCount,
      destination_name: destName,
    };
  }

  // 3. Dijkstra's Algorithm
  const distances = new Map<string, number>();
  const previous = new Map<string, { from: string; coords: [number, number][] }>();
  const unvisited = new Set<string>();

  for (const node of graph.keys()) {
    distances.set(node, Infinity);
    unvisited.add(node);
  }
  distances.set(startNode, 0);

  while (unvisited.size > 0) {
    // Pick unvisited with smallest distance
    let current: string | null = null;
    let shortest = Infinity;
    for (const node of unvisited) {
      const d = distances.get(node) ?? Infinity;
      if (d < shortest) {
        shortest = d;
        current = node;
      }
    }

    if (!current || shortest === Infinity || current === destNode) break;

    unvisited.delete(current);

    const edges = graph.get(current) ?? [];
    for (const edge of edges) {
      if (!unvisited.has(edge.to)) continue;
      const alt = shortest + edge.dist;
      if (alt < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, alt);
        previous.set(edge.to, { from: current, coords: edge.coords });
      }
    }
  }

  // 4. Reconstruct path
  if (!previous.has(destNode) && startNode !== destNode) {
    return {
      found: false,
      coordinates: [],
      distance_m: 0,
      blocked_streets_avoided: blockedEdgeCount,
      destination_name: destName,
    };
  }

  const pathCoords: [number, number][] = [];
  let curr = destNode;

  while (curr !== startNode) {
    const prev = previous.get(curr);
    if (!prev) break;
    pathCoords.unshift(prev.coords[1]);
    curr = prev.from;
  }
  const [startLng, startLat] = startNode.split(",").map(Number);
  pathCoords.unshift([startLng, startLat]);

  return {
    found: true,
    coordinates: pathCoords,
    distance_m: Math.round(distances.get(destNode) ?? 0),
    blocked_streets_avoided: blockedEdgeCount,
    destination_name: destName,
  };
}
