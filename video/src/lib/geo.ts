// Turns the township's lon/lat lines into screen coordinates.
// Equirectangular with a cos(latitude) correction — accurate enough at township scale.

export type LngLat = [number, number];
export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

export type Projector = (p: LngLat) => Pt;

export function boundsOf(lines: LngLat[][]) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const line of lines) {
    for (const [lon, lat] of line) {
      if (lon < w) w = lon;
      if (lon > e) e = lon;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
  }
  return { w, s, e, n };
}

// Fits the bounds inside the box (contain), centred.
export function fitProjector(b: ReturnType<typeof boundsOf>, box: Box): Projector {
  const k = Math.cos((((b.s + b.n) / 2) * Math.PI) / 180);
  const spanX = (b.e - b.w) * k;
  const spanY = b.n - b.s;
  const scale = Math.min(box.w / spanX, box.h / spanY);
  const ox = box.x + (box.w - spanX * scale) / 2;
  const oy = box.y + (box.h - spanY * scale) / 2;
  return ([lon, lat]) => ({ x: ox + (lon - b.w) * k * scale, y: oy + (b.n - lat) * scale });
}

export function pathD(line: LngLat[], project: Projector) {
  return line
    .map((p, i) => {
      const { x, y } = project(p);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join("");
}

export function centroid(lines: LngLat[][], project: Projector): Pt {
  let x = 0, y = 0, n = 0;
  for (const line of lines) {
    for (const p of line) {
      const q = project(p);
      x += q.x;
      y += q.y;
      n++;
    }
  }
  return { x: x / n, y: y / n };
}
