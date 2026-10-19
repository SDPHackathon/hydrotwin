import React from "react";
import { AbsoluteFill, Freeze, Sequence, useCurrentFrame } from "remotion";
import { Clip, RecCaption, Tag, clipFrames } from "../components/Rec";
import { fontFamily } from "../font";
import { appear } from "../lib/anim";
import { sec } from "../tokens";

// Scene 8 — Safe Routes mid-storm. Recorded from minute 84 at 1×: the route goes to the
// Gamelan assembly point until D08 floods (~minute 91), then switches to Sumazau.
// Marks from public/rec/s08-routes.json: rerouted 5.81, end 8.81.
const HOLD = sec(2.5);
const PLAY = clipFrames(0, 8.8);
const REROUTE = HOLD + sec(5.81);
export const S08_DURATION = HOLD + PLAY + sec(1.5);

export const S08Routes: React.FC = () => {
  const f = useCurrentFrame();
  const after = f >= REROUTE;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Sequence durationInFrames={HOLD}>
        <Freeze frame={0}>
          <Clip src="s08-routes.mp4" from={0} to={8.8} />
        </Freeze>
      </Sequence>
      <Sequence from={HOLD} durationInFrames={PLAY}>
        <Clip src="s08-routes.mp4" from={0} to={8.8} />
      </Sequence>
      {/* Hold the last frame. Freeze takes a scene frame, so freeze the whole clip
          sequence at its final frame rather than freezing inside an offset sequence. */}
      {f >= HOLD + PLAY && (
        <Freeze frame={HOLD + PLAY - 1}>
          <Sequence from={HOLD} durationInFrames={PLAY}>
            <Clip src="s08-routes.mp4" from={0} to={8.8} />
          </Sequence>
        </Freeze>
      )}

      <RecCaption
        opacity={appear(f, after ? REROUTE : 4)}
        note="Safe points here are demo destinations, not verified evacuation sites."
      >
        {after ? "A road floods, and the route changes by itself." : "Residents who can leave get a walking route to the nearest safe point."}
      </RecCaption>
      <Tag text="Simulated storm" />
    </AbsoluteFill>
  );
};
