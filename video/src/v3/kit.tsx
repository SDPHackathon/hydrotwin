import React from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, Sequence, interpolate, random, spring, staticFile, useCurrentFrame } from "remotion";
import { fontFamily as SANS } from "../font";
import { FPS, H, SERIF, TY, V, W, sec } from "./tokens";
import { VOICE } from "./voice";
import { phrases } from "./phrases";
import { timed } from "./timing";

export { SANS };
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── Timing: scenes are cut to the voice ─────────────────────────────────────
export const LEAD = 0.4; // the voice starts this long into its scene (s)
const TAIL = 0.8; // breath after the last word (s)

// A scene lasts its line (with its pauses) plus a breath, never less than `min` seconds.
export const sceneFrames = (id: string, min = 0) => Math.round(Math.max(min, timed(id).duration + LEAD + TAIL) * FPS);

// Frame (from scene start) at which the nth word matching `match` is spoken.
export function cue(id: string, match: string, nth = 0): number {
  const want = match.toLowerCase();
  const hits = timed(id).words.filter((w) => w.word.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "").startsWith(want));
  const w = hits[nth] ?? hits[hits.length - 1];
  if (!w) throw new Error(`cue: "${match}" not in ${id}`);
  return Math.round((w.start + LEAD) * FPS);
}

// ── Motion ──────────────────────────────────────────────────────────────────
// Entrance: a soft spring. Exit: quick fade with a slight shrink and blur.
export const rise = (f: number, at: number) => spring({ frame: f - at, fps: FPS, config: { damping: 200, mass: 0.7 } });
export const fall = (f: number, at: number, len = 10) =>
  interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });

export function enter(f: number, at: number, exitAt?: number, dist = 28): React.CSSProperties {
  const p = rise(f, at);
  const q = exitAt === undefined ? 0 : fall(f, exitAt);
  return {
    opacity: p * (1 - q),
    transform: `translateY(${(1 - p) * dist}px) scale(${1 - 0.03 * q})`,
    filter: `blur(${(1 - p) * 8 + q * 6}px)`,
  };
}

// A scene's foreground leaves just before a crossfade, so two scenes' text never overlaps.
export const Out: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const q = fall(useCurrentFrame(), at, 12);
  return <AbsoluteFill style={{ opacity: 1 - q, transform: `scale(${1 - 0.03 * q})`, filter: `blur(${q * 6}px)` }}>{children}</AbsoluteFill>;
};

// A headline that arrives word by word.
export const Words: React.FC<{ text: string; at: number; exitAt?: number; stagger?: number; style?: React.CSSProperties }> = ({
  text,
  at,
  exitAt,
  stagger = 3,
  style,
}) => {
  const f = useCurrentFrame();
  return (
    <div style={{ fontFamily: SERIF, color: V.cream, ...style }}>
      {text.split(" ").map((w, i) => (
        <span key={i} style={{ display: "inline-block", whiteSpace: "pre", ...enter(f, at + i * stagger, exitAt, 22) }}>
          {w}{" "}
        </span>
      ))}
    </div>
  );
};

// ── The world: a township under storm clouds (the deck's treatment: a soft photo under a forest
// veil, with grain). Motion scenes show it lightly blurred so the houses and clouds read;
// `dim` blurs and darkens it behind the app recordings. It drifts slowly, like moving cloud.
export const Backdrop: React.FC<{ dim?: boolean; drift?: number }> = ({ dim = false, drift = 0 }) => {
  const f = useCurrentFrame();
  const blur = dim ? 12 : 5;
  const veil = dim ? 0.64 : 0.5;
  const s = 1.08 + 0.02 * (drift % 3) + f * 0.00012;
  return (
    <AbsoluteFill style={{ backgroundColor: V.deep, overflow: "hidden" }}>
      <Img
        src={staticFile("v3/backdrop-storm.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: `blur(${blur}px) saturate(0.85)`,
          transform: `scale(${s}) translateX(${-f * 0.03}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(21,39,13,${veil - 0.1}) 0%, rgba(21,39,13,${veil}) 55%, rgba(21,39,13,${Math.min(0.92, veil + 0.18)}) 100%)`,
        }}
      />
      <Grain />
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay" }}>
    <svg width={W} height={H}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width={W} height={H} filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

// ── Rain, in the deck's cream, thin ─────────────────────────────────────────
export const Rain: React.FC<{ opacity?: number; drops?: number }> = ({ opacity = 1, drops = 130 }) => {
  const f = useCurrentFrame();
  const out: React.ReactNode[] = [];
  for (let i = 0; i < drops; i++) {
    const speed = 38 + random(`s${i}`) * 22;
    const len = 30 + random(`l${i}`) * 50;
    const cycle = H + 240;
    const y = ((f * speed + random(`o${i}`) * cycle) % cycle) - 120;
    const x = -0.1 * W + random(`x${i}`) * 1.2 * W - y * 0.14;
    out.push(<line key={i} x1={x} y1={y} x2={x - len * 0.14} y2={y + len} stroke={V.cream} strokeOpacity={0.22 + random(`a${i}`) * 0.2} strokeWidth={1.4} />);
  }
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width={W} height={H}>{out}</svg>
    </AbsoluteFill>
  );
};

// ── Voice + subtitles ───────────────────────────────────────────────────────
// Plays the line from LEAD and shows it as subtitles, a short phrase at a time.
// Silent (subtitles only) until the line is voiced.
export const Voice: React.FC<{ id: string; bottom?: number; left?: number; width?: number; captions?: boolean }> = ({
  id,
  bottom = 64,
  left,
  width,
  captions = true,
}) => {
  const f = useCurrentFrame();
  const { words, pieces } = timed(id);
  const t = f / FPS - LEAD;
  const cues = phrases(words);
  const now = cues.find((c, i) => t >= c[0].start - 0.15 && (t <= c[c.length - 1].end + 0.35 || (cues[i + 1] && t < cues[i + 1][0].start - 0.15)));
  return (
    <>
      {/* the line in pieces, with the scene's pauses between them */}
      {!VOICE[id].estimated &&
        pieces.map((p, k) => (
          <Sequence key={k} from={Math.round((LEAD + p.at) * FPS)} durationInFrames={Math.max(1, Math.round((p.to - p.from) * FPS))} layout="none">
            <Html5Audio src={staticFile(`voice/${id}.mp3`)} trimBefore={Math.round(p.from * FPS)} trimAfter={Math.round(p.to * FPS)} />
          </Sequence>
        ))}
      {captions && now && (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: bottom,
            pointerEvents: "none",
            ...(left !== undefined && { left, width, right: "auto" }),
          }}
        >
          <div
            style={{
              maxWidth: width ?? 1240,
              padding: "14px 30px 16px",
              borderRadius: 18,
              // solid, no backdrop-filter: headless Chrome sometimes painted a blurred pill as an empty square
              background: "rgba(21, 39, 13, 0.86)",
              fontFamily: SANS,
              fontSize: 34,
              lineHeight: 1.32,
              fontWeight: 500,
              color: V.cream,
              textAlign: "center",
            }}
          >
            {now.map((w) => w.word).join(" ")}
          </div>
        </AbsoluteFill>
      )}
    </>
  );
};

// ── Small type pieces ───────────────────────────────────────────────────────
export const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: SANS, fontSize: TY.label, fontWeight: 500, color: V.sage, letterSpacing: 0.2, ...style }}>{children}</div>
);

export const Honest: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div
    style={{
      position: "absolute",
      left: 56,
      top: 48,
      padding: "8px 16px",
      borderRadius: 999,
      background: "rgba(21, 39, 13, 0.78)",
      border: `1px solid ${V.glassLine}`,
      color: V.cream,
      fontFamily: SANS,
      fontSize: TY.small,
      fontWeight: 500,
      ...style,
    }}
  >
    {text}
  </div>
);

export { sec };
