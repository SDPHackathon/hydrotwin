// Drain simulator: one tick = one simulated minute.
// Deliberately simple (fill − drain-out), not hydraulics — the pitch states this.
// Plan mode changes the same two numbers: a bigger drain raises outflow_cm_per_min,
// a retention pond or green area lowers catchment_factor.

import type { Drain } from "./types.ts";

export function stepLevel(drain: Drain, level_cm: number, rain_mm: number): number {
  const inflow = rain_mm * drain.catchment_factor;
  return Math.max(0, level_cm + inflow - drain.outflow_cm_per_min);
}
