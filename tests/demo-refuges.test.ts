import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildDemoRefuges, replayDryZones, snapToRoad, drainFingerprint } from "../lib/engine/demo-refuges.ts";
import { createDemoState } from "../lib/engine/demo-state.ts";
import { parseRouteTownship, type RouteTownship } from "../lib/engine/township.ts";
import { effectiveFlood, eligibleDestinations, parseCatalogue } from "../lib/engine/evacuation.ts";
import { findSafeRoute, type StreetFeature } from "../lib/engine/route.ts";
import { findResponderRoute } from "../lib/engine/help.ts";
import type { Drain } from "../lib/engine/types.ts";

const zone = (id: string, wet = false): Drain => ({ id, name: id, lng: 101, lat: 3, elevation_m: 10, bank_cm: wet ? 1 : 200,
  catchment_factor: wet ? 4 : 0.1, outflow_cm_per_min: wet ? 0 : 1 });
const road = (id: string, drain: string, coordinates: number[][]): StreetFeature => ({ properties: { id, drain_id: drain, name: id, highway: "residential" }, geometry: { type: "LineString", coordinates } });
const roads = [road("wet", "D01", [[101, 3], [101.001, 3]]), road("dry", "D02", [[101.001, 3], [101.006, 3]]),
  road("island", "D01", [[101.01, 3], [101.011, 3]])];
const drains = [zone("D01", true), zone("D02")];
const fixture = (): RouteTownship => ({ area: { slug: "fixture", name: "Fixture", bbox: [2.999, 100.999, 3.02, 101.02], center: [101.001, 3], attribution: "Original test data" },
  streets: { type: "FeatureCollection", features: structuredClone(roads) }, drains: structuredClone(drains) });

test("baseline selection is deterministic, excludes ever-red zones, and leaves flooded-only components uncovered", () => {
  const replay = replayDryZones(drains);
  assert.equal(replay.D01.flooded, true); assert.equal(replay.D02.flooded, false);
  const c = buildDemoRefuges("fixture", roads, drains);
  assert.deepEqual(buildDemoRefuges("fixture", [...roads].reverse(), [...drains].reverse()), c);
  assert.deepEqual(c.destinations.map((d) => d.street_id), ["dry"]);
  assert.equal(parseCatalogue(c, roads, "fixture").destinations[0].purpose, "demo_refuge");
  assert.equal(c.destinations[0].simulation?.through_minute, 210);
  const green = { D01: "green", D02: "green" } as const;
  assert.equal(findSafeRoute(roads, "wet", c.destinations, green).found, true);
  assert.equal(findSafeRoute(roads, "island", c.destinations, green).outcome, "disconnected");
  assert.deepEqual(buildDemoRefuges("fixture", roads, drains.map((d) => zone(d.id, true))).destinations, []);
  assert.deepEqual(buildDemoRefuges("fixture", [road("unknown", "missing", [[101, 3], [101.01, 3]])], drains).destinations, []);
});

test("all supplied townships validate and select only never-red road anchors without altering source data", () => {
  const data = new URL("../public/data/", import.meta.url);
  for (const slug of readdirSync(data)) {
    const read = (file: string) => JSON.parse(readFileSync(new URL(`${slug}/${file}`, data), "utf8"));
    const bundle = parseRouteTownship({ area: read("area.json"), streets: read("streets.geojson"), drains: read("drains.json") });
    const before = JSON.stringify(bundle), c = buildDemoRefuges(slug, bundle.streets.features, bundle.drains), replay = replayDryZones(bundle.drains);
    assert.doesNotThrow(() => parseCatalogue(c, bundle.streets.features, slug));
    for (const d of c.destinations) {
      const street = bundle.streets.features.find((s) => s.properties.id === d.street_id)!;
      assert.equal(replay[street.properties.drain_id].flooded, false);
      assert.equal(d.simulation?.peak_cm, replay[street.properties.drain_id].peak_cm);
    }
    assert.equal(JSON.stringify(bundle), before);
  }
});

test("revision responds to drainage assumptions, long road names stay valid, simulation evidence is validated", () => {
  const c = buildDemoRefuges("fixture", roads, drains), changed = structuredClone(drains);
  changed[1].outflow_cm_per_min += 0.1;
  assert.notEqual(drainFingerprint(drains), drainFingerprint(changed));
  assert.notEqual(c.revision, buildDemoRefuges("fixture", roads, changed).revision);
  const long = structuredClone(roads); long[1].properties.name = "x".repeat(300);
  assert.doesNotThrow(() => parseCatalogue(buildDemoRefuges("fixture", long, drains), long, "fixture"));
  c.destinations[0].simulation!.bank_cm = 0;
  assert.throws(() => parseCatalogue(c, roads, "fixture"));
});

test("baseline dryness never overrides current red, amber or unknown access, or closure", () => {
  const c = buildDemoRefuges("fixture", roads, drains);
  for (const status of ["amber", "red", undefined] as const) assert.equal(eligibleDestinations(c, { D02: status }, roads, 0).length, 0);
  assert.equal(eligibleDestinations(c, { D02: "green" }, roads, 0).length, 1);
  c.destinations[0].availability = "closed";
  assert.equal(eligibleDestinations(c, { D02: "green" }, roads, 0).length, 0);
});

test("snapping is bounded and geographic, preserves the closest origin even when it is flooded", () => {
  const near = snapToRoad(roads, [101.0005, 3.00001]);
  assert.equal(near?.street_id, "wet"); assert.ok(Math.abs(near!.position.fraction - 0.5) < 1e-8);
  assert.equal(near!.position.segment_index, 0); assert.ok(near!.distance_m < 2);
  const c = buildDemoRefuges("fixture", roads, drains);
  assert.equal(findSafeRoute(roads, near!.street_id, c.destinations, { D01: "red", D02: "green" }, null, near!.position).outcome, "origin_blocked");
  assert.equal(snapToRoad(roads, [102, 3]), null); assert.equal(snapToRoad(roads, [NaN, 3]), null);
  assert.equal(snapToRoad(roads, [181, 3]), null);
  const ties = [road("b", "D01", [[101, 3], [101.001, 3]]), road("a", "D02", [[101, 3], [101.001, 3]])];
  assert.equal(snapToRoad(ties, [101.0005, 3])?.street_id, "a");
});

test("township validation rejects duplicate IDs, unmapped zones, bad bounds and invalid road coordinates", () => {
  for (const mutate of [
    (b: RouteTownship) => { b.drains.push(b.drains[0]); },
    (b: RouteTownship) => { b.streets.features.push(b.streets.features[0]); },
    (b: RouteTownship) => { b.streets.features[0].properties.drain_id = "absent"; },
    (b: RouteTownship) => { b.area.slug = "../outside"; },
    (b: RouteTownship) => { b.area.bbox[2] = 4; },
    (b: RouteTownship) => { b.streets.features[0].geometry.coordinates[0] = [0, 0]; },
    (b: RouteTownship) => { b.drains[0].bank_cm = NaN; },
  ]) { const b = fixture(); mutate(b); assert.throws(() => parseRouteTownship(b)); }
  const b = fixture(), clone = parseRouteTownship(b); b.area.name = "mutated"; assert.equal(clone.area.name, "Fixture");
});

test("township state isolates colliding drain IDs and only renews actual per-drain demo observations", () => {
  const a = createDemoState("a", drains, "epoch"), b = createDemoState("b", drains, "epoch"), now = 10000;
  assert.equal(effectiveFlood(a.snapshot(now).statuses, a.snapshot(now).floodEvidence, now).conditions, "waiting");
  const metadata = a.update([], { running: true }, now);
  assert.deepEqual(metadata.floodEvidence.observed_at, {});
  const snapshot = a.update([{ drain_id: "D01", level_cm: 20 }], {}, now);
  assert.equal(snapshot.statuses.D01.status, "red"); assert.equal(b.snapshot(now).statuses.D01.status, "green");
  assert.equal(b.snapshot(now).floodEvidence.controller_at, null);
  assert.deepEqual(Object.keys(effectiveFlood(snapshot.statuses, snapshot.floodEvidence, now).statuses), ["D01"]);
  a.update([], { running: true }, now + 6000);
  assert.deepEqual(effectiveFlood(a.snapshot(now + 6000).statuses, a.snapshot(now + 6000).floodEvidence, now + 6000).statuses, {});
  snapshot.statuses.D01.level_cm = 999; assert.equal(a.snapshot(now).statuses.D01.level_cm, 20);
  const reset = a.reset(now); assert.equal(reset.running, false); assert.equal(effectiveFlood(reset.statuses, reset.floodEvidence, now + 100000).conditions, "frozen");
  const device = a.update([{ drain_id: "D01", level_cm: 10, source: "device" }], {}, now + 1);
  assert.equal(device.floodEvidence.observed_at.D01, undefined);
});

test("responder routes end at the confirmed segment anchor; unconfigured posts keep a location marker", () => {
  const posts = [{ id: "post", name: "Demo post", street_id: "wet" }], status = { D01: "green", D02: "green" } as const;
  const p = { segment_index: 0, fraction: 0.25 };
  const route = findResponderRoute(roads, posts, "dry", status, p);
  assert.equal(route.found, true); assert.deepEqual(route.destination, [101.00225, 3]);
  assert.deepEqual(route.coordinates.at(-1), route.destination);
  const noPosts = findResponderRoute(roads, [], "dry", status, p);
  assert.equal(noPosts.outcome, "no_posts"); assert.deepEqual(noPosts.destination, route.destination);
  assert.equal(findResponderRoute(roads, posts, "dry", status, { ...p, fraction: 2 }).outcome, "invalid_resident");
});
