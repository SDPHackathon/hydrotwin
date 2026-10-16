import { NextRequest, NextResponse } from "next/server";
import { closeGuardTask, getState } from "@/lib/server-state";

export async function GET() {
  const { guardTasks, checkIns } = getState();
  return NextResponse.json({ guardTasks, checkIns });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId } = body;
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const res = closeGuardTask(taskId);
    return NextResponse.json(res);
  } catch (err) {
    console.error("Error closing guard task:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
