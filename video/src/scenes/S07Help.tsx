import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Clip } from "../components/Rec";
import { Credits } from "../components/TownMap";
import { fontFamily } from "../font";
import { appear } from "../lib/anim";
import { C, MARGIN, T, sec } from "../tokens";

// Scene 7 — the help loop on two phones, recorded side by side from the prototype.
// Marks from public/rec/s07-help.json (scripts/record/s07-help.mjs).
const STEPS = [
  { at: 3.7, text: "Tan Wei Ming’s street floods." },
  { at: 7.5, text: "One tap asks for help: what kind, how many people." },
  { at: 12.4, text: "Guard Rahim gets it instantly." },
  { at: 17.0, text: "With a route around the deepest water." }, // route opened 14.98; its map paints ~2 s later
  { at: 24.4, text: "The resident sees who’s coming." },
  { at: 28.5, text: "Resolved, on both phones." },
];

export const S07_DURATION = sec(32.2);

const SCALE = 1.1;
const PW = 390 * SCALE;
const PH = 844 * SCALE;

const Phone: React.FC<{ src: string; x: number; label: string }> = ({ src, x, label }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: x,
        top: 58,
        width: PW,
        height: PH,
        border: `12px solid ${C.ink}`,
        borderRadius: 56,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <Clip src={src} from={0} to={32.2} style={{ width: PW, height: PH }} />
    </div>
    <div style={{ position: "absolute", left: x, top: 58 + PH + 34, width: PW + 24, textAlign: "center", fontSize: 26, color: C.ink, opacity: 0.7 }}>
      {label}
    </div>
  </>
);

export const S07Help: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const current = STEPS.filter((s) => t >= s.at).length - 1;

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily }}>
      <div style={{ position: "absolute", left: MARGIN, top: 200, width: 760 }}>
        {STEPS.map((s, i) => (
          <div
            key={s.at}
            style={{
              fontSize: i === current ? 48 : 36,
              fontWeight: i === current ? 700 : 500,
              lineHeight: 1.2,
              color: C.ink,
              marginBottom: 26,
              opacity: (i === current ? 1 : 0.38) * appear(f, sec(s.at)),
            }}
          >
            {s.text}
          </div>
        ))}
      </div>
      <Phone src="s07-resident.mp4" x={1000} label="Resident phone" />
      <Phone src="s07-guard.mp4" x={1462} label="Guard phone" />
      <Credits
        left="Recorded from the working prototype. Residents and guards are fictional."
        color={C.ink}
        size={T.credit}
        opacity={0.6}
      />
    </AbsoluteFill>
  );
};
