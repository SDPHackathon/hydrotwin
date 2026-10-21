import { test } from "node:test";
import assert from "node:assert/strict";
import { googleMapsWalkingUrl } from "../lib/evacuation/google-maps.ts";

test("Google Maps handoff keeps the exact road anchors, reverses GeoJSON coordinate order and requests walking", () => {
  const href = googleMapsWalkingUrl({ found: true, origin: [101.671185, 2.918885], destination: [101.674321, 2.921234] });
  assert.ok(href);
  const url = new URL(href);
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.pathname, "/maps/dir/");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    api: "1", origin: "2.918885,101.671185", destination: "2.921234,101.674321", travelmode: "walking",
  });
  // Zero-valued coordinates are valid; they must not silently become device-location defaults.
  assert.equal(new URL(googleMapsWalkingUrl({ found: true, origin: [0, 0], destination: [-1, -2] })!).searchParams.get("origin"), "0,0");
});

test("withdrawn, missing or invalid routes cannot produce an external directions link", () => {
  assert.equal(googleMapsWalkingUrl(null), null);
  assert.equal(googleMapsWalkingUrl(undefined), null);
  assert.equal(googleMapsWalkingUrl({ found: false, origin: [101, 3], destination: [101.01, 3.01] }), null);
  assert.equal(googleMapsWalkingUrl({ found: true, origin: null, destination: [101, 3] }), null);
  for (const point of [[NaN, 3], [101, Infinity], [181, 3], [101, 91]] as [number, number][]) {
    assert.equal(googleMapsWalkingUrl({ found: true, origin: point, destination: [101, 3] }), null);
    assert.equal(googleMapsWalkingUrl({ found: true, origin: [101, 3], destination: point }), null);
  }
});
