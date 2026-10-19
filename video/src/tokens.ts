// Design tokens for the pitch video. Status colours match lib/colors.ts in the app
// and only ever mean a street's flood status — never decoration.
export const C = {
  storm: "#13293D", // problem scenes: the storm
  stormLine: "#4A6F8C", // streets drawn on the storm
  water: "#0284C7", // the app's flood water
  surface: "#7DD3FC", // the water line itself
  paper: "#EEF1EE", // solution scenes: the map paper
  ink: "#1C1917",
  green: "#16A34A",
  amber: "#F59E0B",
  red: "#DC2626",
} as const;

export const W = 1920;
export const H = 1080;
export const FPS = 30;

// Type scale for 1080p (≈ Bringhurst's classic scale × 2.5)
export const T = {
  credit: 22,
  small: 30,
  caption: 48,
  title: 64,
  display: 176,
} as const;

// Left edge of all text: one alignment line for the whole film.
export const MARGIN = 120;

export const sec = (s: number) => Math.round(s * FPS);
