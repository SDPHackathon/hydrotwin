import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Clip, RecCaption, Tag, clipFrames } from "../components/Rec";
import { fontFamily } from "../font";
import { appear, clamp } from "../lib/anim";
import { sec } from "../tokens";

// Scene 9 — Plan mode: four upgrades, the app's own before/after (142 → 57 flooded streets,
// 52.7 → 12.8 cm, first flood 90 → 107 min), then the same storm replayed with them.
// Marks from public/rec/s09-plan.json: plan 1.08, upgrades 4.4–11.7, replay 14.9, end 46.9.
const REPLAY = 14.9;
const END = 46.8;
const FAST = 4;
const A = clipFrames(0, REPLAY);
const B = clipFrames(REPLAY, END, FAST);
export const S09_DURATION = A + B + sec(1);

// Zoom into the Before vs After panel (top of the sidebar) while the upgrades go in.
const ORIGIN = "1900px 250px";

export const S09Plan: React.FC = () => {
  const f = useCurrentFrame();
  const zoomIn = interpolate(f, [sec(3.2), sec(4.2)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const zoomOut = interpolate(f, [sec(13.6), sec(14.6)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const zoom = 1 + 0.9 * zoomIn * (1 - zoomOut);

  const caption =
    f < sec(4)
      ? { at: 0, text: "Plan mode is for tomorrow." }
      : f < sec(12)
        ? { at: sec(4), text: "Add a retention pond or a bigger drain…" }
        : f < A
          ? { at: sec(12), text: "…and see it at once: 142 flooded streets become 57." }
          : { at: A, text: "Then replay the same storm, before you build." };

  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: "#fff" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: ORIGIN }}>
        <Sequence durationInFrames={A}>
          <Clip src="s09-plan.mp4" from={0} to={REPLAY} />
        </Sequence>
        <Sequence from={A}>
          <Clip src="s09-plan.mp4" from={REPLAY} to={END} rate={FAST} />
        </Sequence>
      </AbsoluteFill>

      <RecCaption opacity={appear(f, caption.at + 4)}>{caption.text}</RecCaption>
      <Tag text={f < A ? "Prototype: rule-based engine" : "Simulated storm, sped up"} />
    </AbsoluteFill>
  );
};
