import { test } from "node:test";
import assert from "node:assert/strict";
import { findSafeRoute, type RouteDestination, type StreetFeature } from "../lib/engine/route.ts";

const road = (id: string, zone: string, coords: number[][]): StreetFeature => ({
  properties: { id, name: id, drain_id: zone, highway: "residential" },
  geometry: { type: "LineString", coordinates: coords },
});
const point = (street: string): RouteDestination => ({ id: street, name: `Demo ${street}`, street_id: street, kind: "demo" });
const streets = [
  road("origin", "ZONE-A", [[101, 3], [101.001, 3]]),
  road("near", "ZONE-B", [[101.001, 3], [101.002, 3]]),
  road("far", "ZONE-C", [[101.002, 3], [101.003, 3]]),
  road("island", "ZONE-D", [[102, 3], [102.001, 3]]),
];
const statuses = { "ZONE-A": "green", "ZONE-B": "green", "ZONE-C": "green", "ZONE-D": "green" } as const;

test("automatic routing chooses the nearest reachable demo point in a township with arbitrary IDs", () => {
  const result = findSafeRoute(streets, "origin", [point("far"), point("island"), point("near")], statuses);
  assert.equal(result.destination_id, "near");
  assert.ok(result.distance_m > 0);
  assert.deepEqual(result.coordinates, [[101, 3], [101.001, 3]]);
});

test("a flooded origin cannot jump onto a nearby clear road", () => {
  const result = findSafeRoute(streets, "origin", [point("near")], { ...statuses, "ZONE-A": "red" });
  assert.equal(result.outcome, "origin_blocked");
  assert.deepEqual(result.coordinates, []);
});

test("manual selection is honored and disconnected data is reported separately", () => {
  const result = findSafeRoute(streets, "origin", [point("near"), point("island")], statuses, "island");
  assert.equal(result.outcome, "disconnected");
});

test("route disappears when a connecting road floods and returns when it clears", () => {
  assert.equal(findSafeRoute(streets, "origin", [point("far")], statuses).found, true);
  const changed = { ...statuses, "ZONE-B": "red" as const };
  assert.equal(findSafeRoute(streets, "origin", [point("far")], changed).outcome, "no_route");
  assert.equal(findSafeRoute(streets, "origin", [point("far")], statuses).found, true);
});

test("unknown roads and non-green destinations are unavailable", () => {
  assert.equal(findSafeRoute(streets, "origin", [point("far")], { ...statuses, "ZONE-B": undefined }).outcome, "no_route");
  assert.equal(findSafeRoute(streets, "origin", [point("near")], { ...statuses, "ZONE-B": "amber" }).outcome, "destination_unavailable");
  assert.equal(findSafeRoute(streets, "origin", [point("near")], {}).outcome, "origin_unknown");
});

test("empty destinations and invalid origins have explicit outcomes", () => {
  assert.equal(findSafeRoute(streets, "origin", [], statuses).outcome, "no_destinations");
  assert.equal(findSafeRoute(streets, "missing", [point("near")], statuses).outcome, "invalid_origin");
});

test("already at a destination returns zero distance without fabricating a line", () => {
  const result = findSafeRoute(streets, "origin", [point("origin")], statuses);
  assert.equal(result.found, true);
  assert.equal(result.distance_m, 0);
  assert.equal(result.coordinates.length, 1);
});

test("map pins split a road segment and route between the actual selected positions", () => {
  const destination = { ...point("origin"), position: { segment_index: 0, fraction: 0.75 } };
  const result = findSafeRoute(streets, "origin", [destination], statuses, null, { segment_index: 0, fraction: 0.25 });
  assert.equal(result.found, true);
  assert.deepEqual(result.origin, [101.00025, 3]);
  assert.ok(Math.abs(result.destination![0] - 101.00075) < 1e-10);
  assert.equal(result.destination![1], 3);
  assert.equal(result.distance_m, 56);
  assert.deepEqual(result.coordinates, [result.origin, result.destination]);
});

test("map pin positions are validated and cannot bypass flooded-origin restrictions", () => {
  const position = { segment_index: 0, fraction: 0.5 };
  assert.equal(findSafeRoute(streets, "origin", [point("near")], statuses, null, { ...position, fraction: 2 }).outcome, "invalid_origin");
  assert.equal(findSafeRoute(streets, "origin", [point("near")], { ...statuses, "ZONE-A": "red" }, null, position).outcome, "origin_blocked");
});
