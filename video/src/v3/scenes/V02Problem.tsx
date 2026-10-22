import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Backdrop, SANS, Voice, Words, cue, enter, sceneFrames } from "../kit";
import { MARGIN, SERIF, TY, V } from "../tokens";

// Scene 2 — the problem (deck slide 2): a map alone doesn't say what to do next.
// Three moments in time, three people, three questions.
const ID = "v02";
export const V02_DURATION = sceneFrames(ID);

const MOMENTS = [
  { word: "planners", when: "Before development", who: "Planners", ask: "How does a new phase change the same storm?" },
  { word: "residents", when: "During flooding", who: "Residents", ask: "Is my street safe, and where do I go?" },
  { word: "guards", when: "When help is needed", who: "Guards", ask: "Who needs help first, and where?" },
];

export const V02Problem: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Backdrop drift={1} />
      <div style={{ position: "absolute", left: MARGIN, top: 150, width: 1000 }}>
        <Words text="A map alone can't tell anyone what to do next." at={cue(ID, "map") - 6} style={{ fontSize: TY.title, lineHeight: 1.12 }} />
      </div>
      <div style={{ position: "absolute", left: MARGIN, right: MARGIN, top: 470, display: "flex", gap: 36 }}>
        {MOMENTS.map((m) => (
          <div
            key={m.who}
            style={{
              ...enter(f, cue(ID, m.word) - 4, undefined, 40),
              flex: 1,
              padding: "34px 36px 40px",
              borderRadius: 22,
              background: V.glass, // the landscape behind is already blurred; no backdrop-filter (unreliable headless)
              border: `1px solid ${V.glassLine}`,
              borderTop: `3px solid ${V.gold}`,
            }}
          >
            <div style={{ fontSize: TY.label, color: V.gold, fontWeight: 500 }}>{m.when}</div>
            <div style={{ fontFamily: SERIF, fontSize: 56, color: V.cream, marginTop: 18 }}>{m.who}</div>
            <div style={{ fontSize: TY.lead, lineHeight: 1.35, color: V.sageLight, marginTop: 16, opacity: 0.92 }}>{m.ask}</div>
          </div>
        ))}
      </div>
      <Voice id={ID} />
    </AbsoluteFill>
  );
};
