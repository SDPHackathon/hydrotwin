import React from "react";
import { OffthreadVideo, staticFile } from "remotion";
import { C, FPS } from "../tokens";

// A slice [from, to] (seconds) of a screen recording in public/rec, played at `rate`.
export const Clip: React.FC<{ src: string; from: number; to: number; rate?: number; style?: React.CSSProperties }> = ({
  src,
  from,
  to,
  rate = 1,
  style,
}) => (
  <OffthreadVideo
    src={staticFile(`rec/${src}`)}
    trimBefore={Math.round(from * FPS)}
    trimAfter={Math.round(to * FPS)}
    playbackRate={rate}
    muted
    style={style}
  />
);

// How many composition frames a slice lasts at that rate.
export const clipFrames = (from: number, to: number, rate = 1) => Math.round(((to - from) / rate) * FPS);

// Caption over a recording: on paper, top-left, clear of the map attribution at the bottom.
export const RecCaption: React.FC<{ opacity: number; note?: string; children: React.ReactNode }> = ({ opacity, note, children }) => (
  <div
    style={{
      position: "absolute",
      left: 72,
      top: 56,
      maxWidth: 860,
      padding: "22px 30px 24px",
      background: "rgba(238, 241, 238, 0.96)",
      borderLeft: `6px solid ${C.water}`,
      color: C.ink,
      opacity,
    }}
  >
    <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.2 }}>{children}</div>
    {note && <div style={{ fontSize: 24, marginTop: 10, opacity: 0.7 }}>{note}</div>}
  </div>
);

// Honest label for anything simulated or sped up.
export const Tag: React.FC<{ text: string; opacity?: number }> = ({ text, opacity = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: 72,
      bottom: 56,
      padding: "8px 16px",
      borderRadius: 6,
      background: C.ink,
      color: C.paper,
      fontSize: 24,
      fontWeight: 500,
      opacity,
    }}
  >
    {text}
  </div>
);
