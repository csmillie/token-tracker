import { NextResponse } from "next/server";
import { getHourlyUsage, getDailyUsage, getRolling5hTotal } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [hourly, daily, rolling5h] = await Promise.all([
      getHourlyUsage(),
      getDailyUsage(),
      getRolling5hTotal(),
    ]);
    return NextResponse.json({ hourly, daily, rolling_5h_total: rolling5h });
  } catch (err) {
    console.error("Trends query error:", err);
    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
