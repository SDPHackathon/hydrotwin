import { NextRequest, NextResponse } from "next/server";
import { parseHelpRequest, type HelpRequest } from "@/lib/engine/help";
import { recordCheckIn } from "@/lib/server-state";

// Resident check-in: { resident_id, state: "safe" | "need_help", help_type?, people?, note? }.
// What a resident may ask for is decided in lib/engine/help.ts, not here.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resident_id, state } = body;

    if (!resident_id || (state !== "safe" && state !== "need_help")) {
      return NextResponse.json({ error: "Invalid check-in parameters" }, { status: 400 });
    }

    let request: HelpRequest | null = null;
    if (state === "need_help") {
      const parsed = parseHelpRequest(body);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      request = parsed.request;
    }

    const res = recordCheckIn(resident_id, state, request);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
    return NextResponse.json(res);
  } catch (err) {
    console.error("Error in /api/resident/check-in:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
