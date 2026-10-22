import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Backdrop, Out, SANS, Voice, cue, enter, sceneFrames } from "../kit";
import { MARGIN, SERIF, TY, V } from "../tokens";

// Scene 9 — evidence and next steps (deck slide 10). 112 = `npm test` on main, 23 Oct 2026.
const ID = "v09";
export const V09_DURATION = sceneFrames(ID);

const NEXT = [
  { word: "verify", text: "Verify shelters and walking access" },
  { word: "validate", text: "Validate the model with real drain sensors" },
  { word: "pilot", text: "Pilot in one phase of Bukit Raja" },
  { word: "every", text: "Then every Sime Darby Property township" },
];

export const V09Next: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop drift={8} />
      <Out at={V09_DURATION - 16}>
      <div style={{ position: "absolute", left: MARGIN, top: 250, width: 640 }}>
        <div style={{ ...enter(f, 4), fontSize: TY.lead, color: V.gold, fontWeight: 500 }}>A working prototype</div>
        <div style={{ ...enter(f, cue(ID, "112") - 4), fontFamily: SERIF, fontSize: 260, lineHeight: 1, color: V.cream, marginTop: 20, letterSpacing: -4 }}>112</div>
        <div style={{ ...enter(f, cue(ID, "112") + 6), fontSize: TY.lead, color: V.sageLight, marginTop: 10 }}>automated tests, all passing</div>
        <div style={{ ...enter(f, cue(ID, "112") + 14), fontSize: TY.label, color: V.sage, marginTop: 34, lineHeight: 1.45, maxWidth: 520 }}>
          A production build and the full resident-to-guard demo, run on the same engine.
        </div>
      </div>
      <div style={{ position: "absolute", left: 960, top: 250, width: 840 }}>
        <div style={{ ...enter(f, cue(ID, "next") - 2), fontSize: TY.lead, color: V.gold, fontWeight: 500, marginBottom: 36 }}>Next</div>
        {NEXT.map((n, i) => (
          <div
            key={n.word}
            style={{
              ...enter(f, cue(ID, n.word) - 4, undefined, 20),
              display: "flex",
              gap: 26,
              alignItems: "baseline",
              padding: "24px 0",
              borderTop: `1px solid ${V.glassLine}`,
            }}
          >
            <span style={{ fontFamily: SERIF, fontSize: 30, color: V.gold, width: 30 }}>{i + 1}</span>
            <span style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1.18, color: i === NEXT.length - 1 ? V.gold : V.cream }}>{n.text}</span>
          </div>
        ))}
      </div>
      </Out>
      <Voice id={ID} />
    </AbsoluteFill>
  );
};
