import { getRecentSessions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  let sessions = null;
  let error = null;

  try {
    sessions = await getRecentSessions(100);
  } catch (e) {
    error = String(e);
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Sessions</h2>
        <p className="text-red">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Sessions</h2>

      {!sessions || sessions.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-muted">
          No sessions recorded yet. Start a Claude Code session with telemetry
          enabled.
        </div>
      ) : (
        <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left bg-surface-overlay">
                  <th className="p-3">Session ID</th>
                  <th className="p-3">Project</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Model</th>
                  <th className="p-3 text-right">Input Tokens</th>
                  <th className="p-3 text-right">Output Tokens</th>
                  <th className="p-3 text-right">Burn Rate</th>
                  <th className="p-3 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const isRecent =
                    Date.now() - new Date(s.last_seen).getTime() < 30 * 60 * 1000;
                  return (
                    <tr
                      key={s.session_id}
                      className="border-t border-border/50 hover:bg-surface-overlay"
                    >
                      <td className="p-3 font-mono text-xs">
                        <span className="flex items-center gap-2">
                          {isRecent && (
                            <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                          )}
                          {s.session_id.slice(0, 16)}
                        </span>
                      </td>
                      <td className="p-3 text-text-secondary">
                        {s.project_name ?? s.cwd ?? "-"}
                      </td>
                      <td className="p-3 text-text-secondary font-mono text-xs">
                        {s.git_branch ?? "-"}
                      </td>
                      <td className="p-3 text-text-secondary">
                        {s.model
                          ?.replace(/^claude-/, "")
                          .replace(/-\d{8}$/, "") ?? "-"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {s.total_input_tokens.toLocaleString()}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {s.total_output_tokens.toLocaleString()}
                      </td>
                      <td className="p-3 text-right tabular-nums text-amber">
                        {s.burn_rate.toLocaleString()}/h
                      </td>
                      <td className="p-3 text-right text-text-muted whitespace-nowrap">
                        {new Date(s.last_seen).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
