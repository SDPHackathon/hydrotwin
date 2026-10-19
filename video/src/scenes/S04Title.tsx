import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Credits, TownMap } from "../components/TownMap";
import { Rain } from "../components/Rain";
import { Water } from "../components/Water";
import { fontFamily } from "../font";
import { appear, clamp } from "../lib/anim";
import { drawTown } from "../lib/township";
import { C, H, MARGIN, T, sec } from "../tokens";

// Scene 4 — HydroTwin. The water rises over everything once more, then drains
// away and leaves the film on paper: the problem scenes are dark, the product is light.

export const S04_DURATION = sec(15);

const town = drawTown({ x: 990, y: 150, w: 860, h: 780 });

const MODES = [
  { name: "Live", what: "every street's flood risk, now" },
  { name: "Safe Routes", what: "a walk out around flooded roads" },
  { name: "Plan", what: "test a pond or a drain before you build" },
];

export const S04Title: React.FC = () => {
  const f = useCurrentFrame();
  const rise = interpolate(f, [0, sec(1.5)], [H + 40, -40], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drain = interpolate(f, [sec(1.5), sec(4.5)], [-40, H + 40], { ...clamp, easing: Easing.in(Easing.quad) });
  const dry = f >= sec(1.5); // the swap to paper happens while the water covers the frame
  const level = dry ? drain : rise;

  const tilt = interpolate(f, [sec(6), sec(9)], [0, 42], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sensorsIn = appear(f, sec(8.5), 12);

  return (
    <AbsoluteFill style={{ backgroundColor: dry ? C.paper : C.storm, fontFamily }}>
      {dry && (
        <AbsoluteFill style={{ transform: `perspective(1800px) rotateX(${tilt}deg)`, transformOrigin: "1370px 600px" }}>
          <TownMap town={town} line={C.ink} lineOpacity={0.34} buildingFill={C.ink} buildingOpacity={0.07}>
            {town.drains.map((d) => (
              <circle key={d.id} cx={d.p.x} cy={d.p.y} r={8} fill={C.water} stroke={C.paper} strokeWidth={3} opacity={sensorsIn} />
            ))}
          </TownMap>
        </AbsoluteFill>
      )}
      {!dry && <Rain frame={f} level={level} />}
      <Water level={level} frame={f} opacity={dry ? 0.45 : 0.5} />

      <div style={{ position: "absolute", left: MARGIN, top: 240, width: 940, color: C.ink }}>
        <div
          style={{ fontSize: T.display, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, opacity: appear(f, sec(4.6)) }}
        >
          HydroTwin
        </div>
        <div style={{ fontSize: T.caption, lineHeight: 1.25, marginTop: 28, maxWidth: 780, opacity: appear(f, sec(5.4)) }}>
          Warn residents today. Plan a township that floods less tomorrow.
        </div>
        <div style={{ fontSize: 36, lineHeight: 1.3, marginTop: 44, maxWidth: 780, opacity: 0.72 * appear(f, sec(7.5)) }}>
          A digital twin of Bandar Bukit Raja&rsquo;s streets and drains. One map, three modes:
        </div>
        <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "280px 1fr", rowGap: 14 }}>
          {MODES.map((m, i) => (
            <React.Fragment key={m.name}>
              <div style={{ fontSize: 40, fontWeight: 600, opacity: appear(f, sec(9.5 + i * 0.8)) }}>{m.name}</div>
              <div style={{ fontSize: 34, alignSelf: "center", opacity: 0.72 * appear(f, sec(9.5 + i * 0.8)) }}>{m.what}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {dry && (
        <Credits right="Map data © OpenStreetMap contributors" color={C.ink} size={T.credit} opacity={0.6 * appear(f, sec(5))} />
      )}
    </AbsoluteFill>
  );
};
