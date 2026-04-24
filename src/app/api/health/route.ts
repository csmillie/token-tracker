import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await pool.query<RowDataPacket[]>("SELECT 1");
    checks.mysql = "ok";
  } catch {
    checks.mysql = "error";
  }

  const healthy = checks.mysql === "ok";
  return NextResponse.json(
    { healthy, checks },
    { status: healthy ? 200 : 503 }
  );
}
