import { NextRequest, NextResponse } from "next/server";
import { upsertSession, insertSnapshot } from "@/lib/queries";
import pool from "@/lib/db";
import type { HookPayload } from "@/lib/types";

// Receives metadata from Claude Code hooks (SessionStart, Stop, SessionEnd).
// Hook script POSTs JSON with session_id, cwd, git_branch, etc.

export async function POST(request: NextRequest) {
  try {
    const payload: HookPayload = await request.json();

    if (!payload.session_id) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    // Upsert session with metadata
    await upsertSession({
      session_id: payload.session_id,
      project_name: payload.project_name,
      cwd: payload.cwd,
      git_branch: payload.git_branch,
      model: payload.model,
    });

    // Insert snapshot
    await insertSnapshot({
      session_id: payload.session_id,
      total_input_tokens: payload.total_input_tokens,
      total_output_tokens: payload.total_output_tokens,
      cwd: payload.cwd,
      git_branch: payload.git_branch,
      project_name: payload.project_name,
      event_type: payload.event_type,
      raw_payload: payload as Record<string, unknown>,
    });

    // Mark session inactive on SessionEnd
    if (payload.event_type === "SessionEnd") {
      await pool.query(
        "UPDATE sessions SET is_active = 0, last_seen = NOW() WHERE session_id = ?",
        [payload.session_id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Hook ingest error:", err);
    return NextResponse.json(
      { error: "Hook processing failed", detail: String(err) },
      { status: 500 }
    );
  }
}
