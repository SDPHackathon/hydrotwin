import { test } from "node:test";
import assert from "node:assert/strict";
import { boundaryError, DEVELOPMENT_MODEL, developmentError, evaluateDevelopment, newDevelopment, parseDevelopments, siteAreaHa, estimatedZoneAreaHa, suggestDevelopmentConnections, type DevelopmentDraft, type DevelopmentRoad } from "../lib/engine/development.ts";
import { replayStorm } from "../lib/engine/plan.ts";
import type { Drain } from "../lib/engine/types.ts";

const drain: Drain = { id: "D01", name: "Test", lng: 101, lat: 3, elevation_m: 5, bank_cm: 100, catchment_factor: 1.4, outflow_cm_per_min: 1 };
const drains = [drain, { ...drain, id: "D02", bank_cm: 200 }];
const roads: DevelopmentRoad[] = [
  { properties: { id: "a", drain_id: "D01" }, geometry: { type: "LineString", coordinates: [[101, 3], [101.004, 3]] } },
  { properties: { id: "b", drain_id: "D01" }, geometry: { type: "LineString", coordinates: [[101, 3.004], [101.004, 3.004]] } },
  { properties: { id: "c", drain_id: "D02" }, geometry: { type: "LineString", coordinates: [[101.01, 3], [101.01, 3.004]] } },
];
const draft: DevelopmentDraft = { ...newDevelopment("D01"), access_street_id: "a", boundary: [[101, 3], [101.002, 3], [101.002, 3.002], [101, 3.002]] };

test("site area is approximately 4.94 ha and independent of winding", () => {
  assert.ok(Math.abs(siteAreaHa(draft.boundary) - 4.94) < 0.02);
  assert.ok(Math.abs(siteAreaHa([...draft.boundary].reverse()) - siteAreaHa(draft.boundary)) < 0.001);
});
test("reject incomplete, crossed, duplicate, collinear and invalid site boundaries", () => {
  assert.ok(boundaryError([]));
  assert.ok(boundaryError([draft.boundary[0], draft.boundary[2], draft.boundary[1], draft.boundary[3]]));
  assert.ok(boundaryError([...draft.boundary, draft.boundary[0]]));
  assert.ok(boundaryError([[101, 3], [101.001, 3], [101.002, 3]]));
  assert.ok(boundaryError([[NaN, 3], ...draft.boundary]));
});
test("validate cover, access road, receiving zone and township extent", () => {
  for (const patch of [{ existing_paved_pct: -1 }, { proposed_paved_pct: 101 }, { access_street_id: "missing" }, { drain_id: "missing" }]) {
    assert.ok(developmentError({ ...draft, ...patch }, drains, roads));
    assert.throws(() => evaluateDevelopment({ ...draft, ...patch }, drains, roads));
  }
  assert.ok(developmentError(draft, drains, roads, [0, 0, 1, 1]));
});
test("unchanged land cover reproduces baseline; no mitigation reproduces proposed", () => {
  const result = evaluateDevelopment({ ...draft, proposed_paved_pct: draft.existing_paved_pct }, drains, roads);
  assert.equal(result.inflow_multiplier, 1);
  assert.deepEqual(result.stages.existing, result.stages.proposed);
  assert.deepEqual(result.stages.proposed, result.stages.mitigated);
  const baseline = replayStorm([drain], { D01: 2 });
  assert.equal(result.stages.existing.deepest_cm, baseline.deepest_cm);
  assert.equal(result.stages.existing.minutes_to_first_red, baseline.minutes_to_first_red);
  assert.equal(result.stages.existing.streets_flooded, baseline.streets_flooded);
});
test("more paving increases receiving-zone inflow and leaves other zones unchanged", () => {
  const before = JSON.stringify(drains);
  const result = evaluateDevelopment(draft, drains, roads);
  assert.ok(result.inflow_multiplier > 1);
  assert.ok(result.stages.proposed.deepest_cm >= result.stages.existing.deepest_cm);
  assert.deepEqual(result.stages.proposed.peak_statuses.D02, result.stages.existing.peak_statuses.D02);
  assert.equal(JSON.stringify(drains), before);
});
test("site fraction scales effect and restoring permeable cover reduces it", () => {
  const small = evaluateDevelopment({ ...draft, boundary: [[101, 3], [101.001, 3], [101.001, 3.001], [101, 3.001]] }, drains, roads);
  const large = evaluateDevelopment(draft, drains, roads);
  assert.ok(large.inflow_multiplier > small.inflow_multiplier);
  assert.ok(evaluateDevelopment({ ...draft, proposed_paved_pct: 0 }, drains, roads).inflow_multiplier < 1);
});
test("both mitigation choices reduce peak depth; green space is not a second multiplier", () => {
  for (const mitigation of ["bigger_drain", "retention_pond"] as const) {
    const result = evaluateDevelopment({ ...draft, mitigation }, drains, roads);
    assert.ok(result.stages.mitigated.deepest_cm <= result.stages.proposed.deepest_cm);
  }
  assert.ok(developmentError({ ...draft, mitigation: "green_area" as DevelopmentDraft["mitigation"] }, drains, roads));
});
test("access is evaluated using the selected road's zone", () => {
  const result = evaluateDevelopment({ ...draft, access_street_id: "c" }, drains, roads);
  assert.equal(result.stages.proposed.access_flooded, result.stages.proposed.peak_statuses.D02.status === "red");
  assert.equal(result.stages.proposed.access_flooded, result.stages.existing.access_flooded);
});
test("saved proposal parser rejects corrupt data and incompatible versions", () => {
  assert.deepEqual(parseDevelopments("bad json"), []);
  assert.deepEqual(parseDevelopments('{}'), []);
  const saved = { id: "test", created_at: "2026-10-18", model: DEVELOPMENT_MODEL, draft, results: evaluateDevelopment(draft, drains, roads) };
  assert.deepEqual(parseDevelopments(JSON.stringify([saved])), [saved]);
  assert.deepEqual(parseDevelopments(JSON.stringify([{ ...saved, model: "future" }, { ...saved, draft: { ...draft, boundary: [null] } }])), []);
  assert.equal(parseDevelopments(JSON.stringify([{ ...saved, model: "development-v1", draft: { ...draft, catchment_ha: 100 } }]))[0].model, DEVELOPMENT_MODEL);
});

test("suggest nearest road segment and reuse its Live zone; invalid drawings have no suggestion", () => {
  assert.deepEqual(suggestDevelopmentConnections(draft.boundary, roads, drains), { drain_id: "D01", access_street_id: "a" });
  const moved = draft.boundary.map(([x, y]) => [x + 0.01, y] as [number, number]);
  assert.deepEqual(suggestDevelopmentConnections(moved, roads, drains), { drain_id: "D02", access_street_id: "c" });
  assert.equal(suggestDevelopmentConnections([], roads, drains), null);
  assert.equal(suggestDevelopmentConnections(draft.boundary, roads, []), null);
  assert.deepEqual(suggestDevelopmentConnections(draft.boundary, [...roads].reverse(), drains), suggestDevelopmentConnections(draft.boundary, roads, drains));
});
test("zone footprint follows mapped street extent and missing geometry fails clearly", () => {
  assert.ok(estimatedZoneAreaHa("D01", roads) > estimatedZoneAreaHa("D02", roads));
  assert.equal(estimatedZoneAreaHa("missing", roads), 0);
  assert.ok(developmentError(draft, drains, roads.map(r => ({ ...r, geometry: { type: "LineString", coordinates: [] } }))));
  const huge = { ...draft, boundary: [[101, 3], [101.1, 3], [101.1, 3.1], [101, 3.1]] as [number, number][] };
  const result = evaluateDevelopment(huge, drains, roads);
  assert.ok(Math.abs(result.inflow_multiplier - (0.2 + 0.7 * 0.6) / (0.2 + 0.7 * 0.1)) < 1e-10);
});
