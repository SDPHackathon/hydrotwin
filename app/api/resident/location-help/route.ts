import { NextRequest, NextResponse } from "next/server";
import { parseHelpRequest } from "@/lib/engine/help";
import { boundedJson } from "@/lib/shared-townships";
import { readLocationHelp, requestLocationHelp, updateLocationHelp } from "@/lib/location-help";
import type { RoadPoint } from "@/lib/engine/route";
const headers = { "Cache-Control": "no-store" };
export async function POST(request: NextRequest) {
  try {
    const body = await boundedJson(request, 4096) as { action: string; token?: string; area_slug: string; origin: RoadPoint };
    if (body.token !== undefined && (typeof body.token !== "string" || !/^[0-9a-f-]{36}$/.test(body.token))) throw new Error("Invalid help session");
    if (body.action === "read") return NextResponse.json({ task: body.token ? readLocationHelp(body.token) : null }, { headers });
    if (body.action === "request") {
      const help = parseHelpRequest(body);
      if (!help.ok) throw new Error(help.error);
      const result = await requestLocationHelp(body.area_slug, body.origin, help.request, body.token);
      return NextResponse.json(result, { headers });
    }
    if ((body.action === "safe" || body.action === "cancel") && body.token) {
      const result = updateLocationHelp(body.token, body.action);
      return NextResponse.json(result, { status: result.ok ? 200 : 409, headers });
    }
    throw new Error("Invalid help action");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update help request" }, { status: 400, headers });
  }
}
