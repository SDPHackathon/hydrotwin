import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Backdrop, Honest, Out, SANS, Voice, cue, enter, sceneFrames } from "../kit";
import { Callout } from "../frames";
import { RecordedPhone, Steps, onPhone } from "../phone";
import { timeline } from "../remap";
import { V } from "../tokens";

// Scene 6 — the resident (deck slides 7 + 9): she confirms Jalan Gamelan 1F, sees its condition
// and a route to a demo dry point; D08 overflows, her street floods and the walking route is
// withdrawn; the same screens in Bahasa Melayu. One take, scripts/record/r-phones.mjs.
const ID = "v06";
export const V06_DURATION = sceneFrames(ID);

const PX = 300;
const PY = 64;
const PW = 400;
const at = onPhone(PX, PY, PW);

const tl = timeline([
  [0, 0.9],
  [cue(ID, "confirms") + 8, 5.9],
  [cue(ID, "condition"), 7.2],
  [cue(ID, "walking"), 9.2],
  [cue(ID, "when"), 13],
  [cue(ID, "floods"), 23.9],
  [cue(ID, "withdraws") + 20, 25.5],
  [cue(ID, "every") - 4, 28.2],
  [V06_DURATION, 31.2],
]);

export const V06Resident: React.FC = () => {
  const f = useCurrentFrame();
  const status = at(195, 300);
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop dim drift={5} />
      <Out at={V06_DURATION - 16}>
      <div style={enter(f, 0, undefined, 50)}>
        <RecordedPhone phone="resident" tl={tl} x={PX} y={PY} w={PW} until={V06_DURATION} />
      </div>
      <Steps
        x={900}
        y={170}
        w={900}
        title="On a resident's phone"
        steps={[
          { at: cue(ID, "confirms"), text: "Confirm the street" },
          { at: cue(ID, "condition"), text: "See its condition" },
          { at: cue(ID, "walking"), text: "Walk to the nearest dry point" },
          { at: cue(ID, "withdraws"), text: "Flooded: no route through water" },
          { at: cue(ID, "every"), text: "English or Bahasa Melayu" },
        ]}
      />
      <Callout at={cue(ID, "floods")} exitAt={cue(ID, "every") - 8} x={270} y={status.y + 150} tx={status.x - 150} ty={status.y + 10} tone={V.redLit} align="end">
        Street flooded
      </Callout>
      <Honest text="Simulated storm, sped up" style={{ left: 900, top: 96 }} />
      </Out>
      <Voice id={ID} left={880} width={940} />
    </AbsoluteFill>
  );
};
