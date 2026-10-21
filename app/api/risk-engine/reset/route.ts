import { NextRequest, NextResponse } from "next/server";
import { resetArea } from "@/lib/area-state";
import { readSharedTownship } from "@/lib/shared-townships";

export async function POST(request: NextRequest) {
  const bundle = await readSharedTownship(request.nextUrl.searchParams.get("area") ?? "bukit-raja");
  if (!bundle) return NextResponse.json({ error: "Township is not shared" }, { status: 404 });
  const state = resetArea(bundle);
  return NextResponse.json(state);
}
