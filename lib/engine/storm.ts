// Synthetic 3-hour design storm (mm of rain per minute).
// Placeholder until we pick a recorded Klang storm — source + licence go in docs/third-party.md.

export const STORM_MINUTES = 180;
export const PEAK_MM_PER_MIN = 1.8; // ≈108 mm/h, a heavy convective storm

export function rainAt(minute: number): number {
  if (minute < 0 || minute >= 150) return 0;
  if (minute < 45) return PEAK_MM_PER_MIN * (minute / 45); // builds up
  if (minute < 100) return PEAK_MM_PER_MIN; // peak
  return PEAK_MM_PER_MIN * (1 - (minute - 100) / 50); // eases off, dry from minute 150
}
