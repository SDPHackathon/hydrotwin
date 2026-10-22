import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import plan from "../../../public/rec/r-plan.json";
import { Backdrop, Out, SANS, Voice, cue, enter, sceneFrames } from "../kit";
import { BrowserFrame, Callout, Camera, Ripple, camAt } from "../frames";
import { Remapped, timeline } from "../remap";
import { V } from "../tokens";

// Scene 8 — Plan mode (deck slide 6): bigger drains at D05 + D06 take the replayed storm from
// 142 to 83 flooded streets (the deck's number); ponds at D08 + D07 take it to 57. Values as the
// app showed them in the recording (scripts/record/r-plan.mjs).
const ID = "v08";
export const V08_DURATION = sceneFrames(ID);

const FW = 1440;
const K = FW / 1920;
const FX = (1920 - FW) / 2;
const FY = 70;
const BAR = Math.round(FW * 0.026);
const at = (x: number, y: number) => ({ x: FX + x * K, y: FY + BAR + y * K });
const IMPACT = at(1417, 168); // the Before vs After panel (camera focus)
const NUMBER = at(1366, 190); // its flooded-streets value (callout target)
const PANEL = at(1726, 590);

const tl = timeline([
  [0, 0.5],
  [cue(ID, "plan"), 1.3],
  [cue(ID, "make"), 3.8],
  [cue(ID, "replay"), 9.6],
  [cue(ID, "142"), 10.4],
  [cue(ID, "add"), 11.6],
  [cue(ID, "falls"), 19],
  [cue(ID, "all"), 21.5],
  [V08_DURATION, 31],
]);

export const V08Plan: React.FC = () => {
  const f = useCurrentFrame();
  const keys = [
    { at: 0, s: 1, x: 960, y: 520 },
    { at: cue(ID, "make") - 10, s: 1, x: 960, y: 520 },
    { at: cue(ID, "make") + 14, s: 1.5, x: PANEL.x - 60, y: PANEL.y },
    { at: cue(ID, "replay") - 6, s: 1.5, x: PANEL.x - 60, y: PANEL.y },
    { at: cue(ID, "142"), s: 1.7, x: IMPACT.x, y: IMPACT.y + 60 },
    { at: cue(ID, "add"), s: 1.7, x: IMPACT.x, y: IMPACT.y + 60 },
    { at: cue(ID, "add") + 20, s: 1.5, x: PANEL.x - 60, y: PANEL.y },
    { at: cue(ID, "falls") - 12, s: 1.5, x: PANEL.x - 60, y: PANEL.y },
    { at: cue(ID, "falls") + 8, s: 1.7, x: IMPACT.x, y: IMPACT.y + 60 },
    { at: cue(ID, "all") + 6, s: 1.7, x: IMPACT.x, y: IMPACT.y + 60 },
    { at: cue(ID, "all") + 34, s: 1, x: 960, y: 520 },
  ];
  const cam = camAt(keys, f);
  const impact = cam.project(NUMBER);
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop dim drift={7} />
      <Out at={V08_DURATION - 16}>
      <Camera keys={keys}>
        <div style={enter(f, 0, undefined, 40)}>
          <BrowserFrame x={FX} y={FY} w={FW}>
            <Remapped src="r-plan.mp4" tl={tl} style={{ width: FW, height: (FW * 9) / 16 }} />
            {plan.clicks.map((c, i) => {
              const t = tl.toScene(c.t);
              return t > 0 && t < V08_DURATION ? <Ripple key={i} at={t} x={c.x * K} y={c.y * K} size={44} /> : null;
            })}
          </BrowserFrame>
        </div>
      </Camera>
      <Callout at={cue(ID, "83") - 2} exitAt={cue(ID, "add") + 4} x={impact.x - 160} y={impact.y + 230} tx={impact.x} ty={impact.y} tone={V.greenLit} align="end">
        Bigger drains: 142 to 83 flooded streets
      </Callout>
      <Callout at={cue(ID, "57") - 2} exitAt={cue(ID, "all") + 24} x={impact.x - 160} y={impact.y + 230} tx={impact.x} ty={impact.y} tone={V.greenLit} align="end">
        Plus two ponds: 57
      </Callout>
      </Out>
      <Voice id={ID} />
    </AbsoluteFill>
  );
};
