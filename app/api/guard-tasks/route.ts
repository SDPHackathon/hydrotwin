import { NextRequest, NextResponse } from "next/server";
import { acceptGuardTask, cancelGuardTask, closeGuardTask, getState } from "@/lib/server-state";
import { TASK_OUTCOMES } from "@/lib/engine/help";
import type { TaskOutcome } from "@/lib/engine/types";
import { locationTasks, transitionLocationTask } from "@/lib/location-help";

const MAX_RESPONDER_CHARS = 40;

// GET — all tasks and check-ins; ?resident_id=… narrows to one resident so the resident page can follow its own call.
export async function GET(req: NextRequest) {
  const residentId = req.nextUrl.searchParams.get("resident_id");
  const state = getState();
  const guardTasks = [...locationTasks(), ...state.guardTasks];
  const checkIns = state.checkIns;
  if (!residentId) return NextResponse.json({ guardTasks, checkIns });
  return NextResponse.json({
    guardTasks: guardTasks.filter((t) => t.resident_id === residentId),
    checkIns: checkIns.filter((c) => c.resident_id === residentId),
  });
}

// POST { taskId, action: "accept" | "resolve" | "cancel", responder, outcome } — a missing action means "resolve".
// The lifecycle rules live in lib/engine/help.ts.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      taskId,
      action = "resolve",
      responder = null,
      outcome = null,
      outcome_note = null,
    } = body;
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }
    if (action !== "accept" && action !== "resolve" && action !== "cancel") {
      return NextResponse.json({ error: "action must be accept, resolve, or cancel" }, { status: 400 });
    }
    if (responder !== null && (typeof responder !== "string" || !responder.trim() || responder.length > MAX_RESPONDER_CHARS)) {
      return NextResponse.json({ error: "responder must be a short name" }, { status: 400 });
    }
    if (outcome !== null && !TASK_OUTCOMES.some((o) => o.id === outcome)) {
      return NextResponse.json({ error: "invalid outcome" }, { status: 400 });
    }
    if (outcome_note !== null && (typeof outcome_note !== "string" || outcome_note.length > 140)) {
      return NextResponse.json({ error: "outcome_note must be text up to 140 characters" }, { status: 400 });
    }
    const name = responder ? responder.trim() : null;

    let res;
    if (String(taskId).startsWith("location-")) {
      res = transitionLocationTask(taskId, action, name, outcome as TaskOutcome | null, outcome_note as string | null);
    } else if (action === "accept") {
      res = acceptGuardTask(taskId, name);
    } else if (action === "cancel") {
      res = cancelGuardTask(taskId);
    } else {
      res = closeGuardTask(taskId, name, outcome as TaskOutcome | null, outcome_note as string | null);
    }

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.error === "unknown task" ? 404 : 409 });
    }
    return NextResponse.json(res);
  } catch (err) {
    console.error("Error in /api/guard-tasks:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
