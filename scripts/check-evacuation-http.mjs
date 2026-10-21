// Manual integration harness against a running LOCAL fictional demo only.
// Changes simulator readings, then restores paused zero readings; does not clear help tasks.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEMO_RESIDENTS } from "../lib/residents-data.ts";
const base = new URL(process.argv[2] ?? "http://localhost:3000");
if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Local demo URL required");
const drains = JSON.parse(await readFile(new URL("../public/data/bukit-raja/drains.json", import.meta.url), "utf8"));
const get = (path) => fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
async function push(readings, running) {
  const res = await fetch(new URL("/api/risk-engine", base), { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readings, minute: 10, running, speed: 1 }), signal: AbortSignal.timeout(20000) });
  assert.equal(res.status, 200); return res.json();
}
const readings = drains.map((d) => ({ drain_id: d.id, level_cm: 0, source: "sim" }));
const routePath = `/api/resident/safe-route?resident_id=${DEMO_RESIDENTS[0].id}`;
try {
  const first = await push(readings, false);
  const metadata = await push([], false);
  assert.deepEqual(metadata.floodEvidence.observed_at, first.floodEvidence.observed_at, "Metadata alone must not renew readings");
  const catalogue = await get("/api/evacuation-destinations?area=bukit-raja");
  assert.equal(catalogue.status, 200); assert.equal(catalogue.headers.get("cache-control"), "no-store");
  const revision = (await catalogue.json()).revision;
  for (const resident of DEMO_RESIDENTS) {
    const response = await get(`/api/resident/safe-route?resident_id=${resident.id}`);
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
    const envelope = await response.json();
    assert.equal(envelope.route.found, resident.street_id !== "w164812620", resident.display_name);
    if (resident.street_id === "w164812620") assert.equal(envelope.route.outcome, "disconnected");
    assert.equal(envelope.catalogue_revision, revision); assert.equal(envelope.conditions, "frozen");
    assert.equal(envelope.source, "phone_demo"); assert.equal("needs" in envelope, false);
    assert.ok(envelope.route.legs.every((l) => l.status === "green"));
  }
  assert.equal((await get("/api/resident/safe-route")).status, 400);
  assert.equal((await get("/api/resident/safe-route?resident_id=unknown")).status, 404);
  assert.equal((await get("/api/evacuation-destinations?area=..%2F..%2F")).status, 404);
  await push(readings, true);
  assert.equal((await (await get(routePath)).json()).route.found, true);
  await new Promise((resolve) => setTimeout(resolve, 6200));
  const expired = await (await get(routePath)).json();
  assert.equal(expired.conditions, "stale"); assert.equal(expired.route.found, false);
  assert.deepEqual(expired.route.coordinates, []); assert.deepEqual(expired.statuses, {});
  assert.equal((await (await get(routePath)).json()).conditions, "stale", "Successful GET must not renew observations");
  await push([readings[0]], true);
  const partial = await (await get(routePath)).json();
  assert.deepEqual(Object.keys(partial.statuses), [readings[0].drain_id]);
  assert.equal(partial.route.found, false, "A fresh unrelated drain cannot validate the origin");
  console.log("Local HTTP checks passed: shared revision, nine residents, cache/error contracts, metadata-only, controller expiry and partial readings.");
} finally {
  await push(readings, false);
}
