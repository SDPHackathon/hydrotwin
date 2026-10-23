import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { drawTown } from "../../lib/township";
import { Backdrop, Out, SANS, Voice, clamp, cue, enter, sceneFrames } from "../kit";
import { GoldTown } from "../town";
import { MARGIN, SERIF, TY, V } from "../tokens";

// Scene 3 — HydroTwin (deck slides 1 + 3): one shared picture of the township for the
// dashboard, residents' phones and the guard desk.
const ID = "v03";
export const V03_DURATION = sceneFrames(ID);

const BOX = { x: 900, y: 110, w: 900, h: 860 };
const town = drawTown(BOX);
const hub = { x: BOX.x + BOX.w * 0.52, y: BOX.y + BOX.h * 0.5 };
const SEATS = [
  { word: "dashboard", text: "Dashboard", x: 1180, y: 150 },
  { word: "phones", text: "Residents' phones", x: 1360, y: 850 },
  { word: "guard", text: "Guard desk", x: 930, y: 640 },
];

export const V03Title: React.FC = () => {
  const f = useCurrentFrame();
  const settle = interpolate(f, [0, 90], [1.06, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop drift={2} />
      <Out at={V03_DURATION - 16}>
      <AbsoluteFill style={{ opacity: interpolate(f, [0, 24], [0, 0.95], clamp), transform: `scale(${settle})` }}>
        <GoldTown town={town} drawAt={-200} buildings={0.14} />
      </AbsoluteFill>

      {/* the organiser's mark (Sime Darby Property), unaltered */}
      <Img src={staticFile("v3/sdp-logo.png")} style={{ ...enter(f, 8), position: "absolute", left: MARGIN, top: 90, height: 84 }} />
      <div style={{ position: "absolute", left: MARGIN, top: 360, width: 760 }}>
        <div style={{ ...enter(f, 4), fontFamily: SERIF, fontSize: 150, lineHeight: 1, color: V.cream, letterSpacing: -1 }}>HydroTwin</div>
        <div style={{ ...enter(f, 14), marginTop: 30, fontFamily: SERIF, fontSize: 46, lineHeight: 1.22, color: V.sageLight }}>
          Township flood simulation and coordinated response
        </div>
      </div>

      {/* One shared picture: every seat links to the same town. */}
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          {SEATS.map((s) => {
            const at = cue(ID, s.word);
            const p = interpolate(f, [at, at + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const cx = s.x + 10;
            return (
              <g key={s.word} opacity={p}>
                <line x1={cx} y1={s.y} x2={cx + (hub.x - cx) * p} y2={s.y + (hub.y - s.y) * p} stroke={V.cream} strokeWidth={2} strokeDasharray="6 8" />
              </g>
            );
          })}
          <circle cx={hub.x} cy={hub.y} r={interpolate(f, [cue(ID, "dashboard"), cue(ID, "dashboard") + 12], [0, 12], clamp)} fill={V.gold} stroke={V.cream} strokeWidth={3} />
        </svg>
      </AbsoluteFill>
      {SEATS.map((s) => (
        <div
          key={s.text}
          style={{
            ...enter(f, cue(ID, s.word) - 2, undefined, 14),
            position: "absolute",
            left: s.x,
            top: s.y,
            transform: `translateY(-50%) ${enter(f, cue(ID, s.word) - 2, undefined, 14).transform}`,
            padding: "12px 24px 13px",
            borderRadius: 999,
            background: V.cream,
            color: V.forest,
            fontSize: TY.label,
            fontWeight: 600,
            boxShadow: "0 14px 40px rgba(5, 12, 3, 0.35)",
          }}
        >
          {s.text}
        </div>
      ))}
      </Out>
      <Voice id={ID} />
    </AbsoluteFill>
  );
};
