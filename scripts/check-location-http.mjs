// LOCAL demo only. --with-test-township adds a clone; use a disposable server for that flag.
// Tested areas finish paused/reset; test help requests finish resolved or cancelled.
import assert from "node:assert/strict";
const base = new URL(process.argv[2] ?? "http://localhost:3000");
if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Local demo URL required");
async function request(path, body, status = 200) {
  const res = await fetch(new URL(path, base), { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  assert.equal(res.status, status, path); return res.json();
}
const route = (area_slug, origin, status = 200) => request("/api/resident/safe-route", { area_slug, origin }, status);
const risk = (slug) => `/api/risk-engine?area=${slug}`;
const touched = [], tokens = [];
try {
  const { areas } = await request("/api/township/shared"); assert.ok(areas.length >= 3);
  if (process.argv.includes("--with-test-township")) {
    const bundle = await request("/api/township/shared?area=bukit-raja");
    bundle.area.slug = `http-check-${Date.now()}`; bundle.area.name = "Temporary HTTP check";
    const shared = await request("/api/township/shared", bundle); assert.equal(shared.shared, true); areas.push(shared.area);
  }
  for (const { slug } of areas) {
    const bundle = await request(`/api/township/shared?area=${slug}`);
    assert.equal((await request("/api/township/shared", bundle)).shared, true);
    const changed = structuredClone(bundle); changed.drains[0].bank_cm += 1;
    await request("/api/township/shared", changed, 400);
    touched.push(slug); await request(`/api/risk-engine/reset?area=${slug}`, {});
    const first = await request(risk(slug));
    assert.deepEqual((await request(risk(slug), { readings: [], running: false })).floodEvidence.observed_at, first.floodEvidence.observed_at);
    const c = await request(`/api/evacuation-destinations?area=${slug}`);
    for (const d of c.destinations) { assert.equal(d.purpose, "demo_refuge"); assert.equal(d.simulation.through_minute, 210); }
    console.log(`${slug}: ${c.destinations.length} simulation-selected road points`);
    if (!c.destinations.length) continue;
    const d = c.destinations[0], origin = { street_id: d.street_id, position: { segment_index: d.position.segment_index, fraction: 0 } };
    const e = await route(slug, origin); assert.equal(e.area_slug, slug); assert.equal(e.route.found, true); assert.equal(e.conditions, "frozen");
    assert.equal(e.catalogue_revision, c.revision); assert.ok(e.route.legs.every((l) => l.status === "green"));
    await route(slug, { ...origin, position: { segment_index: 999999, fraction: 0 } }, 400);
    const drainId = bundle.streets.features.find((s) => s.properties.id === d.street_id).properties.drain_id;
    const other = areas.find((a) => a.slug !== slug).slug, otherBefore = await request(risk(other));
    await request(risk(slug), { readings: [{ drain_id: drainId, level_cm: 9999 }], running: false });
    const blocked = await route(slug, origin); assert.equal(blocked.route.outcome, "origin_blocked"); assert.deepEqual(blocked.route.coordinates, []);
    assert.deepEqual((await request(risk(other))).statuses, otherBefore.statuses, "Drain IDs cannot leak across areas");
    await request(risk(slug), { readings: [], area_slug: other }, 400);
    await request(`/api/risk-engine/reset?area=${slug}`, {});
    const help = await request("/api/resident/location-help", { action: "request", area_slug: slug, origin, help_type: "evacuate", people: 2, note: "Fictional integration check" });
    tokens.push(help.token);
    const readHelp = () => request("/api/resident/location-help", { action: "read", token: help.token });
    await request("/api/resident/location-help", { action: "request", token: help.token, area_slug: slug, origin: { ...origin, position: { ...origin.position, fraction: 0.75 } } }, 400);
    await request("/api/guard-tasks", { taskId: help.task.id, action: "accept", responder: "Demo guard" });
    assert.equal((await readHelp()).task.state, "on_the_way");
    const tasks = await request("/api/guard-tasks"); assert.ok(tasks.guardTasks.some((t) => t.id === help.task.id && t.area_slug === slug));
    assert.equal(JSON.stringify(tasks).includes(help.token), false);
    await request("/api/resident/location-help", { action: "safe", token: help.token }); assert.equal((await readHelp()).task.check_in_state, "safe");
    await request("/api/guard-tasks", { taskId: help.task.id, action: "resolve", outcome: "confirmed_safe" }); assert.equal((await readHelp()).task.outcome, "confirmed_safe");
    const second = await request("/api/resident/location-help", { action: "request", token: help.token, area_slug: slug, origin }); tokens.push(second.token);
    await request("/api/resident/location-help", { action: "cancel", token: second.token });
    assert.equal((await request("/api/resident/location-help", { action: "read", token: second.token })).task.state, "cancelled");
  }
  await route("not-shared", { street_id: "x", position: { segment_index: 0, fraction: 0 } }, 404);
  await request("/api/resident/safe-route", null, 400);
  console.log("Location HTTP checks passed: sharing, isolation, routes, validation, help and guard lifecycle.");
} finally {
  for (const token of tokens) await request("/api/resident/location-help", { action: "cancel", token }).catch(() => {});
  for (const slug of touched) await request(`/api/risk-engine/reset?area=${slug}`, {}).catch(() => {});
}
