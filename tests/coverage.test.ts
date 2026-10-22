import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { coverageLabel, coveredSegments, insideCoverage, locateCoverage, searchCoverage } from "../lib/engine/coverage.ts";
import type { RouteTownship } from "../lib/engine/township.ts";
import type { StreetFeature } from "../lib/engine/route.ts";

const road = (id: string, coordinates: number[][], name: string | null = "Jalan Demo"): StreetFeature => ({
  properties: { id, name, drain_id: "D01", highway: "residential" }, geometry: { type: "LineString", coordinates },
});
const bundle = (slug = "sector-a", roads = [road("w1", [[101, 3.005], [101.01, 3.005]])]): RouteTownship => ({
  area: { slug, name: "Cyberjaya", bbox: [3, 101, 3.01, 101.01], center: [101.005, 3.005], attribution: "Original test data" },
  streets: { type: "FeatureCollection", features: roads }, drains: [],
});

test("unnamed picks use nearby-road context without changing their actual road or anchor", () => {
  const b = bundle("unnamed", [road("w399570486", [[101.004, 3.005], [101.006, 3.005]], null),
    road("w2", [[101.001, 3.006], [101.009, 3.006]], "Jalan Nearby")]);
  const m = locateCoverage([b], [101.005, 3.005])[0];
  assert.equal(m.origin.street_id, "w399570486");
  assert.deepEqual(m.coordinate, [101.005, 3.005]);
  assert.equal(m.road_name, null);
  assert.equal(m.label, "Unnamed road near Jalan Nearby");
  assert.equal(coverageLabel(m, "bm"), "Jalan tanpa nama berhampiran Jalan Nearby");
  assert.equal(searchCoverage([b], "w399570486")[0].label, m.label);
});

test("fallback does not borrow faraway or outside-coverage road names; real names stay intact", () => {
  const b = bundle("fallback", [road("w399570486", [[101.004, 3.002], [101.006, 3.002]], "  "),
    road("w2", [[101.004, 3.009], [101.006, 3.009]], "Far Away"),
    road("w3", [[100.9999, 3.001], [100.9999, 3.003]], "Outside")]);
  const m = locateCoverage([b], [101.005, 3.002])[0];
  assert.equal(m.label, "Unnamed road");
  assert.equal(coverageLabel(m, "bm"), "Jalan tanpa nama");
  const named = locateCoverage([b], [101.005, 3.009])[0];
  assert.equal(named.label, "Far Away");
  assert.equal(coverageLabel(named, "bm"), "Far Away");
});

test("street search spans all shared areas, keeps duplicate names distinct and ignores locality names", () => {
  const a = bundle(), b = bundle("sector-b");
  assert.deepEqual(searchCoverage([b, a], "  jALan ").map((m) => m.area.slug), ["sector-a", "sector-b"]);
  assert.equal(searchCoverage([a, b], "Cyberjaya").length, 0);
  assert.equal(searchCoverage([a], "x").length, 0);
  assert.equal(searchCoverage([a], "x".repeat(121)).length, 0);
  assert.equal(searchCoverage([a], "w1")[0].origin.street_id, "w1");
});

test("complete OSM ways are clipped to the coverage box and preserve original routing fractions", () => {
  const b = bundle("sector", [road("long", [[100.99, 3.005], [101.03, 3.005]])]);
  const segments = coveredSegments(b.streets.features[0], b.area);
  assert.ok(Math.abs(segments[0].start - 0.25) < 1e-9);
  assert.ok(Math.abs(segments[0].end - 0.5) < 1e-9);
  const m = searchCoverage([b], "Demo")[0];
  assert.ok(insideCoverage(b.area, m.coordinate));
  assert.ok(Math.abs(m.origin.position.fraction - 0.375) < 1e-9);
  const picked = locateCoverage([b], [101.005, 3.00501])[0];
  assert.ok(Math.abs(picked.origin.position.fraction - 0.375) < 1e-9);
  assert.ok(picked.distance_m! < 2);
});

test("outside locations never snap into nearby coverage, even when a road extends beyond the box", () => {
  const b = bundle("sector", [road("long", [[100.99, 3.005], [101.03, 3.005]])]);
  assert.deepEqual(locateCoverage([b], [101.01001, 3.005]), []);
  assert.deepEqual(locateCoverage([b], [101.02, 3.005]), []);
  assert.deepEqual(locateCoverage([b], [NaN, 3]), []);
  assert.deepEqual(locateCoverage([b], [181, 3]), []);
});

test("a box without a nearby loaded road is unknown and wholly outside roads never appear in search", () => {
  const b = bundle("sector", [road("outside", [[101.02, 3.005], [101.03, 3.005]]), road("edge", [[101, 3], [101.01, 3]])]);
  assert.deepEqual(searchCoverage([b], "outside"), []);
  assert.deepEqual(locateCoverage([b], [101.005, 3.005]), []);
  assert.equal(locateCoverage([b], [101.005, 3.0001])[0].origin.street_id, "edge");
});

test("overlapping coverages remain separate and nearest-road selection is deterministic", () => {
  const roads = [road("b", [[101, 3.005], [101.01, 3.005]]), road("a", [[101, 3.005], [101.01, 3.005]])];
  const a = bundle("sector-a", roads), b = bundle("sector-b", [...roads].reverse());
  const matches = locateCoverage([b, a], [101.005, 3.005]);
  assert.deepEqual(matches.map((m) => [m.area.slug, m.origin.street_id]), [["sector-a", "a"], ["sector-b", "a"]]);
});

test("clipping handles vertical, horizontal, diagonal, reversed and degenerate segments", () => {
  const b = bundle();
  for (const coords of [
    [[101.005, 2.99], [101.005, 3.02]], [[100.99, 3.005], [101.02, 3.005]],
    [[100.99, 2.99], [101.02, 3.02]], [[101.02, 3.005], [100.99, 3.005]],
  ]) {
    const segments = coveredSegments(road("r", coords), b.area);
    assert.equal(segments.length, 1);
    assert.ok(insideCoverage(b.area, segments[0].a)); assert.ok(insideCoverage(b.area, segments[0].b));
  }
  assert.deepEqual(coveredSegments(road("r", [[101.005, 3.005], [101.005, 3.005]]), b.area), []);
  assert.deepEqual(coveredSegments(road("r", [[100.99, 3.02], [101.02, 3.02]]), b.area), []);
});

test("search anchors from every supplied area stay inside its actual boundary and re-resolve on the same road", () => {
  const root = new URL("../public/data/", import.meta.url);
  const bundles: RouteTownship[] = readdirSync(root).map((slug) => {
    const read = (file: string) => JSON.parse(readFileSync(new URL(`${slug}/${file}`, root), "utf8"));
    return { area: read("area.json"), streets: read("streets.geojson"), drains: read("drains.json") };
  });
  const before = JSON.stringify(bundles);
  for (const b of bundles) {
    const matches = searchCoverage([b], "Jalan");
    assert.ok(matches.length > 0, b.area.slug);
    for (const m of matches) {
      assert.ok(insideCoverage(b.area, m.coordinate), `${b.area.slug}:${m.label}`);
      const street = b.streets.features.find((s) => s.properties.id === m.origin.street_id)!;
      const { segment_index: i, fraction: t } = m.origin.position;
      const a = street.geometry.coordinates[i], c = street.geometry.coordinates[i + 1];
      assert.ok(Math.abs(a[0] + (c[0] - a[0]) * t - m.coordinate[0]) < 1e-9);
      assert.ok(Math.abs(a[1] + (c[1] - a[1]) * t - m.coordinate[1]) < 1e-9);
    }
  }
  assert.equal(JSON.stringify(bundles), before);
});
