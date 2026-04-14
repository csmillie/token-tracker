"use client";

import { HourlyChart, DailyChart, ModelChart } from "@/components/charts";
import type { HourlyUsage } from "@/lib/types";

interface Props {
  hourly: HourlyUsage[];
  daily: { day: string; input_tokens: number; output_tokens: number; total: number }[];
  modelData: { model: string; total: number }[];
}

export function TrendsCharts({ hourly, daily, modelData }: Props) {
  return (
    <div className="space-y-4">
      <HourlyChart data={hourly} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DailyChart data={daily} />
        {modelData.length > 0 && <ModelChart data={modelData} />}
      </div>
    </div>
  );
}
