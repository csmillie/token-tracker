import StatsCard from "@/components/stats-card";
import {
  getOverviewStats,
  getHourlyUsage,
  getActiveSessions,
} from "@/lib/queries";
import { OverviewCharts } from "./overview-charts";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let stats = null;
  let hourly = null;
  let sessions = null;
  let error = null;

  try {
    [stats, hourly, sessions] = await Promise.all([
      getOverviewStats(),
      getHourlyUsage(),
      getActiveSessions(),
    ]);
  } catch (e) {
    error = String(e);
  }

  if (error || !stats) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Overview</h2>
        <div className="bg-surface-raised border border-red/30 rounded-lg p-6 text-red">
          <p className="font-medium">Database connection failed</p>
          <p className="text-sm text-text-muted mt-2">
            Make sure MySQL is running and the database exists.
          </p>
          {error && (
            <pre className="text-xs mt-2 text-text-muted overflow-auto">
              {error}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Tokens Today"
          value={stats.tokens_today}
          sub={`+ ${stats.cache_read_today.toLocaleString()} cache read`}
        />
        <StatsCard
          label="Tokens This Week"
          value={stats.tokens_this_week}
          sub={`+ ${stats.cache_read_this_week.toLocaleString()} cache read`}
        />
        <StatsCard label="Active Sessions" value={stats.active_sessions} />
        <StatsCard
          label="Rolling 5h Total"
          value={stats.rolling_5h_total}
          sub={`+ ${stats.cache_read_5h.toLocaleString()} cache read`}
        />
      </div>

      <OverviewCharts
        hourly={hourly!}
        modelData={stats.tokens_by_model}
      />

      {sessions && sessions.length > 0 && (
        <div className="mt-6 bg-surface-raised border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Active Sessions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left border-b border-border">
                  <th className="pb-2 pr-4">Session</th>
                  <th className="pb-2 pr-4">Project</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4 text-right">Input</th>
                  <th className="pb-2 pr-4 text-right">Output</th>
                  <th className="pb-2 pr-4 text-right">Burn Rate</th>
                  <th className="pb-2 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.session_id}
                    className="border-b border-border/50 hover:bg-surface-overlay"
                  >
                    <td className="py-2 pr-4 font-mono text-xs">
                      {s.session_id.slice(0, 12)}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {s.project_name ?? s.cwd ?? "-"}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {s.model?.replace(/^claude-/, "").replace(/-\d{8}$/, "") ??
                        "-"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {s.total_input_tokens.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {s.total_output_tokens.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-amber">
                      {s.burn_rate.toLocaleString()}/h
                    </td>
                    <td className="py-2 text-right text-text-muted">
                      {new Date(s.last_seen).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
