import React from "react";
import { AbsoluteFill, random } from "remotion";
import { C, H, W } from "../tokens";

// Deterministic rain (seeded per drop, driven by the frame number) that stops
// at the water surface.
export const Rain: React.FC<{ frame: number; level?: number; drops?: number; opacity?: number }> = ({
  frame,
  level = H + 200,
  drops = 150,
  opacity = 1,
}) => {
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < drops; i++) {
    const speed = 40 + random(`speed-${i}`) * 24;
    const len = 36 + random(`len-${i}`) * 60;
    const x0 = -0.1 * W + random(`x-${i}`) * 1.2 * W;
    const cycle = H + 240;
    const y = ((frame * speed + random(`off-${i}`) * cycle) % cycle) - 120;
    if (y > level) continue;
    const slant = 0.16;
    const x = x0 - y * slant;
    lines.push(
      <line
        key={i}
        x1={x}
        y1={y}
        x2={x - len * slant}
        y2={y + Math.min(len, Math.max(0, level - y))}
        stroke={C.paper}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={(0.12 + random(`a-${i}`) * 0.22) * opacity}
      />,
    );
  }
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>{lines}</svg>
    </AbsoluteFill>
  );
};
