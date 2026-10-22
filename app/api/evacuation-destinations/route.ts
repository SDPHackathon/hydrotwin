import { NextRequest, NextResponse } from "next/server";
import { loadEvacuationCatalogue } from "@/lib/evacuation/catalogue";

export async function GET(request: NextRequest) {
  const area = request.nextUrl.searchParams.get("area") ?? "bukit-raja";
  const headers = { "Cache-Control": "no-store" };
  try {
    const catalogue = await loadEvacuationCatalogue(area);
    return catalogue ? NextResponse.json(catalogue, { headers }) : NextResponse.json({ error: "Township is not shared. Open it on the dashboard first." }, { status: 404, headers });
  } catch {
    return NextResponse.json({ error: "The shared destination catalogue is unavailable." }, { status: 503, headers });
  }
}
