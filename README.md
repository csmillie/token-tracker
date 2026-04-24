# TokenTracker

Local-first Claude Code token usage observability. Captures telemetry via OpenTelemetry, stores in MySQL, displays in a Next.js dashboard. Correlates token usage with GitHub activity (commits, PRs) per project.

## Architecture

```
Claude Code ──OTLP──→ OTel Collector ──HTTP/JSON──→ PHP ingest ──→ MySQL
Claude Code ──OTLP──→ OTel Collector ──HTTP/JSON──→ Next.js /api/ingest ──→ MySQL
Claude Code hooks ──POST──→ PHP /v1/session-meta ──→ MySQL
Next.js dashboard ←── reads ←── MySQL
GitHub API ──sync──→ MySQL (commits, PRs)
```

Two ingest paths:

1. **PHP ingest** (via Laravel Valet) — lightweight, always-on endpoint for OTel Collector and hook data
2. **Next.js ingest** — alternative when running the dashboard's dev server

Both write to the same MySQL database.

## Prerequisites

- MySQL 8.0+
- Node.js 20+
- PHP 8.1+ (for Valet ingest path, optional)
- GitHub CLI (`gh`) authenticated (for GitHub sync, optional)
- A shell where you run Claude Code (`zsh` or `bash`)

## Quick Start

```bash
git clone https://github.com/csmillie/token-tracker.git
cd token-tracker

# Configure database
cp .env.example .env
# Edit .env with your MySQL credentials

# Install and migrate
npm install
npm run migrate

# Start dashboard
npm run dev
```

Open [http://localhost:3046](http://localhost:3046).

## Setup

### 1. Database

Create a MySQL database:

```sql
CREATE DATABASE tokentracker;
```

Copy `.env.example` to `.env` and set your credentials:

```bash
cp .env.example .env
```

Run migrations:

```bash
npm run migrate
```

### 2. Configure Claude Code Telemetry

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
```

Reload your shell:

```bash
source ~/.zshrc
```

Claude Code will now export OpenTelemetry traces (including token usage) to the collector, which forwards them to the ingestion endpoint.

### 3. OTel Collector

Start the collector (receives telemetry from Claude Code, forwards to ingest):

```bash
docker compose up -d
```

The collector listens on ports 4317 (gRPC) and 4318 (HTTP).

Set `INGEST_BASE_URL` in your environment or `.env` to point at your ingest endpoint:

```bash
# For Valet PHP ingest:
INGEST_BASE_URL=http://tokentracker.test

# For Next.js ingest (default):
INGEST_BASE_URL=http://localhost:3046
```

### 4. Hooks (Optional)

Hooks capture project context (cwd, git branch, project name) that isn't in the OTLP data. Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "HOOK_EVENT_TYPE=SessionStart bash /path/to/token-tracker/hooks/session-hook.sh"
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
            "command": "HOOK_EVENT_TYPE=Stop bash /path/to/token-tracker/hooks/session-hook.sh"
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
            "command": "HOOK_EVENT_TYPE=SessionEnd bash /path/to/token-tracker/hooks/session-hook.sh"
          }
        ]
      }
    ]
  }
}
```

Set `TOKENTRACKER_URL` in your environment if your ingest endpoint isn't at the default `http://localhost:3046`.

### 5. GitHub Sync (Optional)

Sync commits and PRs from GitHub to correlate with token usage:

```bash
# One-time: run migrations for GitHub tables
npm run migrate

# Sync all mapped projects
npm run sync-github
```

Project-to-repo mappings are stored in the `project_repos` table. The sync script uses `gh` CLI and pulls the last 30 days of commits and PRs.

To run daily, add a cron job:

```bash
0 6 * * * cd /path/to/token-tracker && node scripts/sync-github.js
```

### 6. PHP Ingest via Valet (Optional)

If you use Laravel Valet, link the project for an always-on ingest endpoint:

```bash
cd /path/to/token-tracker
valet link tokentracker
```

The `LocalValetDriver.php` and `index.php` handle routing. The PHP ingest path doesn't require the Next.js dev server to be running.

## Dashboard

### Pages

| Page | What it shows |
|------|--------------|
| **Overview** | Tokens today/week (cache read shown separately), active sessions, hourly usage chart, tokens by model |
| **Sessions** | All sessions with burn rate (tokens/hour), input/output counts |
| **Trends** | Hourly + daily charts, rolling 5-hour estimate, model distribution |
| **Projects** | Per-project usage with expandable timeline charts, GitHub commit/PR overlay |
| **Health** | Service connectivity status, port reference, shell export snippet |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingest` | POST | Receives OTLP trace data (JSON or protobuf) |
| `/api/ingest/logs` | POST | Receives OTLP log data (JSON or protobuf) |
| `/api/hooks` | POST | Receives Claude Code hook events |
| `/api/overview` | GET | Overview stats |
| `/api/sessions` | GET | Recent sessions (or `?session_id=X` for events) |
| `/api/trends` | GET | Hourly/daily usage + rolling 5h total |
| `/api/projects` | GET | Per-project usage |
| `/api/projects/timeline` | GET | Project token timeline + GitHub activity (`?project=name`) |
| `/api/health` | GET | System health check |

## Ports

| Service | Port |
|---------|------|
| Dashboard | 3046 |
| OTel Collector gRPC | 4317 |
| OTel Collector HTTP | 4318 |
| MySQL | 3306 (default) |

## Database Schema

Migrations in `migrations/`:

- **sessions** — one row per Claude Code session, upserted on each event
- **usage_events** — immutable append-only token usage records from OTLP spans
- **session_snapshots** — point-in-time snapshots from hooks
- **project_repos** — maps project names to GitHub owner/repo
- **github_commits** — synced commit history per project
- **github_prs** — synced PR history per project

### Querying Directly

```sql
-- Tokens today (excluding cache reads)
SELECT SUM(input_tokens + output_tokens) FROM usage_events WHERE ts >= CURDATE();

-- Active sessions
SELECT session_id, project_name, model, last_seen
FROM sessions WHERE is_active = 1 AND last_seen > DATE_SUB(NOW(), INTERVAL 30 MINUTE);

-- Hourly breakdown
SELECT DATE_FORMAT(ts, '%Y-%m-%d %H:00') AS hour, SUM(input_tokens) AS input, SUM(output_tokens) AS output
FROM usage_events WHERE ts >= CURDATE() GROUP BY hour ORDER BY hour;

-- By project
SELECT COALESCE(project_name, cwd) AS project, SUM(total_input_tokens + total_output_tokens) AS total
FROM sessions GROUP BY project ORDER BY total DESC;
```

## Troubleshooting

**Dashboard shows "Database connection failed"**
Check `.env` credentials and that MySQL is running.

**No data appearing**
Check `echo $OTEL_EXPORTER_OTLP_ENDPOINT` shows `http://localhost:4318`.
Check collector logs: `docker compose logs otel-collector`.
Check health page: http://localhost:3046/health.

**Collector shows "connection refused" to ingest endpoint**
Either the PHP Valet site or the Next.js dev server must be running to receive data.

## About the Author

Built by Colin Smillie

- [colinsmillie.com](https://colinsmillie.com)
- [www.ideawarehouse.ca](https://www.ideawarehouse.ca)
- [www.evd2.ca](https://www.evd2.ca)
- [www.modeltrust.app](https://www.modeltrust.app)
- [www.freshnews.ca](https://www.freshnews.ca)

## License

MIT
