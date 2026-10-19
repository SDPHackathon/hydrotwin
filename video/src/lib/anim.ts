import { interpolate } from "remotion";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The film's one text entrance: a short opacity cut, no slide.
export const appear = (f: number, at: number, len = 8) => interpolate(f, [at, at + len], [0, 1], clamp);
