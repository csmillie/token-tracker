import { NextRequest, NextResponse } from "next/server";
import { getRecentSessions, getSessionEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id");

    if (sessionId) {
      const events = await getSessionEvents(sessionId);
      return NextResponse.json({ session_id: sessionId, events });
    }

    const sessions = await getRecentSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("Sessions query error:", err);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
