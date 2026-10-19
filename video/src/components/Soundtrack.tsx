import React from "react";
import { Html5Audio, Sequence, interpolate, staticFile } from "remotion";
import { clamp } from "../lib/anim";
import { sec } from "../tokens";

// Sound for the whole film (no voice-over): rain under the problem scenes, gone when
// the film turns light. Files in public/audio, licences in docs/third-party.md.
//
// heavy-rain-thunder.mp3 (40 s): thunder crack at 0.75 s (lands on "4 June 2023"),
// rumble at ~7.75 s (the push into Phase 1), steady rain from 9.5 s.
const RAIN = "audio/heavy-rain-thunder.mp3";
const RAIN_LEN = sec(40);
const STEADY_FROM = sec(9.5); // loop only the steady part — no repeated thunder
const XFADE = sec(2);
const FULL = 0.9;
const BED = 0.6;

export const Soundtrack: React.FC<{ lightAt: number }> = ({ lightAt }) => {
  // lightAt = the frame the title scene starts; the rain fades out over its first 2 s.
  const loopAt = RAIN_LEN - XFADE;
  const rainLevel = (t: number) => interpolate(t, [sec(15), sec(17)], [FULL, BED], clamp);
  const fadeOut = (t: number) => interpolate(t, [lightAt, lightAt + sec(2)], [1, 0], clamp);

  return (
    <>
      <Sequence durationInFrames={RAIN_LEN}>
        <Html5Audio
          src={staticFile(RAIN)}
          volume={(f) => rainLevel(f) * interpolate(f, [0, 4, loopAt, RAIN_LEN], [0, 1, 1, 0], clamp) * fadeOut(f)}
        />
      </Sequence>
      <Sequence from={loopAt} durationInFrames={lightAt + sec(2) - loopAt}>
        <Html5Audio
          src={staticFile(RAIN)}
          trimBefore={STEADY_FROM}
          volume={(f) => BED * interpolate(f, [0, XFADE], [0, 1], clamp) * fadeOut(f + loopAt)}
        />
      </Sequence>
    </>
  );
};
