import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { H, V, W, TY } from "./tokens";
import { SANS, clamp, enter } from "./kit";

// ── Device frames for the real app ──────────────────────────────────────────
// A browser window around a 16:9 laptop recording; `w` is the content width.
export const BrowserFrame: React.FC<{ x: number; y: number; w: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  x,
  y,
  w,
  children,
  style,
}) => {
  const bar = Math.round(w * 0.026);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        borderRadius: 18,
        overflow: "hidden",
        background: V.cream,
        boxShadow: "0 50px 120px rgba(5, 12, 3, 0.55), 0 0 0 1px rgba(245, 241, 221, 0.22)",
        ...style,
      }}
    >
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: bar * 0.3, paddingLeft: bar * 0.6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: bar * 0.32, height: bar * 0.32, borderRadius: 99, background: V.sage }} />
        ))}
        <div style={{ flex: 1, textAlign: "center", marginRight: bar * 2.2, fontFamily: SANS, fontSize: bar * 0.42, fontWeight: 500, color: V.forest, opacity: 0.7 }}>
          HydroTwin
        </div>
      </div>
      <div style={{ position: "relative", width: w, height: (w * 9) / 16, overflow: "hidden", background: "#f4f4f2" }}>{children}</div>
    </div>
  );
};

// A phone around a 390×844 recording; `w` is the screen width.
export const PhoneFrame: React.FC<{ x: number; y: number; w: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  x,
  y,
  w,
  children,
  style,
}) => {
  const k = w / 390;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: 844 * k,
        boxSizing: "content-box",
        padding: 12 * k,
        borderRadius: 58 * k,
        background: "#0c1607",
        boxShadow: "0 50px 110px rgba(5, 12, 3, 0.6), inset 0 0 0 1.5px rgba(245, 241, 221, 0.18)",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: w, height: 844 * k, borderRadius: 46 * k, overflow: "hidden", background: "#f4f4f2" }}>{children}</div>
    </div>
  );
};

// ── Camera: zoom about a point, eased between keys ──────────────────────────
export type Shot = { at: number; s: number; x: number; y: number }; // frame, scale, focus point (px)
export function camAt(keys: Shot[], f: number) {
  const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const at = keys.map((k) => k.at);
  const v = (pick: (k: Shot) => number) => (keys.length === 1 ? pick(keys[0]) : interpolate(f, at, keys.map(pick), ease));
  const cam = { s: v((k) => k.s), x: v((k) => k.x), y: v((k) => k.y) };
  // Where a point of the unzoomed frame lands on screen.
  const project = (p: { x: number; y: number }) => ({ x: cam.x + cam.s * (p.x - cam.x), y: cam.y + cam.s * (p.y - cam.y) });
  return { ...cam, project };
}
export const Camera: React.FC<{ keys: Shot[]; children: React.ReactNode }> = ({ keys, children }) => {
  const { s, x, y } = camAt(keys, useCurrentFrame());
  return (
    <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${x}px, ${y}px) scale(${s}) translate(${-x}px, ${-y}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

// ── Callout: a pill with a leader line to the thing it names ────────────────
export const Callout: React.FC<{
  at: number;
  exitAt?: number;
  x: number; // pill's left edge (or right edge with align "end")
  y: number; // pill's vertical centre
  tx?: number; // target point; no target → no leader line
  ty?: number;
  tone?: string;
  align?: "start" | "end";
  children: React.ReactNode;
}> = ({ at, exitAt, x, y, tx, ty, tone = V.gold, align = "start", children }) => {
  const f = useCurrentFrame();
  const st = enter(f, at, exitAt, 16);
  const draw = interpolate(f, [at + 4, at + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ opacity: st.opacity, pointerEvents: "none" }}>
      {tx !== undefined && ty !== undefined && (
        <svg width={W} height={H} style={{ position: "absolute" }}>
          {/* forest line on a cream edge: reads on the light app and on the dark landscape */}
          <line x1={x} y1={y} x2={x + (tx - x) * draw} y2={y + (ty - y) * draw} stroke={V.cream} strokeWidth={5} strokeLinecap="round" />
          <line x1={x} y1={y} x2={x + (tx - x) * draw} y2={y + (ty - y) * draw} stroke={V.forest} strokeWidth={2} strokeLinecap="round" />
          <circle cx={tx} cy={ty} r={9 * draw} fill={tone} stroke={V.cream} strokeWidth={3} />
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(${align === "end" ? "-100%" : "0"}, -50%) ${st.transform}`,
          filter: st.filter,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 22px 13px 16px",
          borderRadius: 999,
          background: V.cream,
          color: V.forest,
          fontFamily: SANS,
          fontSize: TY.label,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "0 14px 40px rgba(5, 12, 3, 0.35)",
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 99, background: tone }} />
        {children}
      </div>
    </AbsoluteFill>
  );
};

// ── Tap ripple where a recorded tap landed ──────────────────────────────────
export const Ripple: React.FC<{ at: number; x: number; y: number; size?: number }> = ({ at, x, y, size = 64 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (f < at || p >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: 999,
        border: `3px solid ${V.gold}`,
        background: "rgba(215, 196, 120, 0.25)",
        transform: `scale(${0.4 + p * 0.9})`,
        opacity: 1 - p,
      }}
    />
  );
};

// ── Zoom-through: the old scene drifts forward and blurs away, the new one settles in ──
const ZoomThrough: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const e = Easing.inOut(Easing.cubic)(presentationProgress);
  const style: React.CSSProperties =
    presentationDirection === "entering"
      ? { opacity: e, transform: `scale(${0.94 + 0.06 * e})`, filter: `blur(${(1 - e) * 12}px)` }
      : { opacity: 1 - e, transform: `scale(${1 + 0.08 * e})`, filter: `blur(${e * 12}px)` };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

export const zoomThrough = (): TransitionPresentation<Record<string, never>> => ({ component: ZoomThrough, props: {} });
