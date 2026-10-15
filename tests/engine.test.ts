import { test } from "node:test";
import assert from "node:assert/strict";
import { assess } from "../lib/engine/risk.ts";
import { stepLevel } from "../lib/engine/sim.ts";
import { rainAt, STORM_MINUTES } from "../lib/engine/storm.ts";
import type { Drain } from "../lib/engine/types.ts";

const drain: Drain = {
  id: "D01",
  name: "Drain D01",
  lng: 0,
  lat: 0,
  elevation_m: 5,
  bank_cm: 100,
  catchment_factor: 1,
  outflow_cm_per_min: 1,
};

test("green when low and steady", () => {
  const s = assess(drain, [10, 10, 10, 10, 10, 10]);
  assert.equal(s.status, "green");
  assert.equal(s.minutes_to_red, null);
});

test("amber at 70% of the bank", () => {
  assert.equal(assess(drain, [70]).status, "amber");
  assert.equal(assess(drain, [69.9]).status, "green");
});

test("amber early when red is under 30 minutes away", () => {
  // rising 2 cm/min at 50 cm → red in 25 min
  const s = assess(drain, [40, 42, 44, 46, 48, 50]);
  assert.equal(s.status, "amber");
  assert.equal(s.minutes_to_red, 25);
});

test("red at the bank, with street depth", () => {
  const s = assess(drain, [100, 104, 108, 112]);
  assert.equal(s.status, "red");
  assert.equal(s.street_depth_cm, 12);
  assert.equal(s.minutes_to_red, null);
});

test("drain never goes below empty", () => {
  assert.equal(stepLevel(drain, 0.5, 0), 0);
  assert.equal(stepLevel(drain, 10, 3), 12);
});

test("storm is dry before and after", () => {
  assert.equal(rainAt(-1), 0);
  assert.equal(rainAt(STORM_MINUTES), 0);
  assert.ok(rainAt(60) > 0);
});
