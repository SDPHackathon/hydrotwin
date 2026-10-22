import React from "react";
import { useCurrentFrame } from "remotion";
import phones from "../../public/rec/r-phones.json";
import { PhoneFrame, Ripple } from "./frames";
import { Remapped, timeline } from "./remap";
import { SANS, enter } from "./kit";
import { SERIF, V } from "./tokens";

// Shared by the two phone scenes: a recorded phone with its taps, and the step list beside it.
export type Phone = "resident" | "guard";
export const SCREEN = { w: 390, h: 844 }; // CSS px of the recorded phone

export const RecordedPhone: React.FC<{ phone: Phone; tl: ReturnType<typeof timeline>; x: number; y: number; w: number; until: number }> = ({
  phone,
  tl,
  x,
  y,
  w,
  until,
}) => {
  const k = w / SCREEN.w;
  return (
    <PhoneFrame x={x} y={y} w={w}>
      <Remapped src={`r-${phone}.mp4`} tl={tl} style={{ width: w, height: SCREEN.h * k }} />
      {phones.taps
        .filter((t) => t.phone === phone && t.y > 0 && t.y < SCREEN.h - 14)
        .map((t, i) => {
          const at = tl.toScene(t.t);
          return at > 0 && at < until ? <Ripple key={i} at={at} x={t.x * k} y={t.y * k} size={56 * k} /> : null;
        })}
    </PhoneFrame>
  );
};

// A recorded-phone point (CSS px) → screen px, for callouts.
export const onPhone = (x: number, y: number, w: number) => (px: number, py: number) => {
  const k = w / SCREEN.w;
  return { x: x + 12 * k + px * k, y: y + 12 * k + py * k };
};

// The step list: each step arrives on its cue; the current one is bright, past ones dim.
export const Steps: React.FC<{ x: number; y: number; w: number; title: string; steps: { at: number; text: string }[] }> = ({ x, y, w, title, steps }) => {
  const f = useCurrentFrame();
  const current = steps.filter((s) => f >= s.at).length - 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, fontFamily: SANS }}>
      <div style={{ ...enter(f, 0), fontSize: 26, color: V.gold, fontWeight: 500, marginBottom: 30 }}>{title}</div>
      {steps.map((s, i) => {
        const e = enter(f, s.at - 4, undefined, 20);
        return (
        <div
          key={s.text}
          style={{
            ...e,
            display: "flex",
            gap: 22,
            alignItems: "baseline",
            marginBottom: 26,
            opacity: (e.opacity as number) * (i === current ? 1 : 0.42),
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: 99, flex: "none", background: i === current ? V.gold : V.sage, transform: "translateY(-6px)" }} />
          <span style={{ fontFamily: SERIF, fontSize: i === current ? 50 : 40, lineHeight: 1.15, color: V.cream }}>{s.text}</span>
        </div>
        );
      })}
    </div>
  );
};
