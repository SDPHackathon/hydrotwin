import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { drawTown } from "../../lib/township";
import { Backdrop, SANS, Voice, clamp, cue, enter, sceneFrames } from "../kit";
import { GoldTown } from "../town";
import { MARGIN, SERIF, TY, V } from "../tokens";

// Scene 4 — how it works (deck slides 4 + 5): real map data → simulated storm + the risk
// engine's rules → one status for every street. The street colours are the engine's output
// at minute 100 of the demo storm; the rules are lib/engine/risk.ts (amber at 70% of the
// bank or flooding within 30 min, red at the bank).
const ID = "v04";
export const V04_DURATION = sceneFrames(ID);

const COL = 500; // stage width
const GAP = 110;
const X = [MARGIN, MARGIN + COL + GAP, MARGIN + 2 * (COL + GAP)];
const TOP = 250;
const mini = drawTown({ x: X[0] + 20, y: TOP + 190, w: COL - 40, h: 380 });
const result = drawTown({ x: X[2] + 20, y: TOP + 190, w: COL - 40, h: 380 });

const RULES = [
  { word: "green", tone: V.greenLit, name: "Clear", rule: "below the warning level" },
  { word: "amber", tone: V.amberLit, name: "At risk", rule: "70% full, or floods in 30 min" },
  { word: "red", tone: V.redLit, name: "Flooded", rule: "water at the drain bank" },
];

export const V04HowItWorks: React.FC = () => {
  const f = useCurrentFrame();
  const t1 = cue(ID, "real");
  const t2 = cue(ID, "simulated");
  const t3 = cue(ID, "status");
  const tEngine = cue(ID, "risk");
  // The drain fills while the storm is described.
  const fill = interpolate(f, [t2, tEngine + 40], [0.15, 0.82], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const mix = interpolate(f, [cue(ID, "green") - 6, cue(ID, "red") + 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop drift={3} />

      {/* Which parts are real and which are simulated — said plainly, as in the deck. */}
      <div style={{ ...enter(f, t1), position: "absolute", left: X[0], top: TOP - 92, width: COL, borderTop: `2px solid ${V.gold}`, paddingTop: 14 }}>
        <span style={{ fontSize: TY.label, color: V.gold }}>Real context</span>
      </div>
      <div
        style={{ ...enter(f, t2), position: "absolute", left: X[1], top: TOP - 92, width: 2 * COL + GAP, borderTop: `2px dashed ${V.sage}`, paddingTop: 14 }}
      >
        <span style={{ fontSize: TY.label, color: V.sage }}>Simulated behaviour</span>
      </div>

      {/* 1 · Township data */}
      <div style={{ ...enter(f, t1), position: "absolute", left: X[0], top: TOP, width: COL }}>
        <div style={{ fontFamily: SERIF, fontSize: TY.heading, color: V.cream }}>Township data</div>
        <div style={{ fontSize: TY.label, color: V.sageLight, marginTop: 12, lineHeight: 1.4 }}>
          {"199 streets, buildings and elevation"}
          <br />
          <span style={{ color: V.sage, fontSize: TY.small }}>OpenStreetMap and Open-Meteo</span>
        </div>
      </div>
      <GoldTown town={mini} drawAt={t1} drawLen={50} buildings={0.2} />

      {/* 2 · Simulation + risk engine */}
      <div style={{ ...enter(f, t2), position: "absolute", left: X[1], top: TOP, width: COL }}>
        <div style={{ fontFamily: SERIF, fontSize: TY.heading, color: V.cream }}>Storm and risk engine</div>
        <div style={{ fontSize: TY.label, color: V.sageLight, marginTop: 12 }}>10 drain zones, one rule set</div>
        <div style={{ display: "flex", gap: 30, marginTop: 34, alignItems: "flex-end" }}>
          {/* a drain filling against its bank */}
          <div style={{ position: "relative", width: 96, height: 300, borderRadius: 14, border: `2px solid ${V.sage}`, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${fill * 100}%`, background: fill > 0.7 ? V.amberLit : V.greenLit, opacity: 0.85 }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: "30%", borderTop: `2px dashed ${V.cream}`, opacity: 0.8 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            {RULES.map((r) => (
              <div key={r.word} style={{ ...enter(f, tEngine + 8 + RULES.indexOf(r) * 6), display: "flex", gap: 14, alignItems: "baseline" }}>
                <span style={{ width: 16, height: 16, borderRadius: 99, background: r.tone, flex: "none", transform: "translateY(2px)" }} />
                <div>
                  <div style={{ fontSize: TY.label, color: V.cream, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: TY.small, color: V.sage, lineHeight: 1.3 }}>{r.rule}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3 · Every street gets a status */}
      <div style={{ ...enter(f, t3 - 10), position: "absolute", left: X[2], top: TOP, width: COL }}>
        <div style={{ fontFamily: SERIF, fontSize: TY.heading, color: V.cream }}>A status per street</div>
        <div style={{ fontSize: TY.label, color: V.sageLight, marginTop: 12 }}>Shared by the dashboard and phones</div>
      </div>
      <AbsoluteFill style={{ opacity: interpolate(f, [t3 - 10, t3 + 6], [0, 1], clamp) }}>
        <GoldTown town={result} drawAt={-100} minute={100} statusMix={mix} buildings={0.12} />
      </AbsoluteFill>

      {/* the flow between stages */}
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          {[0, 1].map((i) => {
            const at = i === 0 ? t2 : t3 - 10;
            const p = interpolate(f, [at - 4, at + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const x1 = X[i] + COL + 14;
            const x2 = X[i + 1] - 14;
            return (
              <g key={i} opacity={p}>
                <line x1={x1} y1={TOP + 30} x2={x1 + (x2 - x1) * p} y2={TOP + 30} stroke={V.gold} strokeWidth={2.5} />
                <path d={`M ${x2 - 12} ${TOP + 22} L ${x2} ${TOP + 30} L ${x2 - 12} ${TOP + 38}`} fill="none" stroke={V.gold} strokeWidth={2.5} opacity={p > 0.95 ? 1 : 0} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
      <Voice id={ID} />
    </AbsoluteFill>
  );
};
