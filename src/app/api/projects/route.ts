import { NextResponse } from "next/server";
import { getProjectUsage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await getProjectUsage();
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("Projects query error:", err);
    return NextResponse.json(
      { error: "Failed to fetch project usage" },
      { status: 500 }
    );
  }
}
