// Risk engine: drain level history → status. The ONLY place status rules live.
// Rules (docs/data-contracts.md#status-rules):
//   red   — level at or above the bank (water on the street)
//   amber — level ≥ 70% of the bank, OR rising fast enough to reach red within 30 min
//   green — otherwise

import type { Drain, DrainStatus, Status } from "./types.ts";

export const AMBER_RATIO = 0.7;
export const EARLY_WARNING_MIN = 30;
const RATE_WINDOW = 5; // minutes averaged for the rise rate

/** history = level_cm per simulated minute, oldest first, newest last. */
export function assess(drain: Drain, history: number[]): DrainStatus {
  const level = history.at(-1) ?? 0;
  const span = Math.min(RATE_WINDOW, history.length - 1);
  const rate = span > 0 ? (level - history[history.length - 1 - span]) / span : 0;

  const minutesToRed = level < drain.bank_cm && rate > 0 ? Math.ceil((drain.bank_cm - level) / rate) : null;

  let status: Status = "green";
  if (level >= drain.bank_cm) status = "red";
  else if (level >= drain.bank_cm * AMBER_RATIO) status = "amber";
  else if (minutesToRed !== null && minutesToRed <= EARLY_WARNING_MIN) status = "amber";

  return {
    drain_id: drain.id,
    level_cm: round1(level),
    status,
    rate_cm_per_min: round1(rate),
    minutes_to_red: minutesToRed,
    street_depth_cm: round1(Math.max(0, level - drain.bank_cm)),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
