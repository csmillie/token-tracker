-- TokenTracker MySQL schema

CREATE TABLE IF NOT EXISTS sessions (
  session_id    VARCHAR(255) PRIMARY KEY,
  project_name  VARCHAR(255),
  cwd           TEXT,
  git_branch    VARCHAR(255),
  model         VARCHAR(255),
  first_seen    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_input_tokens   BIGINT NOT NULL DEFAULT 0,
  total_output_tokens  BIGINT NOT NULL DEFAULT 0,
  total_cache_read_tokens    BIGINT NOT NULL DEFAULT 0,
  total_cache_create_tokens  BIGINT NOT NULL DEFAULT 0,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  INDEX idx_sessions_project (project_name),
  INDEX idx_sessions_last_seen (last_seen),
  INDEX idx_sessions_active (is_active)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id      VARCHAR(255) NOT NULL,
  model           VARCHAR(255),
  input_tokens    INT NOT NULL DEFAULT 0,
  output_tokens   INT NOT NULL DEFAULT 0,
  cache_read_tokens     INT NOT NULL DEFAULT 0,
  cache_create_tokens   INT NOT NULL DEFAULT 0,
  span_name       VARCHAR(255),
  trace_id        VARCHAR(255),
  span_id         VARCHAR(255),
  ts              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_attributes  JSON,

  INDEX idx_usage_events_session_id (session_id),
  INDEX idx_usage_events_ts (ts),
  INDEX idx_usage_events_model (model),
  INDEX idx_usage_events_session_ts (session_id, ts)
);

CREATE TABLE IF NOT EXISTS session_snapshots (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id            VARCHAR(255) NOT NULL,
  total_input_tokens    BIGINT,
  total_output_tokens   BIGINT,
  cwd                   TEXT,
  git_branch            VARCHAR(255),
  project_name          VARCHAR(255),
  event_type            VARCHAR(255),
  ts                    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_payload           JSON,

  INDEX idx_snapshots_session_id (session_id),
  INDEX idx_snapshots_ts (ts)
);
