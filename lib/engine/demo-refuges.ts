// Simulation-derived road anchors, never a claim that a real shelter exists there.
import { assess } from "./risk.ts";
import { stepLevel } from "./sim.ts";
import { rainAt } from "./storm.ts";
import { roadFingerprint, type EvacuationCatalogue, type EvacuationDestination } from "./evacuation.ts";
import type { RoadPoint, StreetFeature } from "./route.ts";
import type { Drain } from "./types.ts";

export const REFUGE_MODEL = "baseline-demo-storm-v1";
export function drainFingerprint(drains: Drain[]): string {
  const text = JSON.stringify([...drains].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map((d) => [d.id, d.bank_cm, d.catchment_factor, d.outflow_cm_per_min]));
  let hash = 2166136261;
  for (const c of text) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16);
}
export function replayDryZones(drains: Drain[]) {
  return Object.fromEntries(drains.map((drain) => {
    const history = [0];
    let peak = 0, flooded = false, amber = false;
    // Same 210 ticks, minute rounding and history window as /control.
    for (let minute = 0; minute < 210; minute++) {
      history.push(Math.round(stepLevel(drain, history.at(-1)!, rainAt(minute)) * 10) / 10);
      if (history.length > 30) history.shift();
      const status = assess(drain, history);
      peak = Math.max(peak, status.level_cm);
      flooded ||= status.status === "red";
      amber ||= status.status === "amber";
    }
    return [drain.id, { peak_cm: peak, bank_cm: drain.bank_cm, flooded, amber }];
  }));
}
export function metresBetween(a: number[], b: number[]) {
  return Math.hypot((a[0] - b[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 110574);
}
export function snapToRoad(streets: StreetFeature[], point: [number, number], maxMetres = 75): (RoadPoint & { coordinate: [number, number]; distance_m: number }) | null {
  if (!point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) return null;
  let best: ReturnType<typeof snapToRoad> = null;
  const xScale = 111320 * Math.cos(point[1] * Math.PI / 180), yScale = 110574;
  for (const street of [...streets].sort((a, b) => a.properties.id < b.properties.id ? -1 : 1)) {
    for (let i = 0; i + 1 < street.geometry.coordinates.length; i++) {
      const a = street.geometry.coordinates[i], b = street.geometry.coordinates[i + 1];
      const dx = (b[0] - a[0]) * xScale, dy = (b[1] - a[1]) * yScale;
      const length2 = dx * dx + dy * dy;
      if (!length2) continue;
      const t = Math.max(0, Math.min(1, (((point[0] - a[0]) * xScale) * dx + ((point[1] - a[1]) * yScale) * dy) / length2));
      const coordinate: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const distance = metresBetween(point, coordinate);
      if (distance <= maxMetres && (!best || distance < best.distance_m - 1e-6)) best = { street_id: street.properties.id, position: { segment_index: i, fraction: t }, coordinate, distance_m: distance };
    }
  }
  return best;
}

export function buildDemoRefuges(area: string, streets: StreetFeature[], drains: Drain[]): EvacuationCatalogue {
  const network = roadFingerprint(streets), zones = replayDryZones(drains);
  const ordered = [...streets].sort((a, b) => a.properties.id < b.properties.id ? -1 : 1);
  const parents = new Map<string, string>();
  const root = (id: string): string => {
    let node = id;
    while (parents.has(node) && parents.get(node) !== node) node = parents.get(node)!;
    const found = node;
    node = id;
    while (parents.has(node) && parents.get(node) !== node) { const next = parents.get(node)!; parents.set(node, found); node = next; }
    if (!parents.has(found)) parents.set(found, found);
    return found;
  };
  const vertices = new Map<string, string>();
  for (const s of ordered) for (const point of s.geometry.coordinates) {
    const key = point.join(","), other = vertices.get(key);
    if (other) parents.set(root(s.properties.id), root(other));
    else vertices.set(key, s.properties.id);
  }
  const groups = new Map<string, EvacuationDestination[]>();
  for (const s of ordered) {
    const zone = zones[s.properties.drain_id];
    if (!zone || zone.flooded) continue;
    let index = 0, length = 0;
    for (let i = 0; i + 1 < s.geometry.coordinates.length; i++) {
      const candidateLength = metresBetween(s.geometry.coordinates[i], s.geometry.coordinates[i + 1]);
      if (candidateLength > length) { length = candidateLength; index = i; }
    }
    if (!length) continue;
    const a = s.geometry.coordinates[index], b = s.geometry.coordinates[index + 1];
    const entrance: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const d: EvacuationDestination = {
      id: `dry-${s.properties.id}`, name: `Demo dry point · ${s.properties.name || s.properties.id}`.slice(0, 100), area_slug: area,
      street_id: s.properties.id, position: { segment_index: index, fraction: 0.5 }, entrance, kind: "demo", purpose: "demo_refuge",
      verification_state: "candidate", source: REFUGE_MODEL, source_id: s.properties.id, source_url: null,
      licence: "HydroTwin simulation result; road anchors © OpenStreetMap contributors (ODbL 1.0)",
      verified_at: null, verification_expires_at: null, availability: "open", availability_observed_at: null, availability_expires_at: null,
      access: { network_fingerprint: network, verification_state: "schematic", expires_at: null }, accessibility: "unknown", disabled: false,
      simulation: { model: REFUGE_MODEL, peak_cm: zone.peak_cm, bank_cm: zone.bank_cm, ever_amber: zone.amber, through_minute: 210 },
    };
    const component = root(s.properties.id);
    groups.set(component, [...(groups.get(component) ?? []), d]);
  }
  const selected: EvacuationDestination[] = [];
  for (const candidates of groups.values()) {
    candidates.sort((a, b) => a.simulation!.peak_cm / a.simulation!.bank_cm - b.simulation!.peak_cm / b.simulation!.bank_cm || (a.id < b.id ? -1 : 1));
    const local = [candidates[0]];
    while (local.length < 3 && selected.length + local.length < 100) {
      let next: EvacuationDestination | undefined, farthest = 200;
      for (const candidate of candidates) {
        if (local.includes(candidate)) continue;
        const distance = Math.min(...local.map((d) => metresBetween(candidate.entrance, d.entrance)));
        if (distance > farthest) { next = candidate; farthest = distance; }
      }
      if (!next) break;
      local.push(next);
    }
    selected.push(...local);
    if (selected.length >= 100) break;
  }
  return { schema_version: 1, area_slug: area, revision: `${REFUGE_MODEL}:${network}:${drainFingerprint(drains)}`,
    network_fingerprint: network, generated_at: "2026-10-21T00:00:00.000Z", mode: "demo", destinations: selected };
}
