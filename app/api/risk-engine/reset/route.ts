import { NextResponse } from "next/server";
import { resetState } from "@/lib/server-state";

export async function POST() {
  const state = resetState();
  return NextResponse.json(state);
}
