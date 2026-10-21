import type { RouteResult } from "../engine/route.ts";

type RouteEndpoints = Pick<RouteResult, "found" | "origin" | "destination">;
const validPoint = (point: [number, number] | null) => point?.length === 2 && point.every(Number.isFinite) &&
  Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;

// Maps URLs calculate new directions; they do not import HydroTwin's flood-avoiding path.
export function googleMapsWalkingUrl(route: RouteEndpoints | null | undefined): string | null {
  if (!route?.found || !validPoint(route.origin) || !validPoint(route.destination)) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  // GeoJSON is longitude,latitude; Google's directions parameters are latitude,longitude.
  url.searchParams.set("origin", `${route.origin![1]},${route.origin![0]}`);
  url.searchParams.set("destination", `${route.destination![1]},${route.destination![0]}`);
  url.searchParams.set("travelmode", "walking");
  return url.toString();
}
