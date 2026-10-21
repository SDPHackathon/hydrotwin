import { NextRequest, NextResponse } from "next/server";
import { InvalidRouteOrigin, locationSafeRoute, residentSafeRoute } from "@/lib/evacuation/service";
import { boundedJson } from "@/lib/shared-townships";

// Public lookup is limited to the fixed fictional resident list; never real resident profiles.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("resident_id");
  const headers = { "Cache-Control": "no-store" };
  if (!id || id.length > 64) return NextResponse.json({ error: "A fictional resident ID is required." }, { status: 400, headers });
  try {
    const result = await residentSafeRoute(id);
    return result ? NextResponse.json(result, { headers }) : NextResponse.json({ error: "Unknown fictional resident." }, { status: 404, headers });
  } catch {
    return NextResponse.json({ error: "Route data is unavailable. Help requests remain separate." }, { status: 503, headers });
  }
}
// POST avoids putting schematic location anchors in URLs or browser history.
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  let body: { area_slug: string; origin: Parameters<typeof locationSafeRoute>[1] };
  try {
    body = await boundedJson(request, 2048) as typeof body;
    if (!body || typeof body.area_slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(body.area_slug)) throw new Error("Select a township");
  } catch {
    return NextResponse.json({ error: "A valid township and mapped starting point are required" }, { status: 400, headers });
  }
  try {
    const result = await locationSafeRoute(body.area_slug, body.origin);
    return result ? NextResponse.json(result, { headers }) : NextResponse.json({ error: "Township is not shared" }, { status: 404, headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof InvalidRouteOrigin ? error.message : "Route data is unavailable. Help requests remain separate." }, { status: error instanceof InvalidRouteOrigin ? 400 : 503, headers });
  }
}
