import { NextResponse } from "next/server";
import { DEMO_RESIDENTS } from "@/lib/residents-data";
import { getServerSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb.from("residents").select("*, streets(name)");
    if (!error && data && data.length > 0) {
      return NextResponse.json(data);
    }
  } catch {
    // Fall back to local DEMO_RESIDENTS
  }
  return NextResponse.json(DEMO_RESIDENTS);
}
