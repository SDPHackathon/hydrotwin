import { test } from "node:test";
import assert from "node:assert/strict";
import { applyInterventions, replayStorm } from "../lib/engine/plan.ts";
import type { Drain, PlanIntervention } from "../lib/engine/types.ts";

const sampleDrain: Drain = {
  id: "D08",
  name: "Drain D08",
  lng: 101.4328,
  lat: 3.0818,
  elevation_m: 4,
  bank_cm: 120,
  catchment_factor: 1.54,
  outflow_cm_per_min: 1.2,
};

test("applyInterventions modifies parameters correctly", () => {
  const interventions: PlanIntervention[] = [
    { drain_id: "D08", kind: "retention_pond" },
  ];
  const upgraded = applyInterventions([sampleDrain], interventions);
  // 1.54 * 0.6 = 0.924 -> 0.92
  assert.equal(upgraded[0].catchment_factor, 0.92);
  assert.equal(upgraded[0].outflow_cm_per_min, 1.2);

  const culvertFix: PlanIntervention[] = [
    { drain_id: "D08", kind: "bigger_drain" },
  ];
  const upgradedCulvert = applyInterventions([sampleDrain], culvertFix);
  // 1.2 * 1.5 = 1.8
  assert.equal(upgradedCulvert[0].outflow_cm_per_min, 1.8);
  assert.equal(upgradedCulvert[0].catchment_factor, 1.54);
});

test("replayStorm baseline causes overflow on low-lying drain", () => {
  const result = replayStorm([sampleDrain], { D08: 14 });
  assert.ok(result.streets_flooded > 0);
  assert.ok(result.deepest_cm > 0);
  assert.ok(result.minutes_to_first_red !== null);
  assert.deepEqual(result.flooded_drain_ids, ["D08"]);
});

test("retention pond intervention significantly reduces flood depth", () => {
  const baseline = replayStorm([sampleDrain], { D08: 14 });

  const upgraded = applyInterventions([sampleDrain], [
    { drain_id: "D08", kind: "retention_pond" },
  ]);
  const planned = replayStorm(upgraded, { D08: 14 });

  // Retention pond must reduce deepest flood depth
  assert.ok(planned.deepest_cm < baseline.deepest_cm);
  // If still flooding, it should be delayed
  if (planned.minutes_to_first_red !== null && baseline.minutes_to_first_red !== null) {
    assert.ok(planned.minutes_to_first_red >= baseline.minutes_to_first_red);
  }
});
