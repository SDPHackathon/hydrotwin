import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../font";
import { Rain } from "../components/Rain";
import { Water, WaterCut, surfaceY } from "../components/Water";
import { boundsOf, centroid, fitProjector, pathD } from "../lib/geo";
import { buildings, streets } from "../lib/township";
import { C, H, MARGIN, T, W, sec } from "../tokens";

// Scene 1 — cold open. 4 June 2023: the town is drawn on the storm, the camera
// pushes into Phase 1, the water rises and Jalan Makyong goes under.
// Facts: The Star, 5 June 2023 ("Phase 1 … especially the Jalan Makyong area,
// was badly hit"; rain "for over two hours").

export const S01_DURATION = sec(15);

const MAP_BOX = { x: 760, y: 70, w: 1080, h: 940 };
const project = fitProjector(boundsOf(streets.map((s) => s.line)), MAP_BOX);
const mapCentre = { x: MAP_BOX.x + MAP_BOX.w / 2, y: MAP_BOX.y + MAP_BOX.h / 2 };

const streetPaths = streets.map((s) => {
  const c = centroid([s.line], project);
  return { ...s, d: pathD(s.line, project), c, dist: Math.hypot(c.x - mapCentre.x, c.y - mapCentre.y) };
});
const maxDist = Math.max(...streetPaths.map((s) => s.dist));
const buildingPaths = buildings.map((b) => `${pathD(b, project)}Z`);
const makyong = streetPaths.filter((s) => /makyong/i.test(s.name));
const focus = centroid(
  makyong.map((s) => s.line),
  project,
);

const makyongPts = makyong.flatMap((s) => s.line.map(project));
const makyongBox = {
  minX: Math.min(...makyongPts.map((p) => p.x)),
  minY: Math.min(...makyongPts.map((p) => p.y)),
};

const ZOOM = 1.7;
const FOCUS_TO = { x: 1470, y: 770 }; // where Jalan Makyong ends up — clear of the captions
const LEVEL_END = 600; // final water line — cuts through the date

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const appear = (f: number, at: number) => interpolate(f, [at, at + 8], [0, 1], clamp);

const strokeFor = (highway: string) =>
  ["trunk", "primary", "secondary"].includes(highway) ? 3 : highway === "tertiary" ? 2.2 : 1.5;

export const S01ColdOpen: React.FC = () => {
  const f = useCurrentFrame();

  // Camera: push into Phase 1 so Jalan Makyong moves to FOCUS_TO.
  const push = interpolate(f, [sec(4.5), sec(8)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const s = 1 + (ZOOM - 1) * push;
  const fx = focus.x + (FOCUS_TO.x - focus.x) * push;
  const fy = focus.y + (FOCUS_TO.y - focus.y) * push;
  const tx = fx - s * focus.x;
  const ty = fy - s * focus.y;
  const toScreen = (p: { x: number; y: number }) => ({ x: tx + s * p.x, y: ty + s * p.y });

  // Water rises from below the frame to the date.
  const level = interpolate(f, [sec(6.5), sec(12.5)], [H + 60, LEVEL_END], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  // How far under the surface a screen point is (px); > 0 = submerged.
  const depth = (p: { x: number; y: number }) => p.y - surfaceY(p.x, level, f);
  const focusOnScreen = toScreen(focus);
  const labelIn = interpolate(depth(focusOnScreen), [0, 40], [0, 1], clamp);
  const labelAt = toScreen({ x: makyongBox.minX, y: makyongBox.minY });

  const buildingsIn = interpolate(f, [sec(1.2), sec(3)], [0, 0.32], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: C.storm, fontFamily }}>
      {/* The town */}
      <AbsoluteFill>
        <svg width={W} height={H}>
          <g transform={`translate(${tx} ${ty}) scale(${s})`}>
            {buildingPaths.map((d, i) => (
              <path key={i} d={d} fill={C.stormLine} opacity={buildingsIn} />
            ))}
            {streetPaths.map((st) => {
              const start = sec(0.5) + (st.dist / maxDist) * sec(2.2);
              const p = interpolate(f, [start, start + sec(0.9)], [0, 1], clamp);
              return (
                <path
                  key={st.id}
                  d={st.d}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - p}
                  fill="none"
                  stroke={C.stormLine}
                  strokeWidth={strokeFor(st.highway)}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        </svg>
      </AbsoluteFill>

      <Rain frame={f} level={level} />
      <Water level={level} frame={f} />

      {/* Jalan Makyong turns red as the water takes it */}
      <AbsoluteFill>
        <svg width={W} height={H}>
          <g transform={`translate(${tx} ${ty}) scale(${s})`}>
            {makyong.map((st) => (
              <path
                key={st.id}
                d={st.d}
                fill="none"
                stroke={C.red}
                strokeWidth={6}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={interpolate(depth(toScreen(st.c)), [0, 30], [0, 1], clamp)}
              />
            ))}
          </g>
        </svg>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: labelAt.x,
          top: labelAt.y - 64,
          opacity: labelIn,
          display: "flex",
          alignItems: "center",
          gap: 16,
          color: C.paper,
          fontSize: 38,
          fontWeight: 600,
        }}
      >
        <span style={{ width: 36, height: 6, borderRadius: 3, background: C.red }} />
        Jalan Makyong
      </div>

      {/* Place + date — the water line cuts through the date */}
      <WaterCut
        level={level}
        above={C.paper}
        below={C.surface}
        render={(color) => (
          <div style={{ position: "absolute", left: MARGIN, top: 436, color }}>
            <div style={{ fontSize: T.caption, fontWeight: 400, opacity: appear(f, sec(0.3)) }}>
              Bandar Bukit Raja, Klang
            </div>
            <div
              style={{
                fontSize: T.display,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.025em",
                marginTop: 8,
                opacity: appear(f, sec(0.8)),
              }}
            >
              4 June 2023
            </div>
          </div>
        )}
      />

      {/* Captions (the voice of the film) */}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 780,
          width: 1060,
          color: C.paper,
          fontSize: T.caption,
          fontWeight: 500,
          lineHeight: 1.25,
        }}
      >
        <div style={{ opacity: appear(f, sec(8.6)) }}>Over two hours of rain flooded Phase 1 of Bandar Bukit Raja.</div>
        <div style={{ opacity: appear(f, sec(11.2)), marginTop: 18 }}>Jalan Makyong was among the worst hit.</div>
      </div>

      {/* Credits */}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          right: MARGIN,
          bottom: 34,
          display: "flex",
          justifyContent: "space-between",
          color: C.paper,
          fontSize: T.credit,
          opacity: 0.72 * appear(f, sec(8.6)),
        }}
      >
        <span>Source: The Star, 5 June 2023</span>
        <span>Map data © OpenStreetMap contributors</span>
      </div>
    </AbsoluteFill>
  );
};
