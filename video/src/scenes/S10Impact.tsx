import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../font";
import { appear, clamp } from "../lib/anim";
import { C, MARGIN, T, sec } from "../tokens";

// Scene 10 — feasibility and fit: it runs on what a township already has, and the
// way in is a pilot. The pilot is Phase 1, where the film opened (Jalan Makyong).

export const S10_DURATION = sec(22);

const HAVE = [
  { what: "Guards", how: "on duty, now with a live desk" },
  { what: "Drains", how: "already built, now measured" },
  { what: "Phones", how: "a link to open, no app store" },
];

const STEPS = [
  { what: "Pilot", how: "Phase 1, around Jalan Makyong" },
  { what: "Real sensors", how: "water level in each drain zone" },
  { what: "Every SDP township", how: "one map per township" },
];

const ROAD_Y = 700;
const NODE_X = [MARGIN + 20, 760, 1400];

export const S10Impact: React.FC = () => {
  const f = useCurrentFrame();
  const stepAt = (i: number) => sec(9 + i * 2.4);
  const pipe = interpolate(f, [stepAt(0), stepAt(2)], [NODE_X[0], NODE_X[2]], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily, color: C.ink }}>
      <div style={{ position: "absolute", left: MARGIN, top: 140, fontSize: T.title, fontWeight: 700, opacity: appear(f, sec(0.5)) }}>
        Built on what a township already has.
      </div>

      <div style={{ position: "absolute", left: MARGIN, top: 300, display: "grid", gridTemplateColumns: "repeat(3, 520px)", columnGap: 40 }}>
        {HAVE.map((h, i) => (
          <div key={h.what} style={{ opacity: appear(f, sec(2 + i * 1.2)) }}>
            <div style={{ fontSize: 48, fontWeight: 600 }}>{h.what}</div>
            <div style={{ fontSize: 34, lineHeight: 1.3, marginTop: 8, opacity: 0.72 }}>{h.how}</div>
          </div>
        ))}
      </div>

      {/* The way in: a pipe that fills from pilot to every township */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={NODE_X[0]} y1={ROAD_Y} x2={NODE_X[2]} y2={ROAD_Y} stroke={C.water} strokeOpacity={0.18 * appear(f, stepAt(0))} strokeWidth={10} strokeLinecap="round" />
        <line x1={NODE_X[0]} y1={ROAD_Y} x2={pipe} y2={ROAD_Y} stroke={C.water} strokeWidth={10} strokeLinecap="round" strokeDasharray="6 16" strokeDashoffset={-f * 1.6} />
        {NODE_X.map((x, i) => (
          <circle key={x} cx={x} cy={ROAD_Y} r={16} fill={C.water} stroke={C.paper} strokeWidth={5} opacity={appear(f, stepAt(i))} />
        ))}
      </svg>
      {STEPS.map((s, i) => (
        <div key={s.what} style={{ position: "absolute", left: NODE_X[i] - 20, top: ROAD_Y + 44, width: 560, opacity: appear(f, stepAt(i)) }}>
          <div style={{ fontSize: 26, color: C.water, fontWeight: 600 }}>Step {i + 1}</div>
          <div style={{ fontSize: 44, fontWeight: 600, marginTop: 4 }}>{s.what}</div>
          <div style={{ fontSize: 30, marginTop: 6, opacity: 0.72 }}>{s.how}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
