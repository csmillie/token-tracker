# TokenTracker

Local-first Claude Code token usage dashboard. Captures telemetry directly from Claude Code's OpenTelemetry export, stores in MySQL, and displays in a Next.js dashboard. Correlates token usage with GitHub activity (commits, PRs) per project.

## Architecture

```
Claude Code ──OTLP/HTTP──→ PHP ingest (/v1/traces, /v1/logs) ──→ MySQL
Claude Code hooks ──POST──→ PHP ingest (/v1/session-meta) ──→ MySQL
Next.js dashboard ←── reads ←── MySQL
GitHub API ──sync──→ MySQL (commits, PRs)
```

Claude Code exports OpenTelemetry data directly to a PHP endpoint. A lightweight PHP router receives both OTLP telemetry (token usage per API call) and hook events (session metadata like project name, git branch). The Next.js dashboard reads from MySQL and renders charts and tables.

## Prerequisites

- MySQL 8.0+
- Node.js 20+
- PHP 8.1+ with a web server (Laravel Valet, MAMP, or any PHP server)
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

### 2. PHP Ingest Endpoint

The PHP ingest endpoint receives data from Claude Code. You need a PHP web server pointing at the project root. With Laravel Valet:

```bash
cd /path/to/token-tracker
valet link tokentracker
# Now available at http://tokentracker.test
```

The `LocalValetDriver.php` and `index.php` handle routing. Any PHP server that routes all requests to `index.php` will work.

### 3. Configure Claude Code Telemetry

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# Point Claude Code's OTLP export at your PHP ingest endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT="http://tokentracker.test"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/json"
export OTEL_LOGS_EXPORTER="otlp"
```

Reload your shell:

```bash
source ~/.zshrc
```

Claude Code will now send token usage data directly to the PHP endpoint on every API call.

### 4. Session Hooks

Add hooks to `~/.claude/settings.json` to capture session metadata (project name, git branch, cwd). Update the path and URL to match your setup:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "HOOK_EVENT_TYPE=SessionStart TOKENTRACKER_URL=http://tokentracker.test bash /path/to/token-tracker/hooks/session-hook.sh"
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
            "command": "HOOK_EVENT_TYPE=Stop TOKENTRACKER_URL=http://tokentracker.test bash /path/to/token-tracker/hooks/session-hook.sh"
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
            "command": "HOOK_EVENT_TYPE=SessionEnd TOKENTRACKER_URL=http://tokentracker.test bash /path/to/token-tracker/hooks/session-hook.sh"
          }
        ]
      }
    ]
  }
}
```

## Dashboard

### Pages

| Page | What it shows |
|------|--------------|
| **Overview** | Tokens today/week (cache read shown separately), active sessions, hourly usage chart, tokens by model |
| **Sessions** | All sessions with burn rate (tokens/hour), input/output counts |
| **Trends** | Hourly + daily charts, rolling 5-hour estimate, model distribution |
| **Projects** | Per-project usage with expandable timeline charts, GitHub commit/PR overlay |
| **Health** | Service connectivity status, configuration reference |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/traces` | POST | Receives OTLP trace data (JSON) — PHP |
| `/v1/logs` | POST | Receives OTLP log data (JSON) — PHP |
| `/v1/session-meta` | POST | Receives hook session metadata — PHP |
| `/api/overview` | GET | Overview stats — Next.js |
| `/api/sessions` | GET | Recent sessions — Next.js |
| `/api/trends` | GET | Hourly/daily usage — Next.js |
| `/api/projects` | GET | Per-project usage — Next.js |
| `/api/projects/timeline` | GET | Project token timeline + GitHub activity — Next.js |
| `/api/health` | GET | System health check — Next.js |

## Database Schema

Migrations in `migrations/`:

- **sessions** — one row per Claude Code session, upserted on each event
- **usage_events** — immutable append-only token usage records
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
Check `echo $OTEL_EXPORTER_OTLP_ENDPOINT` points at your PHP ingest URL.
Check health page: http://localhost:3046/health.
Verify PHP endpoint works: `curl http://tokentracker.test/healthz`

## About the Author

Built by Colin Smillie

- [colinsmillie.com](https://colinsmillie.com)
- [www.ideawarehouse.ca](https://www.ideawarehouse.ca)
- [www.evd2.ca](https://www.evd2.ca)
- [www.modeltrust.app](https://www.modeltrust.app)
- [www.freshnews.ca](https://www.freshnews.ca)

## License

MIT
