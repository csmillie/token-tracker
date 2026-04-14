import { NextResponse } from "next/server";
import { getOverviewStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getOverviewStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("Overview query error:", err);
    return NextResponse.json(
      { error: "Failed to fetch overview stats" },
      { status: 500 }
    );
  }
}
