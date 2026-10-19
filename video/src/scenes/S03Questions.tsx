import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TownMap } from "../components/TownMap";
import { Rain } from "../components/Rain";
import { Water } from "../components/Water";
import { fontFamily } from "../font";
import { appear, clamp } from "../lib/anim";
import { drawTown } from "../lib/township";
import { C, H, MARGIN, T, sec } from "../tokens";

// Scene 3 — three people, three questions nobody can answer in time.
// Pins sit on real places: a home on Jalan Makyong 6, the guard post on Jalan Gamelan 1D
// (lib/guards-data.ts), and empty land at the township's edge.

export const S03_DURATION = sec(25);

const town = drawTown({ x: 760, y: 70, w: 1080, h: 940 });
const centreOf = (pred: (s: (typeof town.streets)[number]) => boolean) => town.streets.find(pred)!.c;

const PEOPLE = [
  { who: "Resident", ask: "Which street floods next? Do we leave now?", at: centreOf((s) => s.name === "Jalan Makyong 6/KU5"), dy: -96, t: sec(4) },
  { who: "Guard", ask: "Who needs help first?", at: centreOf((s) => s.id === "w767416157"), dy: 28, t: sec(10) },
  { who: "Planner", ask: "Will a new phase make it worse?", at: { x: 880, y: 760 }, dy: -40, t: sec(16) },
];

export const S03Questions: React.FC = () => {
  const f = useCurrentFrame();
  const level = interpolate(f, [0, sec(2.5)], [640, H + 40], { ...clamp, easing: Easing.in(Easing.cubic) });
  const mapIn = interpolate(f, [sec(0.4), sec(2.4)], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: C.storm, fontFamily }}>
      <AbsoluteFill style={{ opacity: mapIn }}>
        <TownMap town={town} line={C.stormLine} buildingOpacity={0.32}>
          {PEOPLE.map((p) => {
            const on = appear(f, p.t);
            const pulse = ((f - p.t) % sec(1.6)) / sec(1.6);
            return (
              <g key={p.who} opacity={on}>
                {f > p.t && <circle cx={p.at.x} cy={p.at.y} r={12 + pulse * 30} fill="none" stroke={C.surface} strokeWidth={2} opacity={1 - pulse} />}
                <circle cx={p.at.x} cy={p.at.y} r={11} fill={C.paper} stroke={C.storm} strokeWidth={3} />
              </g>
            );
          })}
        </TownMap>
      </AbsoluteFill>

      <Rain frame={f} level={level} opacity={0.7} />
      <Water level={level} frame={f} />

      {/* Each question next to its person */}
      {PEOPLE.map((p) => (
        <div
          key={p.who}
          style={{
            position: "absolute",
            left: p.at.x + 44,
            top: p.at.y + p.dy,
            maxWidth: 560,
            padding: "16px 24px 18px",
            borderLeft: `4px solid ${C.surface}`,
            background: "rgba(19, 41, 61, 0.9)",
            color: C.paper,
            opacity: appear(f, p.t + 6),
          }}
        >
          <div style={{ fontSize: T.small, color: C.surface }}>{p.who}</div>
          <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.2 }}>{p.ask}</div>
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 180,
          color: C.paper,
          fontSize: T.title,
          fontWeight: 700,
          lineHeight: 1.15,
          opacity: appear(f, sec(1.6)),
        }}
      >
        In a flash flood,
        <br />
        minutes matter.
      </div>
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 880,
          color: C.paper,
          fontSize: T.caption,
          fontWeight: 500,
          opacity: appear(f, sec(21)),
        }}
      >
        Today, each of them is guessing.
      </div>
    </AbsoluteFill>
  );
};
