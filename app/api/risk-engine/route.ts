import { NextRequest, NextResponse } from "next/server";
import { areaSnapshot, updateArea } from "@/lib/area-state";
import { readSharedTownship } from "@/lib/shared-townships";
import { boundedJson } from "@/lib/shared-townships";

export async function GET(req: NextRequest) {
  const bundle = await readSharedTownship(req.nextUrl.searchParams.get("area") ?? "bukit-raja");
  if (!bundle) return NextResponse.json({ error: "Township is not shared" }, { status: 404 });
  return NextResponse.json(areaSnapshot(bundle), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try { body = await boundedJson(req, 32000) as Record<string, unknown>; }
    catch { return NextResponse.json({ error: "Invalid bounded readings body" }, { status: 400 }); }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid readings body" }, { status: 400 });
    const { readings, minute, running, speed } = body;
    const queryArea = req.nextUrl.searchParams.get("area");
    if (queryArea && body.area_slug !== undefined && queryArea !== body.area_slug) return NextResponse.json({ error: "Conflicting township selectors" }, { status: 400 });
    const area = req.nextUrl.searchParams.get("area") ?? body.area_slug ?? "bukit-raja";
    const bundle = typeof area === "string" ? await readSharedTownship(area) : null;
    if (!bundle) return NextResponse.json({ error: "Township is not shared" }, { status: 404 });

    if (!Array.isArray(readings)) {
      return NextResponse.json({ error: "readings array required" }, { status: 400 });
    }
    const ids = new Set(bundle.drains.map((d) => d.id));
    if (readings.length > ids.size || new Set(readings.map((r) => r?.drain_id)).size !== readings.length ||
        readings.some((r) => !r || !ids.has(r.drain_id) || typeof r.level_cm !== "number" || !Number.isFinite(r.level_cm) || r.level_cm < 0 || r.level_cm > 10000 ||
          (r.source !== undefined && r.source !== "sim" && r.source !== "device")) ||
        (minute !== undefined && (typeof minute !== "number" || !Number.isInteger(minute) || minute < 0 || minute > 210)) ||
        (running !== undefined && typeof running !== "boolean") ||
        (speed !== undefined && (typeof speed !== "number" || !Number.isFinite(speed) || speed <= 0 || speed > 100))) {
      return NextResponse.json({ error: "Invalid bounded readings or playback metadata" }, { status: 400 });
    }

    const state = await updateArea(bundle, readings, { minute: minute as number | undefined, running: running as boolean | undefined, speed: speed as number | undefined });
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error in /api/risk-engine:", err);
    return NextResponse.json({ error: "Failed to process readings" }, { status: 500 });
  }
}
