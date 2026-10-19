import test from "node:test";
import assert from "node:assert/strict";
import { isStormPlayback, phoneSyncState, PHONE_SYNC_TIMEOUT_MS, presentStorm, rainAppearance, REPLAY_END_MINUTE } from "../lib/storm-presentation.ts";
import { rainAt, PEAK_MM_PER_MIN } from "../lib/engine/storm.ts";

const local = { minute: 45, running: true, speed: 2 };
const options = { local, phone: null, usePhone: false, phoneSupported: true, sync: "waiting" as const };

test("storm presentation follows the authoritative rain curve without changing engine inputs", () => {
  for (const minute of [0, 1, 44, 45, 99, 100, 125, 149, 150, 180, REPLAY_END_MINUTE]) {
    const result = presentStorm({ ...options, local: { ...local, minute } });
    assert.equal(result.rainMmPerHour, Math.round(rainAt(minute) * 60));
    assert.equal(rainAppearance(result.rainMmPerHour, 10, 900_000).count === 0, rainAt(minute) === 0);
  }
  assert.deepEqual(local, { minute: 45, running: true, speed: 2 });
});

test("ready, start, pause, drainage and completion are distinct", () => {
  const phase = (minute: number, running: boolean) => presentStorm({ ...options, local: { ...local, minute, running } });
  assert.equal(phase(0, false).phase, "ready");
  assert.equal(phase(0, true).phase, "running");
  assert.equal(phase(45, false).phase, "paused");
  assert.equal(phase(150, true).phase, "draining");
  assert.equal(phase(180, false).label, "Demo replay paused · rain ended");
  assert.equal(phase(REPLAY_END_MINUTE, true).phase, "complete");
  assert.equal(phase(REPLAY_END_MINUTE, true).running, false);
});

test("phone uses its own minute and speed, with no local weather fallback", () => {
  const phone = { minute: 125, running: true, speed: 10 };
  const result = presentStorm({ ...options, phone, usePhone: true, sync: "connected" });
  assert.equal(result.rainMmPerHour, 63);
  assert.equal(result.speed, 10);
  assert.equal(result.source, "phone");
  for (const sync of ["waiting", "lost"] as const) {
    const unavailable = presentStorm({ ...options, phone, usePhone: true, sync });
    assert.equal(unavailable.rainMmPerHour, null);
    assert.equal(unavailable.running, false);
    assert.equal(unavailable.phase, sync);
  }
  assert.equal(presentStorm({ ...options, phone, usePhone: true, sync: "connected", phoneSupported: false }).phase, "unavailable");
  assert.equal(presentStorm({ ...options, phone, usePhone: false, sync: "connected" }).source, "local");
});

test("fresh running phone ticks expire, paused and completed snapshots do not", () => {
  assert.equal(phoneSyncState(local, null), "waiting");
  assert.equal(phoneSyncState(local, NaN), "waiting");
  assert.equal(phoneSyncState(local, PHONE_SYNC_TIMEOUT_MS - 1), "connected");
  assert.equal(phoneSyncState(local, PHONE_SYNC_TIMEOUT_MS), "lost");
  assert.equal(phoneSyncState({ ...local, running: false }, 100_000), "connected");
  assert.equal(phoneSyncState({ ...local, minute: REPLAY_END_MINUTE }, 100_000), "connected");
});

test("visual intensity grows and playback accelerates motion without increasing density", () => {
  const light = rainAppearance(10, 1, 900_000);
  const heavy = rainAppearance(PEAK_MM_PER_MIN * 60, 1, 900_000);
  assert.ok(heavy.count > light.count);
  assert.ok(heavy.velocity > light.velocity);
  assert.ok(heavy.length > light.length);
  let previous = 0;
  for (const speed of [1, 2, 4, 5, 10]) {
    const appearance = rainAppearance(126, speed, 900_000);
    assert.equal(appearance.count, heavy.count);
    assert.ok(appearance.velocity > previous);
    assert.ok(appearance.velocity <= heavy.velocity * 2.5);
    previous = appearance.velocity;
  }
  assert.equal(rainAppearance(null, 10, 900_000).count, 0);
  assert.equal(rainAppearance(0, 10, 900_000).count, 0);
  assert.ok(rainAppearance(10000, 1000, 10_000_000).count <= 338);
  assert.ok(rainAppearance(126, 1, 200_000).count < heavy.count);
});

test("invalid cloud playback cannot be interpreted as a running storm", () => {
  for (const value of [null, {}, { ...local, minute: Infinity }, { ...local, speed: 0 }, { ...local, running: "true" }]) {
    assert.equal(isStormPlayback(value), false);
  }
  assert.equal(isStormPlayback(local), true);
});
