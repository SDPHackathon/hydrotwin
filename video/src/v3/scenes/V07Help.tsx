import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import phones from "../../../public/rec/r-phones.json";
import { Backdrop, SANS, Voice, cue, enter, sceneFrames } from "../kit";
import { Callout } from "../frames";
import { RecordedPhone, Steps, onPhone } from "../phone";
import { timeline } from "../remap";
import { V } from "../tokens";

// Scene 7 — the assistance loop (deck slide 8) on both phones, same take as scene 6: Aina asks
// for help; the guard desk, which already flagged the zone's vulnerable residents, gets the SOS
// with a route around the deepest water; on the way; resolved with an outcome.
const ID = "v07";
export const V07_DURATION = sceneFrames(ID);

const W_ = 390;
const RX = 150;
const GX = 590;
const PY = 70;
const res = onPhone(RX, PY, W_);
const grd = onPhone(GX, PY, W_);

// Both phones share one clock (they were recorded together).
const tl = timeline([
  [0, 31.2],
  [cue(ID, "asks"), 32.7],
  [cue(ID, "needs"), 34.6],
  [cue(ID, "people"), 36.6],
  [cue(ID, "guard"), 38.2],
  [cue(ID, "alarm"), 39.9],
  [cue(ID, "vulnerable"), 40.8],
  // the route opens in the pause after "…in that zone." and stays up through "…the deepest water"
  [cue(ID, "gets") - 30, 42.6],
  [cue(ID, "water"), 48.6],
  [cue(ID, "taps"), 49.9],
  [cue(ID, "sees", 1), 50.3], // the 2nd "sees" ("She sees that help is coming")
  [cue(ID, "cancel"), 51.6],
  // the outcome picker stays open (Evacuated chosen at 55.8, confirmed at 56.7) while "records the outcome" is said
  [cue(ID, "when"), 54.3],
  [cue(ID, "records"), 55.6],
  [cue(ID, "outcome") + 10, 56.5],
  [V07_DURATION, 59.8],
]);

const cancel = res(phones.cancelBox.x + phones.cancelBox.w - 16, phones.cancelBox.y + phones.cancelBox.h / 2);
const flagged = grd(300, 420);
const outcome = grd(110, 407);

export const V07Help: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop dim drift={6} />
      <div style={enter(f, 0, undefined, 50)}>
        <RecordedPhone phone="resident" tl={tl} x={RX} y={PY} w={W_} until={V07_DURATION} />
      </div>
      <div style={enter(f, 6, undefined, 50)}>
        <RecordedPhone phone="guard" tl={tl} x={GX} y={PY} w={W_} until={V07_DURATION} />
      </div>
      <Steps
        x={1110}
        y={170}
        w={720}
        title="Resident and guard, live"
        steps={[
          { at: cue(ID, "asks"), text: "She asks for help" },
          { at: cue(ID, "alarm"), text: "The guard desk is alerted" },
          { at: cue(ID, "route"), text: "A route around deep water" },
          { at: cue(ID, "taps"), text: "On the way; she can cancel" },
          { at: cue(ID, "outcome"), text: "Resolved, outcome recorded" },
        ]}
      />
      <Callout at={cue(ID, "vulnerable")} exitAt={cue(ID, "gets") - 42} x={flagged.x + 70} y={flagged.y + 120} tx={flagged.x} ty={flagged.y} tone={V.amberLit}>
        Flagged automatically
      </Callout>
      <Callout at={cue(ID, "cancel")} exitAt={cue(ID, "when") - 4} x={cancel.x + 120} y={cancel.y + 110} tx={cancel.x} ty={cancel.y} tone={V.gold}>
        Cancel request
      </Callout>
      <Callout at={cue(ID, "records") + 6} exitAt={cue(ID, "outcome") + 12} x={outcome.x + 260} y={outcome.y + 230} tx={outcome.x} ty={outcome.y} tone={V.greenLit}>
        Outcome: Evacuated
      </Callout>
      <Voice id={ID} left={1040} width={840} />
    </AbsoluteFill>
  );
};
