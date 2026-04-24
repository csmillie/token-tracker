import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

async function checkHealth() {
  const checks: Record<string, { status: string; detail?: string }> = {};

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS events, (SELECT COUNT(*) FROM sessions) AS sessions FROM usage_events"
    );
    checks.mysql = {
      status: "ok",
      detail: `${rows[0].events} events, ${rows[0].sessions} sessions`,
    };
  } catch (e) {
    checks.mysql = { status: "error", detail: String(e) };
  }

  return checks;
}

export default async function HealthPage() {
  const checks = await checkHealth();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">System Health</h2>

      <div className="space-y-4">
        {Object.entries(checks).map(([name, check]) => (
          <div
            key={name}
            className="bg-surface-raised border border-border rounded-lg p-5 flex items-center justify-between"
          >
            <div>
              <h3 className="font-medium text-text-primary capitalize">
                {name.replace(/_/g, " ")}
              </h3>
              {check.detail && (
                <p className="text-sm text-text-muted mt-1">{check.detail}</p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                check.status === "ok"
                  ? "bg-green/10 text-green"
                  : "bg-red/10 text-red"
              }`}
            >
              {check.status}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-surface-raised border border-border rounded-lg p-5">
        <h3 className="font-medium text-text-primary mb-3">Configuration</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Dashboard</span>
            <span className="text-text-secondary font-mono">
              http://localhost:3046
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">MySQL</span>
            <span className="text-text-secondary font-mono">
              localhost:3306
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">PHP Ingest</span>
            <span className="text-text-secondary font-mono">
              POST /v1/traces, /v1/logs
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Session Hooks</span>
            <span className="text-text-secondary font-mono">
              POST /v1/session-meta
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-surface-raised border border-border rounded-lg p-5">
        <h3 className="font-medium text-text-primary mb-3">
          Claude Code Shell Exports
        </h3>
        <pre className="text-xs text-text-secondary bg-surface p-3 rounded overflow-x-auto">
{`# Add to ~/.zshrc or ~/.bashrc
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT="http://tokentracker.test"
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json`}
        </pre>
      </div>
    </div>
  );
}
