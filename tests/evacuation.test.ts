import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateEvacuation, effectiveFlood, eligibleDestinations, parseCatalogue, roadFingerprint, routeChange, withdrawRoute,
  type EvacuationCatalogue, type EvacuationDestination, type FloodEvidence } from "../lib/engine/evacuation.ts";
import { findSafeRoute, type StreetFeature } from "../lib/engine/route.ts";
import type { DrainStatus } from "../lib/engine/types.ts";

const now = Date.parse("2026-10-21T00:00:00Z");
const road = (id: string, coords: number[][]): StreetFeature => ({ properties: { id, name: id, drain_id: id, highway: "residential" }, geometry: { type: "LineString", coordinates: coords } });
const streets = [road("origin", [[101, 3], [101.001, 3]]), road("shortcut", [[101.001, 3], [101.002, 3]]),
  road("detour", [[101.001, 3], [101.001, 3.001], [101.002, 3]]), road("target", [[101.002, 3], [101.003, 3]]),
  road("backup", [[101.003, 3], [101.004, 3]]), road("island", [[101.01, 3], [101.011, 3]])];
const fingerprint = roadFingerprint(streets);
const statuses: Record<string, DrainStatus> = Object.fromEntries(streets.map((s) => [s.properties.id, { drain_id: s.properties.id, status: "green", level_cm: 0, rate_cm_per_min: 0, minutes_to_red: null, street_depth_cm: 0 }]));
const evidence: FloodEvidence = { source: "phone_demo", revision: "session:1", observed_at: Object.fromEntries(Object.keys(statuses).map((id) => [id, now])), controller_at: now, running: true, minute: 1 };
const destination = (street = "target", id = street): EvacuationDestination => ({ id, name: id, area_slug: "fixture", street_id: street,
  position: { segment_index: 0, fraction: 0 }, kind: "demo", purpose: "evacuation_centre", verification_state: "candidate",
  source: "fictional fixture", source_id: id, source_url: null, licence: "Original fixture", verified_at: null, verification_expires_at: null,
  availability: "open", availability_observed_at: null, availability_expires_at: null, entrance: streets.find((s) => s.properties.id === street)!.geometry.coordinates[0] as [number, number],
  access: { network_fingerprint: fingerprint, verification_state: "schematic", expires_at: null }, accessibility: "unknown", disabled: false });
const catalogue = (): EvacuationCatalogue => ({ schema_version: 1, area_slug: "fixture", revision: "demo-v1", network_fingerprint: fingerprint, generated_at: new Date(now).toISOString(), mode: "demo", destinations: [destination()] });
const colors = { origin: "green", shortcut: "green", detour: "green", target: "green", backup: "green", island: "green" } as const;
function run(c = catalogue(), s = statuses, e = evidence, at = now, selectedId: string | null = null) {
  return calculateEvacuation({ streets, origin: "origin", catalogue: c, statuses: s, evidence: e, now: at, residentId: "fixture-resident", selectedId });
}

test("catalogue parsing rejects the entire invalid import and isolates its returned data", () => {
  const c = catalogue();
  const parsed = parseCatalogue(c, streets, "fixture");
  c.destinations[0].name = "changed";
  assert.equal(parsed.destinations[0].name, "target");
  const mutations: ((c: EvacuationCatalogue) => void)[] = [
    (c) => { c.destinations.push(structuredClone(c.destinations[0])); },
    (c) => { c.destinations[0].entrance = [999, 3]; },
    (c) => { c.destinations[0].entrance = [102, 3]; },
    (c) => { c.destinations[0].area_slug = "other"; },
    (c) => { c.schema_version = 2 as 1; },
    (c) => { c.network_fingerprint = "old-network"; },
    (c) => { c.destinations[0].position!.fraction = 2; },
    (c) => { c.destinations[0].access.network_fingerprint = "old-network"; },
    (c) => { c.destinations[0].availability_expires_at = "invalid"; },
  ];
  for (const mutate of mutations) { const bad = catalogue(); mutate(bad); assert.throws(() => parseCatalogue(bad, streets, "fixture")); }
  assert.throws(() => parseCatalogue(catalogue(), streets, "other"));
});

test("fingerprint ignores road ordering but detects geometry and drain-assignment changes", () => {
  assert.equal(roadFingerprint([...streets].reverse()), fingerprint);
  const changed = structuredClone(streets); changed[0].properties.drain_id = "other";
  assert.notEqual(roadFingerprint(changed), fingerprint);
});

test("closed, full, unknown, disabled, parking, rejected and expired-access destinations are excluded", () => {
  for (const availability of ["closed", "full", "unknown"] as const) {
    const c = catalogue(); c.destinations[0].availability = availability;
    assert.equal(run(c).route.outcome, "destination_unavailable");
  }
  for (const mutate of [
    (d: EvacuationDestination) => { d.disabled = true; },
    (d: EvacuationDestination) => { d.purpose = "vehicle_parking"; },
    (d: EvacuationDestination) => { d.purpose = "assembly_point"; },
    (d: EvacuationDestination) => { d.verification_state = "rejected"; },
    (d: EvacuationDestination) => { d.access.expires_at = new Date(now).toISOString(); },
  ]) { const c = catalogue(); mutate(c.destinations[0]); assert.equal(eligibleDestinations(c, colors, streets, now).length, 0); }
});

test("operational eligibility needs current independent evidence and never admits demo candidates", () => {
  const c = catalogue(); c.mode = "operational";
  assert.equal(run(c).route.found, false);
  const d = c.destinations[0];
  d.kind = "verified"; d.verification_state = "verified"; d.access.verification_state = "verified";
  d.verified_at = d.availability_observed_at = new Date(now - 1000).toISOString();
  d.verification_expires_at = d.availability_expires_at = d.access.expires_at = new Date(now + 1000).toISOString();
  assert.equal(run(c).route.found, true);
  assert.equal(run(c, statuses, evidence, now + 1000).route.found, false);
  d.availability_observed_at = new Date(now + 500).toISOString();
  assert.equal(run(c).route.found, false);
  c.mode = "demo";
  assert.equal(run(c).route.found, false);
});

test("green-only route wins over a shorter amber route; amber is a warning fallback", () => {
  const s = { ...colors, shortcut: "amber" as const };
  const green = findSafeRoute(streets, "origin", [destination()], s);
  assert.equal(green.found, true); assert.equal(green.uses_amber, false);
  assert.ok(green.legs.some((l) => l.street_id === "detour"));
  const amber = findSafeRoute(streets, "origin", [destination()], { ...s, detour: "red" });
  assert.equal(amber.uses_amber, true); assert.ok(amber.amber_m > 0);
  assert.ok(amber.distance_m < green.distance_m);
  assert.ok(amber.legs.every((leg) => leg.status !== ("red" as string)));
});

test("equal-distance destination ties use stable ID order", () => {
  const result = findSafeRoute(streets, "origin", [destination("target", "z"), destination("target", "a")], colors);
  assert.equal(result.destination_id, "a");
});

test("blocked/unknown origins never show a travel line, including when no centre is eligible", () => {
  const c = catalogue(); c.destinations[0].availability = "closed";
  const blocked = run(c, { ...statuses, origin: { ...statuses.origin, status: "red" } });
  assert.equal(blocked.route.outcome, "origin_blocked"); assert.deepEqual(blocked.route.coordinates, []);
  const unknown = run(catalogue(), statuses, { ...evidence, observed_at: { target: now } });
  assert.equal(unknown.route.outcome, "origin_unknown"); assert.deepEqual(unknown.route.coordinates, []);
});

test("a route flood produces a green detour, then complete failure; coverage failure is distinct", () => {
  const first = run();
  const blocked = { ...statuses, shortcut: { ...statuses.shortcut, status: "red" as const } };
  const detour = run(catalogue(), blocked);
  assert.equal(detour.route.found, true); assert.equal(routeChange(first, detour), "flooded");
  assert.ok(detour.route.legs.some((l) => l.street_id === "detour"));
  assert.equal(run(catalogue(), { ...blocked, detour: { ...statuses.detour, status: "red" } }).route.outcome, "no_route");
  const c = catalogue(); c.destinations = [destination("island")];
  assert.equal(run(c).route.outcome, "disconnected");
});

test("closure scenario harness selects another centre, fails when all close and recovers", () => {
  const c = catalogue(); c.destinations.push(destination("backup"));
  const first = run(c); assert.equal(first.route.destination_id, "target");
  c.destinations[0].availability = "closed";
  const alternative = run(c); assert.equal(alternative.route.destination_id, "backup");
  assert.equal(routeChange(first, alternative), "destination");
  assert.equal(run(c, statuses, evidence, now, "target").route.found, false);
  c.destinations[1].availability = "closed";
  const failed = run(c); assert.equal(failed.route.found, false);
  c.destinations[0].availability = "open";
  assert.equal(routeChange(failed, run(c)), "recovered");
});

test("availability expires without a flood event or renewed poll; route lifetime is bounded", () => {
  const c = catalogue(); c.destinations[0].availability_expires_at = new Date(now + 500).toISOString();
  assert.equal(run(c).valid_for_ms, 500);
  assert.equal(run(c, statuses, evidence, now + 500).route.found, false);
});

test("no controller, metadata-only and successful empty responses cannot establish initial green", () => {
  for (const e of [{ ...evidence, controller_at: null }, { ...evidence, observed_at: {} }]) {
    const result = run(catalogue(), statuses, e);
    assert.equal(result.conditions, "waiting"); assert.equal(result.route.found, false); assert.deepEqual(result.statuses, {});
  }
  assert.equal(run(catalogue(), {}).route.found, false);
});

test("fresh controller cannot refresh stale per-drain evidence; partial readings stay partial", () => {
  const result = run(catalogue(), statuses, { ...evidence, controller_at: now + 6000 }, now + 6000);
  assert.equal(result.route.found, false); assert.deepEqual(result.statuses, {});
  const partial = effectiveFlood(statuses, { ...evidence, observed_at: { origin: now } }, now);
  assert.deepEqual(Object.keys(partial.statuses), ["origin"]);
});

test("running controller loss expires exactly at six seconds, frozen snapshots require API liveness", () => {
  assert.equal(run(catalogue(), statuses, evidence, now + 5999).route.found, true);
  const lost = run(catalogue(), statuses, evidence, now + 6000);
  assert.equal(lost.conditions, "stale"); assert.deepEqual(lost.route.coordinates, []);
  const paused = run(catalogue(), statuses, { ...evidence, running: false }, now + 100000);
  assert.equal(paused.conditions, "frozen"); assert.equal(paused.route.found, true); assert.equal(paused.valid_for_ms, 6000);
  const offline = withdrawRoute(paused, "offline");
  assert.deepEqual(offline.statuses, {}); assert.deepEqual(offline.route.legs, []); assert.deepEqual(offline.route.coordinates, []);
  assert.equal(routeChange(paused, offline), "unavailable"); assert.equal(routeChange(offline, paused), "recovered");
  assert.equal(run(catalogue(), statuses, { ...evidence, minute: 210 }, now + 100000).conditions, "frozen");
});

test("route change evidence uses the actual previous path, not township-wide exclusions", () => {
  const first = run();
  const unrelated = run(catalogue(), { ...statuses, island: { ...statuses.island, status: "red" } });
  assert.equal(routeChange(first, unrelated), null);
  const unknown = run(catalogue(), statuses, { ...evidence, observed_at: { ...evidence.observed_at, shortcut: now - 6000 } });
  assert.equal(routeChange(first, unknown), "unknown");
  assert.equal(routeChange(first, { ...unknown, resident_id: "another-resident" }), null);
  assert.equal(routeChange(first, { ...unknown, source: "local_demo" }), null);
  assert.equal(routeChange(first, first), null);
});

test("the published catalogue covers connected origins and honestly rejects the flooded-only island", () => {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/bukit-raja/${name}`, import.meta.url), "utf8"));
  const roads: StreetFeature[] = read("streets.geojson").features;
  const c = parseCatalogue(read("evacuation-destinations.json"), roads, "bukit-raja");
  const residents = ["w164812609", "w164812661", "w164812569", "w164812603", "w164812607", "w164812549", "w164812620", "w164812591"];
  const green = Object.fromEntries(roads.map((s) => [s.properties.drain_id, "green" as const]));
  for (const origin of residents) {
    const route = findSafeRoute(roads, origin, c.destinations, green);
    assert.equal(route.found, origin !== "w164812620", origin);
    if (origin === "w164812620") assert.equal(route.outcome, "disconnected");
  }
});
