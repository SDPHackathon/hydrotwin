import { NextRequest, NextResponse } from "next/server";
import { acceptGuardTask, closeGuardTask, getState } from "@/lib/server-state";

const MAX_RESPONDER_CHARS = 40;

// GET — all tasks and check-ins; ?resident_id=… narrows to one resident so the resident page can follow its own call.
export async function GET(req: NextRequest) {
  const residentId = req.nextUrl.searchParams.get("resident_id");
  const { guardTasks, checkIns } = getState();
  if (!residentId) return NextResponse.json({ guardTasks, checkIns });
  return NextResponse.json({
    guardTasks: guardTasks.filter((t) => t.resident_id === residentId),
    checkIns: checkIns.filter((c) => c.resident_id === residentId),
  });
}

// POST { taskId, action: "accept" | "resolve", responder } — a missing action means "resolve".
// The lifecycle rules live in lib/engine/help.ts.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, action = "resolve", responder = null } = body;
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }
    if (action !== "accept" && action !== "resolve") {
      return NextResponse.json({ error: "action must be accept or resolve" }, { status: 400 });
    }
    if (responder !== null && (typeof responder !== "string" || !responder.trim() || responder.length > MAX_RESPONDER_CHARS)) {
      return NextResponse.json({ error: "responder must be a short name" }, { status: 400 });
    }
    const name = responder ? responder.trim() : null;

    const res = action === "accept" ? acceptGuardTask(taskId, name) : closeGuardTask(taskId, name);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.error === "unknown task" ? 404 : 409 });
    }
    return NextResponse.json(res);
  } catch (err) {
    console.error("Error in /api/guard-tasks:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
