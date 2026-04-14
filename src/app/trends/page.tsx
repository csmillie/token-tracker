import StatsCard from "@/components/stats-card";
import {
  getHourlyUsage,
  getDailyUsage,
  getRolling5hTotal,
  getTokensByModel,
} from "@/lib/queries";
import { TrendsCharts } from "./trends-charts";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  let hourly = null;
  let daily = null;
  let rolling5h = 0;
  let byModel: { model: string; total: number }[] = [];
  let error = null;

  try {
    [hourly, daily, rolling5h, byModel] = await Promise.all([
      getHourlyUsage(),
      getDailyUsage(),
      getRolling5hTotal(),
      getTokensByModel(),
    ]);
  } catch (e) {
    error = String(e);
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Trends</h2>
        <p className="text-red">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Trends</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatsCard
          label="Rolling 5h Estimate"
          value={rolling5h}
          sub="All sessions"
        />
        <StatsCard
          label="Models Active Today"
          value={byModel.length}
        />
        <StatsCard
          label="Top Model Today"
          value={
            byModel[0]
              ? byModel[0].model
                  .replace(/^claude-/, "")
                  .replace(/-\d{8}$/, "")
              : "none"
          }
          sub={byModel[0] ? `${byModel[0].total.toLocaleString()} tokens` : ""}
        />
      </div>

      <TrendsCharts
        hourly={hourly!}
        daily={daily!}
        modelData={byModel}
      />
    </div>
  );
}
