import React from "react";
import { AbsoluteFill } from "remotion";
import { C, H, W } from "../tokens";

// The film's one recurring device: a water surface at screen height `level`.
// Two slow sine waves keep it alive without drawing attention.
export function surfaceY(x: number, level: number, frame: number) {
  return level + 6 * Math.sin(x * 0.006 + frame * 0.08) + 3 * Math.sin(x * 0.017 - frame * 0.05);
}

function surfacePath(level: number, frame: number) {
  const pts: string[] = [];
  for (let x = -20; x <= W + 20; x += 24) {
    pts.push(`${pts.length ? "L" : "M"}${x} ${surfaceY(x, level, frame).toFixed(1)}`);
  }
  return pts.join("");
}

export const Water: React.FC<{ level: number; frame: number; opacity?: number }> = ({
  level,
  frame,
  opacity = 0.5,
}) => {
  const top = surfacePath(level, frame);
  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path d={`${top}L${W + 20} ${H + 20}L-20 ${H + 20}Z`} fill={C.water} opacity={opacity} />
        <path d={top} fill="none" stroke={C.surface} strokeWidth={3} />
      </svg>
    </AbsoluteFill>
  );
};

// Renders the same content twice: as `above` colour over the water, `below`
// colour under it — so the water line cuts through type.
export const WaterCut: React.FC<{
  level: number;
  render: (color: string) => React.ReactNode;
  above: string;
  below: string;
}> = ({ level, render, above, below }) => {
  const cut = Math.max(0, Math.min(H, level));
  return (
    <>
      <AbsoluteFill style={{ clipPath: `inset(0 0 ${H - cut}px 0)` }}>{render(above)}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(${cut}px 0 0 0)` }}>{render(below)}</AbsoluteFill>
    </>
  );
};
