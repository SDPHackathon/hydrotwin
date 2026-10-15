// How deep the water slabs are drawn. Real overflow in our storm peaks around 20 cm — next to
// 7 m houses that is invisible — so heights are scaled for display. The UI says so.

export const WATER_HEIGHT_SCALE = 6;
const YARD_FROM_CM = 8; // water spreads from the road toward the houses past this depth

/** Slab heights in metres for one drain zone, from its street_depth_cm. */
export function slabHeights(streetDepthCm: number) {
  return {
    road: (streetDepthCm / 100) * WATER_HEIGHT_SCALE,
    yard: (Math.max(0, streetDepthCm - YARD_FROM_CM) / 100) * WATER_HEIGHT_SCALE,
  };
}
