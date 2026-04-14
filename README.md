# TokenTracker

Local-first Claude Code token usage observability. Captures telemetry via OpenTelemetry, stores in Postgres, displays in a Next.js dashboard.

## Architecture

```
Claude Code ──OTLP──→ OTel Collector ──OTLP/JSON──→ Next.js /api/ingest ──→ Postgres
Claude Code hooks ──POST──→ Next.js /api/hooks ──→ Postgres
Next.js dashboard ←── reads ←── Postgres
```

Two parts:

1. **Tracker** (required) — Postgres + OTel Collector in Docker. Captures and stores all token usage from Claude Code sessions via OpenTelemetry.
2. **Web Dashboard** (optional) — Next.js app that reads from Postgres and shows charts, session tables, burn rates, and project breakdowns.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+
- A shell where you run Claude Code (`zsh` or `bash`)

## Part 1: Tracker Setup

### 1.1 Start the infrastructure

```bash
cd ~/WWW/tokentracker
docker compose up -d
```

This starts:
- **Postgres** on port 5433 (data storage)
- **OTel Collector** on ports 4317 (gRPC) / 4318 (HTTP) — receives telemetry from Claude Code

### 1.2 Initialize the database

```bash
npm install
npm run migrate
```

This creates the `sessions`, `usage_events`, and `session_snapshots` tables.

### 1.3 Configure Claude Code telemetry

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
```

Then reload your shell:

```bash
source ~/.zshrc
```

Claude Code will now export OpenTelemetry traces (including token usage) to the collector, which forwards them to the ingestion endpoint.

### 1.4 Add hooks for supplemental metadata (optional)

Hooks capture project context (cwd, git branch, project name) that isn't in the OTLP data. Add to `~/.claude/settings.json` — merge into existing `hooks` key if you have one:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "HOOK_EVENT_TYPE=SessionStart bash ~/WWW/tokentracker/hooks/session-hook.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "HOOK_EVENT_TYPE=Stop bash ~/WWW/tokentracker/hooks/session-hook.sh"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "HOOK_EVENT_TYPE=SessionEnd bash ~/WWW/tokentracker/hooks/session-hook.sh"
          }
        ]
      }
    ]
  }
}
```

> **Note:** Hooks require the web dashboard to be running (they POST to `/api/hooks`). Without the dashboard, hooks will silently fail (fire-and-forget) — no impact on Claude Code.

### 1.5 Verify

```bash
# Check Postgres is up
docker compose exec postgres pg_isready -U tokentracker

# Check OTel Collector is receiving
docker compose logs otel-collector --tail 20

# Start a Claude Code session and do something — then check for data:
docker compose exec postgres psql -U tokentracker -c "SELECT COUNT(*) FROM usage_events;"
```

## Part 2: Web Dashboard (Optional)

The dashboard provides a visual interface for exploring token usage. You can run the tracker without it — data still flows into Postgres and you can query it directly.

### 2.1 Start the dashboard

```bash
npm run dev
```

Open [http://localhost:3046](http://localhost:3046).

### 2.2 Dashboard pages

| Page | What it shows |
|------|--------------|
| **Overview** | Tokens today/week, active sessions, hourly usage chart, tokens by model |
| **Sessions** | All sessions with live indicators, burn rate (tokens/hour), input/output counts |
| **Trends** | Hourly + daily charts, rolling 5-hour estimate, model distribution |
| **Projects** | Usage by project/cwd with stacked bar chart and table |
| **Health** | Service connectivity status, port reference, shell export snippet |

### 2.3 API endpoints

All return typed JSON. Useful for building your own tools or scripts.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingest` | POST | Receives OTLP trace data (JSON) |
| `/api/ingest/logs` | POST | Receives OTLP log data (JSON) |
| `/api/hooks` | POST | Receives Claude Code hook events |
| `/api/overview` | GET | Overview stats |
| `/api/sessions` | GET | Recent sessions (or `?session_id=X` for events) |
| `/api/trends` | GET | Hourly/daily usage + rolling 5h total |
| `/api/projects` | GET | Per-project usage |
| `/api/health` | GET | System health check |

## Quick Start (Everything at Once)

```bash
cd ~/WWW/tokentracker
./scripts/bootstrap.sh   # Docker up + install + migrate
npm run dev              # Dashboard at http://localhost:3046
```

## Ports

| Service | Port |
|---------|------|
| Dashboard | 3046 |
| OTel Collector gRPC | 4317 |
| OTel Collector HTTP | 4318 |
| Postgres | 5433 |

## Database

Schema in `migrations/001_init.sql`:

- **sessions** — one row per Claude Code session, upserted on each event
- **usage_events** — immutable append-only token usage records from OTLP spans
- **session_snapshots** — point-in-time snapshots from hooks

### Querying directly

```bash
docker compose exec postgres psql -U tokentracker
```

```sql
-- Tokens today
SELECT SUM(input_tokens + output_tokens) FROM usage_events WHERE ts >= CURRENT_DATE;

-- Active sessions
SELECT session_id, project_name, model, last_seen FROM sessions WHERE is_active AND last_seen > NOW() - INTERVAL '30 min';

-- Hourly breakdown
SELECT date_trunc('hour', ts) AS hour, SUM(input_tokens) AS input, SUM(output_tokens) AS output
FROM usage_events WHERE ts >= CURRENT_DATE GROUP BY hour ORDER BY hour;

-- By project
SELECT COALESCE(project_name, cwd) AS project, SUM(total_input_tokens + total_output_tokens) AS total
FROM sessions GROUP BY project ORDER BY total DESC;

-- Burn rate per session
SELECT session_id, (total_input_tokens + total_output_tokens)::float
  / GREATEST(EXTRACT(EPOCH FROM (last_seen - first_seen)) / 3600.0, 0.01) AS tokens_per_hour
FROM sessions WHERE is_active ORDER BY tokens_per_hour DESC;
```

## Stopping and Restarting

```bash
# Stop everything
docker compose down

# Stop but keep data
docker compose stop

# Start again
docker compose up -d

# Nuke data and start fresh
docker compose down -v
docker compose up -d
npm run migrate
```

## Troubleshooting

**Dashboard shows "Database connection failed"**
→ Run `docker compose up -d` then refresh.

**No data appearing**
→ Check `echo $OTEL_EXPORTER_OTLP_ENDPOINT` shows `http://localhost:4318`.
→ Check collector logs: `docker compose logs otel-collector`.
→ Check health page: http://localhost:3046/health.

**Collector shows "connection refused" to ingest endpoint**
→ Dashboard must be running for OTLP export to succeed. Start `npm run dev` first.
→ Without dashboard, collector retries automatically. No data lost — spans buffer in collector.

**Port conflict on 5433**
→ Another Postgres on that port. Change port mapping in `docker-compose.yml` and `DATABASE_URL` in `.env`.

**Protobuf errors in ingest**
→ Ingest endpoint only accepts JSON. OTLP HTTP protocol defaults to protobuf. If collector sends protobuf, returns 415 error. May need to configure collector exporter encoding.

## Design Decisions

- **Raw `pg` over ORM** — analytics queries (CTEs, `generate_series`, aggregations) much cleaner in SQL
- **Server Components** — data fetched at render time, no client-side loading spinners
- **Immutable usage_events** — append-only, never update. Enables accurate aggregation
- **Session upsert** — concurrent sessions safely merge via `ON CONFLICT`
- **Defensive attribute parsing** — checks multiple OTLP attribute key names (`gen_ai.usage.input_tokens`, `llm.usage.prompt_tokens`, etc.) since Claude Code's telemetry may evolve
