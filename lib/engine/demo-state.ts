import { assess } from "./risk.ts";
import type { Drain, DrainStatus } from "./types.ts";
import type { FloodEvidence } from "./evacuation.ts";
export interface DemoReading { drain_id: string; level_cm: number; source?: "sim" | "device" }
export interface DemoSnapshot {
  area_slug: string; serverNow: number; minute: number; running: boolean; speed: number;
  statuses: Record<string, DrainStatus>; floodEvidence: FloodEvidence; stormAgeMs: number | null;
}
export function createDemoState(area: string, drains: Drain[], epoch: string) {
  const histories = Object.fromEntries(drains.map((d) => [d.id, [0]]));
  const statuses = Object.fromEntries(drains.map((d) => [d.id, assess(d, [0])]));
  const observed: Record<string, number> = {};
  let minute = 0, running = false, speed = 1, controller: number | null = null, revision = 0;
  const snapshot = (now: number): DemoSnapshot => ({ area_slug: area, serverNow: now, minute, running, speed,
    statuses: structuredClone(statuses), stormAgeMs: controller === null ? null : Math.max(0, now - controller),
    floodEvidence: { source: "phone_demo", revision: `${area}:${epoch}:${revision}`, observed_at: { ...observed }, controller_at: controller, minute, running } });
  const update = (readings: DemoReading[], playback: { minute?: number; running?: boolean; speed?: number }, now: number) => {
    if (playback.minute !== undefined || playback.running !== undefined || playback.speed !== undefined) controller = now;
    minute = playback.minute ?? minute; running = playback.running ?? running; speed = playback.speed ?? speed;
    for (const r of readings) {
      const drain = drains.find((d) => d.id === r.drain_id);
      if (!drain) continue;
      const history = histories[r.drain_id];
      history.push(r.level_cm); if (history.length > 30) history.shift();
      statuses[r.drain_id] = assess(drain, history);
      if (r.source !== "device") observed[r.drain_id] = now; else delete observed[r.drain_id];
    }
    revision++;
    return snapshot(now);
  };
  return { snapshot, update, reset(now: number) {
    for (const d of drains) { histories[d.id] = [0]; statuses[d.id] = assess(d, [0]); observed[d.id] = now; }
    minute = 0; running = false; speed = 1; controller = now; revision++;
    return snapshot(now);
  } };
}
