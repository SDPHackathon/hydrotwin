import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Credits, TownMap } from "../components/TownMap";
import { fontFamily } from "../font";
import { appear, clamp } from "../lib/anim";
import { drawTown } from "../lib/township";
import { C, T, sec } from "../tokens";

// Scene 5 — how it works, on paper: drain sensors → risk engine → every street's
// status → alerts. The rules are the engine's own (lib/engine/risk.ts); the street
// colours are the engine's real output at minute 100 of the demo storm
// (scripts/demo-status.ts: first red D08 90, D07 91, D05 97, D06 98, D02 107, D01/D09 112).

export const S05_DURATION = sec(25);

const COL = [120, 560, 1000, 1440];
const COL_W = 380;
const VIS = { y: 170, h: 340 };

const sensorsTown = drawTown({ x: COL[0], y: VIS.y, w: COL_W, h: VIS.h });
const statusTown = drawTown({ x: COL[2], y: VIS.y, w: COL_W, h: VIS.h });

const AT_MINUTE_100: Record<string, "red" | "amber" | "green"> = {
  D08: "red", D07: "red", D05: "red", D06: "red",
  D02: "amber", D01: "amber", D09: "amber",
  D03: "green", D04: "green", D10: "green",
};

const RULES = [
  { status: C.red, name: "Flooding", rule: "Water reaches the drain bank" },
  { status: C.amber, name: "Rising", rule: "Drain 70% full, or flooding within 30 min" },
  { status: C.green, name: "Clear", rule: "Everything else" },
];

const STAGE_AT = [sec(0.6), sec(5), sec(10), sec(15)];

const StageText: React.FC<{ x: number; on: number; title: string; body: string; note?: string }> = ({ x, on, title, body, note }) => (
  <div style={{ position: "absolute", left: x, top: VIS.y + VIS.h + 44, width: COL_W, color: C.ink, opacity: on }}>
    <div style={{ fontSize: 40, fontWeight: 600 }}>{title}</div>
    <div style={{ fontSize: 30, lineHeight: 1.3, marginTop: 8, opacity: 0.75 }}>{body}</div>
    {note && <div style={{ fontSize: 26, marginTop: 10, color: C.water, fontWeight: 500 }}>{note}</div>}
  </div>
);

export const S05HowItWorks: React.FC = () => {
  const f = useCurrentFrame();
  const on = STAGE_AT.map((t) => appear(f, t, 10));

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily }}>
      {/* Pipes between stages: water flowing left to right */}
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          {[1, 2, 3].map((i) => {
            const x1 = COL[i - 1] + COL_W + 8;
            const x2 = COL[i] - 8;
            const y = VIS.y + VIS.h / 2;
            const grow = interpolate(f, [STAGE_AT[i] - 12, STAGE_AT[i]], [0, 1], clamp);
            return (
              <g key={i} opacity={grow}>
                <line x1={x1} y1={y} x2={x1 + (x2 - x1) * grow} y2={y} stroke={C.water} strokeWidth={8} strokeLinecap="round" opacity={0.25} />
                <line
                  x1={x1}
                  y1={y}
                  x2={x1 + (x2 - x1) * grow}
                  y2={y}
                  stroke={C.water}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray="6 16"
                  strokeDashoffset={-f * 1.6}
                />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* 1 · Drain sensors with rising gauges */}
      <AbsoluteFill style={{ opacity: on[0] }}>
        <TownMap town={sensorsTown} line={C.ink} lineOpacity={0.2} streetWidth={() => 1.2}>
          {sensorsTown.drains.map((d) => {
            const fill = 34 * interpolate(f - STAGE_AT[0], [0, sec(9)], [0.05, Math.min(1, 0.62 * d.catchment)], clamp);
            return (
              <g key={d.id}>
                <rect x={d.p.x + 10} y={d.p.y - 30} width={8} height={34} fill="none" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1.5} />
                <rect x={d.p.x + 10} y={d.p.y + 4 - fill} width={8} height={fill} fill={C.water} />
                <circle cx={d.p.x} cy={d.p.y} r={7} fill={C.water} stroke={C.paper} strokeWidth={2.5} />
              </g>
            );
          })}
        </TownMap>
      </AbsoluteFill>
      <StageText x={COL[0]} on={on[0]} title="Drain sensors" body="Water level in 10 drain zones" note="Simulated in this prototype" />

      {/* 2 · Risk engine: the rules, word for word */}
      <div style={{ position: "absolute", left: COL[1], top: VIS.y, width: COL_W, opacity: on[1] }}>
        {RULES.map((r) => (
          <div key={r.name} style={{ display: "grid", gridTemplateColumns: "32px 1fr", marginBottom: 18, color: C.ink }}>
            <span style={{ width: 18, height: 18, borderRadius: 9, background: r.status, marginTop: 10 }} />
            <div>
              <div style={{ fontSize: 32, fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 24, lineHeight: 1.3, opacity: 0.75 }}>{r.rule}</div>
            </div>
          </div>
        ))}
      </div>
      <StageText x={COL[1]} on={on[1]} title="Risk engine" body="Simple rules, not a hydraulic model" />

      {/* 3 · Every street's status — the engine's real output */}
      <AbsoluteFill style={{ opacity: on[2] }}>
        <TownMap
          town={statusTown}
          line={C.ink}
          streetWidth={() => 2.2}
          streetColor={(st) => {
            const s = AT_MINUTE_100[st.drain];
            return s === "red" ? C.red : s === "amber" ? C.amber : s === "green" ? C.green : null;
          }}
        />
      </AbsoluteFill>
      <StageText x={COL[2]} on={on[2]} title="Street status" body="Every street, and the minutes until it floods" note="Demo storm, minute 100" />

      {/* 4 · Alerts: resident's phone + guard desk */}
      <div style={{ position: "absolute", left: COL[3], top: VIS.y, width: COL_W, height: VIS.h, opacity: on[3], color: C.ink }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 196,
            height: 340,
            border: `3px solid ${C.ink}`,
            borderRadius: 30,
            padding: "40px 18px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: 18, opacity: 0.7 }}>Your street</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: C.amber }} />
            <span style={{ fontSize: 30, fontWeight: 700 }}>Rising</span>
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.3, marginTop: 10 }}>20 min until water reaches the street</div>
          <div
            style={{
              marginTop: 22,
              fontSize: 18,
              fontWeight: 600,
              textAlign: "center",
              padding: "10px 0",
              borderRadius: 10,
              background: C.ink,
              color: C.paper,
            }}
          >
            I need help
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 216,
            top: 150,
            width: 164,
            padding: "14px 16px",
            border: `2px solid ${C.ink}`,
            borderRadius: 12,
            boxSizing: "border-box",
            opacity: appear(f, STAGE_AT[3] + sec(1.2)),
          }}
        >
          <div style={{ fontSize: 16, opacity: 0.7 }}>Guard desk</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>Help request</div>
          <div style={{ fontSize: 16, marginTop: 4 }}>2 people</div>
        </div>
      </div>
      <StageText x={COL[3]} on={on[3]} title="Alerts" body="to residents on the street and to the guard desk" />

      <div
        style={{
          position: "absolute",
          left: COL[0],
          top: 900,
          color: C.ink,
          fontSize: T.caption,
          fontWeight: 500,
          opacity: appear(f, sec(19)),
        }}
      >
        From a drain sensor to a resident&rsquo;s phone, one street at a time.
      </div>
      <Credits
        left="Prototype: drain sensors are simulated; water is a per-street depth, not a hydraulic model."
        right="Map data © OpenStreetMap contributors"
        color={C.ink}
        size={T.credit}
        opacity={0.6 * appear(f, sec(1))}
      />
    </AbsoluteFill>
  );
};
