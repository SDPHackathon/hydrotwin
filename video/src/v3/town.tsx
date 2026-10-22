import React from "react";
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { strokeFor, type Town } from "../lib/township";
import { H, V, W } from "./tokens";
import { clamp } from "./kit";

// When each drain zone first turns amber / red in the demo storm — the engine's own output
// (lib/engine), printed by `node scripts/demo-status.ts` (re-run 23 Oct 2026, unchanged).
const AMBER_AT: Record<string, number> = { D08: 60, D07: 61, D05: 67, D06: 68, D02: 76, D01: 80, D09: 80, D03: 114, D04: 114 };
const RED_AT: Record<string, number> = { D08: 90, D07: 91, D05: 97, D06: 98, D02: 107, D01: 112, D09: 112 };

export type Status = "green" | "amber" | "red";
export const statusAt = (drain: string, minute: number): Status =>
  minute >= (RED_AT[drain] ?? Infinity) ? "red" : minute >= (AMBER_AT[drain] ?? Infinity) ? "amber" : "green";
const LIT: Record<Status, string> = { green: V.greenLit, amber: V.amberLit, red: V.redLit };

// Bukit Raja as gold line work. It draws itself in from the centre; given a storm minute,
// each street takes its drain zone's status colour (blended in by `statusMix`).
export const GoldTown: React.FC<{
  town: Town;
  drawAt?: number; // frame the draw-in starts
  drawLen?: number; // frames for the whole town to draw
  minute?: number;
  statusMix?: number;
  buildings?: number; // building fill opacity
  focus?: (st: Town["streets"][number]) => boolean; // streets drawn heavier
  transform?: string;
  children?: React.ReactNode;
}> = ({ town, drawAt = 0, drawLen = 60, minute, statusMix = 0, buildings = 0.18, focus, transform, children }) => {
  const f = useCurrentFrame();
  const cx = W / 2;
  const cy = H / 2;
  const far = Math.max(...town.streets.map((s) => Math.hypot(s.c.x - cx, s.c.y - cy)));
  const bIn = interpolate(f, [drawAt + drawLen * 0.4, drawAt + drawLen], [0, buildings], clamp);
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <g transform={transform}>
          {bIn > 0 && town.buildings.map((d, i) => <path key={i} d={d} fill={V.gold} opacity={bIn} />)}
          {town.streets.map((st) => {
            const start = drawAt + (Math.hypot(st.c.x - cx, st.c.y - cy) / far) * drawLen * 0.7;
            const p = interpolate(f, [start, start + drawLen * 0.3], [0, 1], clamp);
            const color =
              minute === undefined || statusMix <= 0 ? V.gold : interpolateColors(statusMix, [0, 1], [V.gold, LIT[statusAt(st.drain, minute)]]);
            const heavy = focus?.(st);
            return (
              <path
                key={st.id}
                d={st.d}
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - p}
                fill="none"
                stroke={color}
                strokeOpacity={heavy ? 1 : 0.88}
                strokeWidth={(heavy ? 2.4 : 1) * strokeFor(st.highway)}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {children}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
