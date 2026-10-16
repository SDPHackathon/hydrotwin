import { NextRequest, NextResponse } from "next/server";
import { recordCheckIn } from "@/lib/server-state";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resident_id, state } = body;

    if (!resident_id || (state !== "safe" && state !== "need_help")) {
      return NextResponse.json({ error: "Invalid check-in parameters" }, { status: 400 });
    }

    const res = recordCheckIn(resident_id, state);
    return NextResponse.json(res);
  } catch (err) {
    console.error("Error in /api/resident/check-in:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
