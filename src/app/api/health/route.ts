import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await pool.query("SELECT 1");
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
  }

  try {
    const res = await fetch("http://localhost:4318/v1/traces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceSpans: [] }),
      signal: AbortSignal.timeout(2000),
    });
    checks.otel_collector = res.ok ? "ok" : `status ${res.status}`;
  } catch {
    checks.otel_collector = "unreachable";
  }

  const healthy = checks.postgres === "ok";
  return NextResponse.json(
    { healthy, checks },
    { status: healthy ? 200 : 503 }
  );
}
