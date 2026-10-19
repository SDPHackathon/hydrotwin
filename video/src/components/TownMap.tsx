import React from "react";
import { AbsoluteFill } from "remotion";
import { strokeFor, type Town } from "../lib/township";
import { H, W } from "../tokens";

type Street = Town["streets"][number];

// The town as line work. Colours and draw-in are decided by the scene.
export const TownMap: React.FC<{
  town: Town;
  line: string;
  lineOpacity?: number;
  streetColor?: (st: Street) => string | null; // null → the plain line colour
  streetWidth?: (st: Street) => number;
  draw?: (st: Street) => number; // 0..1 draw-in progress
  buildingFill?: string;
  buildingOpacity?: number;
  transform?: string;
  children?: React.ReactNode; // extra SVG drawn in the same coordinates
}> = ({ town, line, lineOpacity = 1, streetColor, streetWidth, draw, buildingFill, buildingOpacity = 0, transform, children }) => (
  <AbsoluteFill>
    <svg width={W} height={H}>
      <g transform={transform}>
        {buildingOpacity > 0 &&
          town.buildings.map((d, i) => <path key={i} d={d} fill={buildingFill ?? line} opacity={buildingOpacity} />)}
        {town.streets.map((st) => {
          const p = draw ? draw(st) : 1;
          return (
            <path
              key={st.id}
              d={st.d}
              pathLength={1}
              strokeDasharray={p < 1 ? "1 1" : undefined}
              strokeDashoffset={p < 1 ? 1 - p : undefined}
              fill="none"
              stroke={streetColor?.(st) ?? line}
              strokeOpacity={streetColor?.(st) ? 1 : lineOpacity}
              strokeWidth={streetWidth ? streetWidth(st) : strokeFor(st.highway)}
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

// Bottom-of-frame source and licence lines.
export const Credits: React.FC<{ left?: string; right?: string; color: string; opacity: number; size: number }> = ({
  left,
  right,
  color,
  opacity,
  size,
}) => (
  <div
    style={{
      position: "absolute",
      left: 120,
      right: 120,
      bottom: 34,
      display: "flex",
      justifyContent: "space-between",
      gap: 40,
      color,
      fontSize: size,
      opacity,
    }}
  >
    <span>{left}</span>
    <span>{right}</span>
  </div>
);
