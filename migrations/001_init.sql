-- TokenTracker schema
-- Sessions, usage events, and session snapshots

CREATE TABLE IF NOT EXISTS sessions (
  session_id    TEXT PRIMARY KEY,
  project_name  TEXT,
  cwd           TEXT,
  git_branch    TEXT,
  model         TEXT,
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_input_tokens   BIGINT NOT NULL DEFAULT 0,
  total_output_tokens  BIGINT NOT NULL DEFAULT 0,
  total_cache_read_tokens    BIGINT NOT NULL DEFAULT 0,
  total_cache_create_tokens  BIGINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usage_events (
  id              BIGSERIAL PRIMARY KEY,
  session_id      TEXT NOT NULL,
  model           TEXT,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_create_tokens   INTEGER NOT NULL DEFAULT 0,
  span_name       TEXT,
  trace_id        TEXT,
  span_id         TEXT,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Store full attribute set for forward-compatibility
  raw_attributes  JSONB
);

CREATE TABLE IF NOT EXISTS session_snapshots (
  id                    BIGSERIAL PRIMARY KEY,
  session_id            TEXT NOT NULL,
  total_input_tokens    BIGINT,
  total_output_tokens   BIGINT,
  cwd                   TEXT,
  git_branch            TEXT,
  project_name          TEXT,
  event_type            TEXT,  -- e.g. SessionStart, Stop, SessionEnd
  ts                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload           JSONB
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_usage_events_session_id ON usage_events (session_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_ts ON usage_events (ts);
CREATE INDEX IF NOT EXISTS idx_usage_events_model ON usage_events (model);
CREATE INDEX IF NOT EXISTS idx_usage_events_session_ts ON usage_events (session_id, ts);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions (project_name);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions (last_seen);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions (is_active);

CREATE INDEX IF NOT EXISTS idx_snapshots_session_id ON session_snapshots (session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON session_snapshots (ts);
