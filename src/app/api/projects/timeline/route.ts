import { NextRequest, NextResponse } from "next/server";
import { getProjectTimeline, getProjectGitHubActivity } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get("project");
  if (!project) {
    return NextResponse.json(
      { error: "Missing project parameter" },
      { status: 400 }
    );
  }

  try {
    const [timeline, github] = await Promise.all([
      getProjectTimeline(project),
      getProjectGitHubActivity(project),
    ]);
    return NextResponse.json({ timeline, github });
  } catch (err) {
    console.error("Project timeline error:", err);
    return NextResponse.json(
      { error: "Failed to fetch project timeline" },
      { status: 500 }
    );
  }
}
