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

  try {
    const res = await fetch("http://localhost:4318", {
      signal: AbortSignal.timeout(2000),
    });
    checks.otel_collector = {
      status: "reachable",
      detail: `HTTP ${res.status}`,
    };
  } catch {
    checks.otel_collector = {
      status: "unreachable",
      detail: "Cannot reach localhost:4318",
    };
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
                check.status === "ok" || check.status === "reachable"
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
            <span className="text-text-muted">OTel Collector gRPC</span>
            <span className="text-text-secondary font-mono">
              localhost:4317
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">OTel Collector HTTP</span>
            <span className="text-text-secondary font-mono">
              localhost:4318
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">MySQL</span>
            <span className="text-text-secondary font-mono">
              localhost:3306
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Ingest endpoint</span>
            <span className="text-text-secondary font-mono">
              POST /api/ingest
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Hook endpoint</span>
            <span className="text-text-secondary font-mono">
              POST /api/hooks
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
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"`}
        </pre>
      </div>
    </div>
  );
}
