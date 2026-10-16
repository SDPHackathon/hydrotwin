import { NextRequest, NextResponse } from "next/server";
import { getState, processReadings } from "@/lib/server-state";

export async function GET() {
  return NextResponse.json(getState());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { readings, minute, running, speed } = body;

    if (!Array.isArray(readings)) {
      return NextResponse.json({ error: "readings array required" }, { status: 400 });
    }

    const state = await processReadings(readings, minute, running, speed);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error in /api/risk-engine:", err);
    return NextResponse.json({ error: "Failed to process readings" }, { status: 500 });
  }
}
