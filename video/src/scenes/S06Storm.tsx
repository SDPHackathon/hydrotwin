import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Clip, RecCaption, Tag, clipFrames } from "../components/Rec";
import { fontFamily } from "../font";
import { appear } from "../lib/anim";
import { sec } from "../tokens";

// Scene 6 — the demo storm on the real dashboard (Local Sim, recorded at the app's 4×).
// Marks from public/rec/s06-storm.json (scripts/record/s06-storm.mjs): start 1.58, firstRed 24.48, end 34.48.
const START = 1.58;
const FIRST_RED = 24.48;
const END = 34.4;
const FAST = 1.6; // the quiet green-to-amber part, sped up further in the edit

const A = clipFrames(0, START);
const B = clipFrames(START, FIRST_RED - 0.4, FAST);
const C2 = clipFrames(FIRST_RED - 0.4, END);
export const S06_DURATION = A + B + C2;

export const S06Storm: React.FC = () => {
  const f = useCurrentFrame();
  const redAt = A + B;
  const caption =
    f < redAt ? "A 126 mm/h storm hits the township." : f < redAt + sec(4) ? "Drain zone 8 turns red first." : "Then the water spreads, street by street.";
  const captionAt = f < redAt ? 0 : f < redAt + sec(4) ? redAt : redAt + sec(4);

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Sequence durationInFrames={A}>
        <Clip src="s06-storm.mp4" from={0} to={START} />
      </Sequence>
      <Sequence from={A} durationInFrames={B}>
        <Clip src="s06-storm.mp4" from={START} to={FIRST_RED - 0.4} rate={FAST} />
      </Sequence>
      <Sequence from={A + B} durationInFrames={C2}>
        <Clip src="s06-storm.mp4" from={FIRST_RED - 0.4} to={END} />
      </Sequence>

      <RecCaption opacity={appear(f, captionAt + 4)}>{caption}</RecCaption>
      <Tag text={f < redAt ? "Simulated storm, sped up" : "Simulated storm"} />
    </AbsoluteFill>
  );
};
