// Read-only coverage checks against a running LOCAL demo server. No location/help/status writes.
import assert from "node:assert/strict";
const base = new URL(process.argv[2] ?? "http://localhost:3000");
if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Local demo URL required");
async function request(path, body, status = 200) {
  const res = await fetch(new URL(path, base), { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  assert.equal(res.status, status, path);
  if (path.startsWith("/api/coverage")) assert.equal(res.headers.get("cache-control"), "no-store");
  return res.json();
}
const { areas } = await request("/api/township/shared");
assert.ok(areas.length >= 3);
const broad = await request("/api/coverage?q=Jalan");
assert.ok(broad.matches.length > 0 && broad.matches.length <= 24);
assert.equal(broad.truncated, true); assert.deepEqual(broad.incomplete, []);
for (const area of areas) {
  const source = await request(`/api/township/shared?area=${encodeURIComponent(area.slug)}`);
  const road = source.streets.features.find((s) => s.properties.name && s.geometry.coordinates.some((p) =>
    p[0] >= area.bbox[1] && p[0] <= area.bbox[3] && p[1] >= area.bbox[0] && p[1] <= area.bbox[2]));
  assert.ok(road, area.slug);
  const search = await request(`/api/coverage?q=${encodeURIComponent(road.properties.name)}`);
  const result = search.matches.find((m) => m.area.slug === area.slug);
  assert.ok(result, `${area.slug}: cross-area street result`);
  const { coordinate: p, origin } = result;
  assert.ok(p[0] >= area.bbox[1] && p[0] <= area.bbox[3] && p[1] >= area.bbox[0] && p[1] <= area.bbox[2]);
  const selected = source.streets.features.find((s) => s.properties.id === origin.street_id);
  const { segment_index: i, fraction: t } = origin.position;
  assert.ok(t >= 0 && t <= 1);
  assert.ok(Math.abs(selected.geometry.coordinates[i][0] * (1 - t) + selected.geometry.coordinates[i + 1][0] * t - p[0]) < 1e-9);
  const lookup = await request("/api/coverage", { point: p });
  assert.ok(lookup.matches.some((m) => m.area.slug === area.slug && m.distance_m < 0.01));
  console.log(`${area.slug}: street search, boundary and point lookup pass`);
}
assert.deepEqual((await request("/api/coverage", { point: [0, 0] })).matches, []);
assert.deepEqual((await request("/api/coverage?q=DefinitelyNoSuchFictionalStreet")).matches, []);
await request("/api/coverage?q=x", undefined, 400);
await request("/api/coverage", { point: [181, 3] }, 400);
await request("/api/coverage", { point: ["101", 3] }, 400);
await request("/api/coverage", null, 400);
console.log("Coverage HTTP checks pass; no server state was changed.");
