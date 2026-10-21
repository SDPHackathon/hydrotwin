import "server-only";
import { createDemoState, type DemoReading } from "@/lib/engine/demo-state";
import type { RouteTownship } from "@/lib/engine/township";
import { getState, processReadings, resetState } from "@/lib/server-state";
const globalStates = globalThis as unknown as { __HYDROTWIN_AREA_STATES__?: Map<string, ReturnType<typeof createDemoState>> };
const states = globalStates.__HYDROTWIN_AREA_STATES__ ??= new Map();
function stateOf(bundle: RouteTownship) {
  if (!states.has(bundle.area.slug)) states.set(bundle.area.slug, createDemoState(bundle.area.slug, bundle.drains, Date.now().toString(36)));
  return states.get(bundle.area.slug)!;
}
export function areaSnapshot(bundle: RouteTownship) {
  return bundle.area.slug === "bukit-raja" ? { ...structuredClone(getState()), area_slug: bundle.area.slug } : stateOf(bundle).snapshot(Date.now());
}
export async function updateArea(bundle: RouteTownship, readings: DemoReading[], playback: { minute?: number; running?: boolean; speed?: number }) {
  if (bundle.area.slug === "bukit-raja") return { ...await processReadings(readings, playback.minute, playback.running, playback.speed), area_slug: bundle.area.slug };
  return stateOf(bundle).update(readings, playback, Date.now());
}
export function resetArea(bundle: RouteTownship) {
  return bundle.area.slug === "bukit-raja" ? { ...resetState(), area_slug: bundle.area.slug } : stateOf(bundle).reset(Date.now());
}
