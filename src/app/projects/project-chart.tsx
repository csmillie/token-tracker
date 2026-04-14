"use client";

import { ProjectChart } from "@/components/charts";
import type { ProjectUsage } from "@/lib/types";

export function ProjectChartWrapper({ data }: { data: ProjectUsage[] }) {
  return <ProjectChart data={data} />;
}
