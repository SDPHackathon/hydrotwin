import { test } from "node:test";
import assert from "node:assert/strict";
import { findSafeRoute, type StreetFeature } from "../lib/engine/route.ts";

test("findSafeRoute connects start to destination on clear streets", () => {
  const streets: StreetFeature[] = [
    {
      properties: { id: "w1", name: "Road A", drain_id: "D01", highway: "residential" },
      geometry: { type: "LineString", coordinates: [[101.43, 3.08], [101.44, 3.08]] },
    },
    {
      properties: { id: "w2", name: "Road B", drain_id: "D01", highway: "residential" },
      geometry: { type: "LineString", coordinates: [[101.44, 3.08], [101.45, 3.08]] },
    },
  ];

  const result = findSafeRoute(
    streets,
    [101.43, 3.08],
    [101.45, 3.08],
    "High Ground Shelter",
    new Set(),
  );

  assert.equal(result.found, true);
  assert.ok(result.coordinates.length >= 2);
  assert.ok(result.distance_m > 0);
});

test("findSafeRoute fails or detours when flooded street is blocked", () => {
  const streets: StreetFeature[] = [
    {
      properties: { id: "w1", name: "Direct Flooded Road", drain_id: "D08", highway: "residential" },
      geometry: { type: "LineString", coordinates: [[101.43, 3.08], [101.45, 3.08]] },
    },
  ];

  const result = findSafeRoute(
    streets,
    [101.43, 3.08],
    [101.45, 3.08],
    "High Ground Shelter",
    new Set(["D08"]), // D08 is flooded!
  );

  assert.equal(result.found, false);
  assert.equal(result.coordinates.length, 0);
  assert.equal(result.blocked_streets_avoided, 1);
});
