import { NextRequest, NextResponse } from "next/server";
import { boundedJson, readSharedTownship, sharedTownships } from "@/lib/shared-townships";
import { insideCoverage, locateCoverage, searchCoverage, type Coordinate, type CoverageResponse } from "@/lib/engine/coverage";
import type { RouteTownship } from "@/lib/engine/township";

const headers = { "Cache-Control": "no-store" };
async function discover(query: string | null, point: Coordinate | null) {
  const areas = await sharedTownships();
  const candidates = point ? areas.filter((area) => insideCoverage(area, point)) : areas;
  const loaded = await Promise.allSettled(candidates.map((area) => readSharedTownship(area.slug)));
  const bundles: RouteTownship[] = [], incomplete: string[] = [];
  loaded.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) bundles.push(result.value);
    else incomplete.push(candidates[index].slug);
  });
  const matches = point ? locateCoverage(bundles, point) : searchCoverage(bundles, query ?? "");
  const result: CoverageResponse = { areas, matches: matches.slice(0, 24), incomplete, truncated: matches.length > 24 };
  return NextResponse.json(result, { headers });
}
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) return NextResponse.json({ error: "Enter 2–120 characters of a street name." }, { status: 400, headers });
  try { return await discover(query, null); }
  catch { return NextResponse.json({ error: "Coverage is temporarily unavailable." }, { status: 503, headers }); }
}
export async function POST(request: NextRequest) {
  let point: Coordinate;
  try {
    const body = await boundedJson(request, 1024) as { point?: unknown };
    const value = body?.point;
    if (!Array.isArray(value) || value.length !== 2 || !value.every((n) => typeof n === "number" && Number.isFinite(n)) || Math.abs(value[0]) > 180 || Math.abs(value[1]) > 85) throw new Error("Invalid location");
    point = value as Coordinate;
  } catch { return NextResponse.json({ error: "Provide a valid [longitude, latitude] location." }, { status: 400, headers }); }
  // Coordinates are transient request-body data, never URL parameters or persisted records.
  try { return await discover(null, point); }
  catch { return NextResponse.json({ error: "Coverage is temporarily unavailable." }, { status: 503, headers }); }
}
