import React from "react";
import { Freeze, Sequence } from "remotion";
import { Clip } from "../components/Rec";
import { FPS } from "./tokens";

// Lines a screen recording up with the voice: anchors say "at scene frame F, the recording
// should be at second S". Between anchors the clip plays at whatever rate fits, kept within
// [MIN_RATE, MAX_RATE]; slower than that, it plays at 1× and holds its last frame.
export type Anchor = [frame: number, clipSecond: number];
const MIN_RATE = 0.6;
const MAX_RATE = 6; // only storm stretches get near this, and those are labelled "sped up"

type Seg = { at: number; frames: number; from: number; to: number; rate: number; hold?: number };

export function timeline(anchors: Anchor[]) {
  const segs: Seg[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [f1, s1] = anchors[i];
    const [f2, s2] = anchors[i + 1];
    const frames = f2 - f1;
    if (frames <= 0) continue;
    if (s2 <= s1) {
      segs.push({ at: f1, frames, from: s1, to: s1 + 0.04, rate: 1, hold: s1 });
      continue;
    }
    const rate = (s2 - s1) / (frames / FPS);
    if (rate >= MIN_RATE) {
      const r = Math.min(MAX_RATE, rate);
      segs.push({ at: f1, frames, from: s1, to: s1 + (frames / FPS) * r, rate: r });
    } else {
      const play = Math.round((s2 - s1) * FPS);
      segs.push({ at: f1, frames: play, from: s1, to: s2, rate: 1 });
      segs.push({ at: f1 + play, frames: frames - play, from: s2, to: s2 + 0.04, rate: 1, hold: s2 });
    }
  }
  // Scene frame at which the recording reaches second s (for tap ripples and callouts).
  const toScene = (s: number) => {
    for (const g of segs) {
      const span = g.hold !== undefined ? 0 : g.to - g.from;
      if (g.hold === undefined && s >= g.from && s <= g.from + span) return Math.round(g.at + ((s - g.from) / g.rate) * FPS);
    }
    return s < (segs[0]?.from ?? 0) ? 0 : (segs[segs.length - 1]?.at ?? 0) + (segs[segs.length - 1]?.frames ?? 0);
  };
  return { segs, toScene };
}

export const Remapped: React.FC<{ src: string; tl: ReturnType<typeof timeline>; style?: React.CSSProperties }> = ({ src, tl, style }) => (
  <>
    {tl.segs.map((g, i) => (
      <Sequence key={i} from={g.at} durationInFrames={Math.max(1, g.frames)} layout="none">
        {g.hold !== undefined ? (
          <Freeze frame={0}>
            <Clip src={src} from={g.hold} to={g.hold + 0.5} style={style} />
          </Freeze>
        ) : (
          <Clip src={src} from={g.from} to={g.to + 0.5} rate={g.rate} style={style} />
        )}
      </Sequence>
    ))}
  </>
);
