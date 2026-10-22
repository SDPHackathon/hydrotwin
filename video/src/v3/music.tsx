import React from "react";
import { Html5Audio, Sequence, interpolate, staticFile } from "remotion";
import { FPS } from "./tokens";
import { LEAD, clamp } from "./kit";
import { timed } from "./timing";

// Rain under the opening; the music ends with the film (it is shorter than the film, so it
// enters around the title). Both are Pixabay-licensed (docs/third-party.md). The music ducks
// under every voice-over line and comes up in the gaps between them.
const MUSIC = "audio/ambient-cinematic.mp3";
const MUSIC_LEN = 193.2; // s
const RAIN = "audio/heavy-rain-thunder.mp3";
const UNDER_VOICE = 0.11;
const IN_GAPS = 0.3;

export const Music: React.FC<{ start: Record<string, number>; end: number }> = ({ start, end }) => {
  // Voice intervals in film frames: scene i plays line v0(i+1) from LEAD, in pieces around its pauses.
  const spoken = Object.values(start).flatMap((s, i) =>
    timed(`v${String(i + 1).padStart(2, "0")}`).pieces.map((p) => {
      const from = s + Math.round((LEAD + p.at) * FPS);
      return [from, from + Math.round((p.to - p.from) * FPS)] as const;
    }),
  );
  const duck = (filmFrame: number) => {
    // distance (frames) to the nearest voiced stretch → smooth duck
    let d = Infinity;
    for (const [a, b] of spoken) d = Math.min(d, filmFrame < a ? a - filmFrame : filmFrame > b ? filmFrame - b : 0);
    return interpolate(d, [0, 12], [UNDER_VOICE, IN_GAPS], clamp);
  };
  const musicFrom = Math.max(0, end - Math.round(MUSIC_LEN * FPS));
  const rainEnd = start["V03-Title"] ?? 600;
  return (
    <>
      <Html5Audio src={staticFile(RAIN)} volume={(f) => interpolate(f, [0, 20, rainEnd - 60, rainEnd], [0, 0.55, 0.3, 0], clamp)} />
      <Sequence from={musicFrom}>
        <Html5Audio
          src={staticFile(MUSIC)}
          volume={(f) => duck(musicFrom + f) * interpolate(f, [0, 3 * FPS, end - musicFrom - 3 * FPS, end - musicFrom], [0, 1, 1, 0], clamp)}
        />
      </Sequence>
    </>
  );
};
