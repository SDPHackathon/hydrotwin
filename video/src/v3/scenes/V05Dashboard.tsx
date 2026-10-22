import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import dash from "../../../public/rec/r-dashboard.json";
import { Backdrop, Honest, SANS, Voice, cue, enter, sceneFrames } from "../kit";
import { BrowserFrame, Callout, Camera, camAt } from "../frames";
import { Remapped, timeline } from "../remap";
import { V } from "../tokens";

// Scene 5 — the live dashboard (deck slide 5), recorded from the production build at the
// app's 4× playback (scripts/record/r-dashboard.mjs): D08 floods first, then the spread.
const ID = "v05";
export const V05_DURATION = sceneFrames(ID);

const FW = 1440; // browser content width
const K = FW / 1920; // recording → screen
const FX = (1920 - FW) / 2;
const FY = 70;
const BAR = Math.round(FW * 0.026);
const at = (x: number, y: number) => ({ x: FX + x * K, y: FY + BAR + y * K }); // recording px → screen px
const D08 = at(267, 662);
const FLOODED = at(1430, 140);

const tl = timeline([
  [0, 12],
  [cue(ID, "floods") - 6, dash.firstFlood - 0.2],
  [cue(ID, "spreads"), 27],
  [cue(ID, "counts"), 30.4],
  [V05_DURATION, 33.5],
]);

export const V05Dashboard: React.FC = () => {
  const f = useCurrentFrame();
  const tDrain = cue(ID, "drain");
  const tCounts = cue(ID, "counts");
  const keys = [
    { at: 0, s: 1, x: 960, y: 520 },
    { at: tDrain - 8, s: 1, x: 960, y: 520 },
    { at: tDrain + 22, s: 1.45, x: D08.x + 120, y: D08.y - 40 },
    { at: tCounts - 18, s: 1.12, x: 960, y: 520 },
    { at: tCounts + 14, s: 1.4, x: FLOODED.x, y: FLOODED.y + 120 },
  ];
  const cam = camAt(keys, f);
  const d08 = cam.project(D08);
  const flooded = cam.project(FLOODED);
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop dim drift={4} />
      <Camera keys={keys}>
        <div style={enter(f, 0, undefined, 40)}>
          <BrowserFrame x={FX} y={FY} w={FW}>
            <Remapped src="r-dashboard.mp4" tl={tl} style={{ width: FW, height: (FW * 9) / 16 }} />
          </BrowserFrame>
        </div>
      </Camera>
      <Honest text="Simulated storm, sped up" />
      <Callout at={cue(ID, "floods") - 2} exitAt={tCounts - 20} x={d08.x + 150} y={d08.y + 170} tx={d08.x} ty={d08.y} tone={V.redLit}>
        Drain zone 8 floods first
      </Callout>
      <Callout at={tCounts + 10} x={flooded.x - 560} y={flooded.y + 300} tx={flooded.x - 40} ty={flooded.y + 30} tone={V.redLit}>
        Flooded streets, counted live
      </Callout>
      <Voice id={ID} />
    </AbsoluteFill>
  );
};
