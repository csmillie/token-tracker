// ── Database row types ──

export interface Session {
  session_id: string;
  project_name: string | null;
  cwd: string | null;
  git_branch: string | null;
  model: string | null;
  first_seen: Date;
  last_seen: Date;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_create_tokens: number;
  is_active: boolean;
}

export interface UsageEvent {
  id: number;
  session_id: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  span_name: string | null;
  trace_id: string | null;
  span_id: string | null;
  ts: Date;
  raw_attributes: Record<string, unknown> | null;
}

export interface SessionSnapshot {
  id: number;
  session_id: string;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  cwd: string | null;
  git_branch: string | null;
  project_name: string | null;
  event_type: string | null;
  ts: Date;
  raw_payload: Record<string, unknown> | null;
}

// ── API response types ──

export interface OverviewStats {
  tokens_today: number;
  tokens_this_week: number;
  active_sessions: number;
  tokens_by_model: { model: string; total: number }[];
  rolling_5h_total: number;
  cache_read_today: number;
  cache_read_this_week: number;
  cache_read_5h: number;
}

export interface HourlyUsage {
  hour: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  total: number;
}

export interface ActiveSession {
  session_id: string;
  project_name: string | null;
  cwd: string | null;
  git_branch: string | null;
  model: string | null;
  last_seen: Date;
  total_input_tokens: number;
  total_output_tokens: number;
  burn_rate: number; // tokens per hour
}

export interface ProjectUsage {
  project_name: string;
  total_input: number;
  total_output: number;
  total: number;
  session_count: number;
}

// ── Hook payload from Claude Code ──

export interface HookPayload {
  session_id?: string;
  event_type?: string; // SessionStart, Stop, SessionEnd
  cwd?: string;
  project_name?: string;
  git_branch?: string;
  model?: string;
  total_input_tokens?: number;
  total_output_tokens?: number;
  [key: string]: unknown; // forward-compat
}
