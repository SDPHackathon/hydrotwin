import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Credits } from "../components/TownMap";
import { Rain } from "../components/Rain";
import { Water, surfaceY } from "../components/Water";
import { fontFamily } from "../font";
import { appear, clamp } from "../lib/anim";
import { C, H, MARGIN, T, W, sec } from "../tokens";

// Scene 2 — the cost. One hero number; the water below it splits in two:
// about half of it was in Selangor.
// Facts: DOSM, Special Report on the Impact of Floods in Malaysia 2021 (RM6.1 billion);
// The Star, 14 Nov 2022 (about half in Selangor — single source, evidence owner to confirm).

export const S02_DURATION = sec(15);

export const S02Cost: React.FC = () => {
  const f = useCurrentFrame();

  // Picks up at scene 1's water line, then settles a little lower to make room.
  const level = interpolate(f, [0, sec(2.5)], [600, 640], { ...clamp, easing: Easing.inOut(Easing.cubic) });

  const splitIn = interpolate(f, [sec(6.5), sec(7.5)], [0, 1], clamp);
  const dividerTop = surfaceY(W / 2, level, f);

  return (
    <AbsoluteFill style={{ backgroundColor: C.storm, fontFamily }}>
      <Rain frame={f} level={level} />
      <Water level={level} frame={f} />

      {/* Selangor's half of the water, a step brighter */}
      <AbsoluteFill style={{ opacity: splitIn }}>
        <svg width={W} height={H}>
          <rect x={0} y={dividerTop} width={W / 2} height={H - dividerTop} fill={C.surface} opacity={0.16} />
          <line x1={W / 2} y1={dividerTop} x2={W / 2} y2={H - 96} stroke={C.surface} strokeWidth={2} strokeDasharray="10 10" />
        </svg>
      </AbsoluteFill>

      {/* The sentence, with the number at its centre */}
      <div style={{ position: "absolute", left: MARGIN, top: 168, color: C.paper }}>
        <div style={{ fontSize: T.caption, opacity: appear(f, sec(0.4)) }}>Floods cost Malaysia</div>
        <div
          style={{
            fontSize: T.display,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            opacity: appear(f, sec(1.2)),
          }}
        >
          RM6.1 billion
        </div>
        <div style={{ fontSize: T.caption, opacity: appear(f, sec(2.2)) }}>in 2021.</div>
      </div>

      {/* Inside the water: the two halves */}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: level + 64,
          color: C.paper,
          fontSize: T.title,
          fontWeight: 600,
          opacity: splitIn,
        }}
      >
        Selangor
      </div>
      <div
        style={{
          position: "absolute",
          left: W / 2 + 56,
          top: level + 72,
          color: C.paper,
          fontSize: T.caption,
          opacity: 0.8 * splitIn,
        }}
      >
        Rest of Malaysia
      </div>

      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 880,
          color: C.paper,
          fontSize: T.caption,
          fontWeight: 500,
          opacity: appear(f, sec(8)),
        }}
      >
        About half of it was in Selangor.
      </div>

      <Credits
        left="Sources: DOSM, Special Report on the Impact of Floods in Malaysia 2021; The Star, 14 Nov 2022"
        color={C.paper}
        size={T.credit}
        opacity={0.72 * appear(f, sec(2.2))}
      />
    </AbsoluteFill>
  );
};
