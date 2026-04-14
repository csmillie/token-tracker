"use client";

import { HourlyChart, ModelChart } from "@/components/charts";
import type { HourlyUsage } from "@/lib/types";

interface Props {
  hourly: HourlyUsage[];
  modelData: { model: string; total: number }[];
}

export function OverviewCharts({ hourly, modelData }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <HourlyChart data={hourly} />
      {modelData.length > 0 && <ModelChart data={modelData} />}
    </div>
  );
}
