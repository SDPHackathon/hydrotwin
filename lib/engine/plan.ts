// Plan mode engine: apply civil engineering interventions and replay storms instantly.
// Pure TypeScript — no React, Next or Supabase dependencies (Rule 2 in AGENTS.md).

import { stepLevel } from "./sim.ts";
import { rainAt, STORM_MINUTES } from "./storm.ts";
import type { Drain, PlanIntervention, ScenarioResult } from "./types.ts";

export const INTERVENTION_EFFECTS = {
  bigger_drain: { outflowMult: 1.5, catchmentMult: 1.0 },
  retention_pond: { outflowMult: 1.0, catchmentMult: 0.6 },
  green_area: { outflowMult: 1.0, catchmentMult: 0.8 },
} as const;

export function applyInterventions(drains: Drain[], interventions: PlanIntervention[]): Drain[] {
  const interventionMap = new Map<string, PlanIntervention[]>();
  for (const inv of interventions) {
    const list = interventionMap.get(inv.drain_id) ?? [];
    list.push(inv);
    interventionMap.set(inv.drain_id, list);
  }

  return drains.map((drain) => {
    const invs = interventionMap.get(drain.id);
    if (!invs || invs.length === 0) return drain;

    let catchment = drain.catchment_factor;
    let outflow = drain.outflow_cm_per_min;

    for (const inv of invs) {
      const effect = INTERVENTION_EFFECTS[inv.kind];
      catchment *= effect.catchmentMult;
      outflow *= effect.outflowMult;
    }

    return {
      ...drain,
      catchment_factor: Math.round(catchment * 100) / 100,
      outflow_cm_per_min: Math.round(outflow * 100) / 100,
    };
  });
}

export function replayStorm(
  drains: Drain[],
  streetsCountByDrain?: Record<string, number>,
): ScenarioResult {
  const levels = new Map<string, number>();
  for (const d of drains) levels.set(d.id, 0);

  let minutesToFirstRed: number | null = null;
  let maxDepth = 0;
  const floodedDrains = new Set<string>();

  const totalMinutes = STORM_MINUTES + 30; // 210 minutes

  for (let m = 0; m <= totalMinutes; m++) {
    const rain = rainAt(m);

    for (const drain of drains) {
      const currentLevel = levels.get(drain.id)!;
      const nextLevel = stepLevel(drain, currentLevel, rain);
      levels.set(drain.id, nextLevel);

      if (nextLevel >= drain.bank_cm) {
        floodedDrains.add(drain.id);
        if (minutesToFirstRed === null) {
          minutesToFirstRed = m;
        }
        const depth = nextLevel - drain.bank_cm;
        if (depth > maxDepth) {
          maxDepth = depth;
        }
      }
    }
  }

  let totalFloodedStreets = 0;
  for (const drainId of floodedDrains) {
    totalFloodedStreets += streetsCountByDrain?.[drainId] ?? 1;
  }

  return {
    streets_flooded: totalFloodedStreets,
    deepest_cm: Math.round(maxDepth * 10) / 10,
    minutes_to_first_red: minutesToFirstRed,
    flooded_drain_ids: Array.from(floodedDrains).sort(),
  };
}
