import pool from "./db";
import type {
  OverviewStats,
  HourlyUsage,
  ActiveSession,
  ProjectUsage,
  UsageEvent,
} from "./types";

// ── Overview stats ──

export async function getOverviewStats(): Promise<OverviewStats> {
  const [today, week, active, byModel, rolling] = await Promise.all([
    getTokensToday(),
    getTokensThisWeek(),
    getActiveSessionCount(),
    getTokensByModel(),
    getRolling5hTotal(),
  ]);

  return {
    tokens_today: today,
    tokens_this_week: week,
    active_sessions: active,
    tokens_by_model: byModel,
    rolling_5h_total: rolling,
  };
}

export async function getTokensToday(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens), 0)::bigint AS total
    FROM usage_events
    WHERE ts >= CURRENT_DATE
  `);
  return Number(rows[0].total);
}

export async function getTokensThisWeek(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens), 0)::bigint AS total
    FROM usage_events
    WHERE ts >= date_trunc('week', CURRENT_DATE)
  `);
  return Number(rows[0].total);
}

export async function getActiveSessionCount(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM sessions
    WHERE is_active = TRUE
      AND last_seen > NOW() - INTERVAL '30 minutes'
  `);
  return rows[0].count;
}

export async function getTokensByModel(): Promise<
  { model: string; total: number }[]
> {
  const { rows } = await pool.query(`
    SELECT COALESCE(model, 'unknown') AS model,
           SUM(input_tokens + output_tokens + cache_read_tokens)::bigint AS total
    FROM usage_events
    WHERE ts >= CURRENT_DATE
    GROUP BY model
    ORDER BY total DESC
  `);
  return rows.map((r) => ({ model: r.model, total: Number(r.total) }));
}

export async function getRolling5hTotal(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens), 0)::bigint AS total
    FROM usage_events
    WHERE ts >= NOW() - INTERVAL '5 hours'
  `);
  return Number(rows[0].total);
}

// ── Hourly usage (last 24h) ──

export async function getHourlyUsage(): Promise<HourlyUsage[]> {
  const { rows } = await pool.query(`
    WITH hours AS (
      SELECT generate_series(
        date_trunc('hour', NOW() - INTERVAL '23 hours'),
        date_trunc('hour', NOW()),
        '1 hour'
      ) AS hour
    )
    SELECT
      h.hour::text,
      COALESCE(SUM(e.input_tokens), 0)::int AS input_tokens,
      COALESCE(SUM(e.output_tokens), 0)::int AS output_tokens,
      COALESCE(SUM(e.cache_read_tokens), 0)::int AS cache_read_tokens,
      COALESCE(SUM(e.input_tokens + e.output_tokens + e.cache_read_tokens), 0)::int AS total
    FROM hours h
    LEFT JOIN usage_events e
      ON date_trunc('hour', e.ts) = h.hour
    GROUP BY h.hour
    ORDER BY h.hour
  `);
  return rows;
}

// ── Active sessions ──

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const { rows } = await pool.query(`
    SELECT
      s.session_id,
      s.project_name,
      s.cwd,
      s.git_branch,
      s.model,
      s.last_seen,
      s.total_input_tokens,
      s.total_output_tokens,
      -- Burn rate: tokens per hour over session lifetime (min 1 minute to avoid div/0)
      CASE
        WHEN EXTRACT(EPOCH FROM (s.last_seen - s.first_seen)) > 60
        THEN ((s.total_input_tokens + s.total_output_tokens)::float
              / (EXTRACT(EPOCH FROM (s.last_seen - s.first_seen)) / 3600.0))::int
        ELSE 0
      END AS burn_rate
    FROM sessions s
    WHERE s.is_active = TRUE
      AND s.last_seen > NOW() - INTERVAL '2 hours'
    ORDER BY s.last_seen DESC
  `);
  return rows.map((r) => ({
    ...r,
    total_input_tokens: Number(r.total_input_tokens),
    total_output_tokens: Number(r.total_output_tokens),
    burn_rate: Number(r.burn_rate),
  }));
}

// ── All sessions (recent) ──

export async function getRecentSessions(
  limit = 50
): Promise<ActiveSession[]> {
  const { rows } = await pool.query(
    `
    SELECT
      s.session_id,
      s.project_name,
      s.cwd,
      s.git_branch,
      s.model,
      s.last_seen,
      s.total_input_tokens,
      s.total_output_tokens,
      CASE
        WHEN EXTRACT(EPOCH FROM (s.last_seen - s.first_seen)) > 60
        THEN ((s.total_input_tokens + s.total_output_tokens)::float
              / (EXTRACT(EPOCH FROM (s.last_seen - s.first_seen)) / 3600.0))::int
        ELSE 0
      END AS burn_rate
    FROM sessions s
    ORDER BY s.last_seen DESC
    LIMIT $1
  `,
    [limit]
  );
  return rows.map((r) => ({
    ...r,
    total_input_tokens: Number(r.total_input_tokens),
    total_output_tokens: Number(r.total_output_tokens),
    burn_rate: Number(r.burn_rate),
  }));
}

// ── Per-project usage ──

export async function getProjectUsage(): Promise<ProjectUsage[]> {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(s.project_name, s.cwd, 'unknown') AS project_name,
      SUM(s.total_input_tokens)::bigint AS total_input,
      SUM(s.total_output_tokens)::bigint AS total_output,
      SUM(s.total_input_tokens + s.total_output_tokens)::bigint AS total,
      COUNT(DISTINCT s.session_id)::int AS session_count
    FROM sessions s
    GROUP BY COALESCE(s.project_name, s.cwd, 'unknown')
    ORDER BY total DESC
  `);
  return rows.map((r) => ({
    ...r,
    total_input: Number(r.total_input),
    total_output: Number(r.total_output),
    total: Number(r.total),
  }));
}

// ── Recent events for a session ──

export async function getSessionEvents(
  sessionId: string,
  limit = 100
): Promise<UsageEvent[]> {
  const { rows } = await pool.query(
    `
    SELECT * FROM usage_events
    WHERE session_id = $1
    ORDER BY ts DESC
    LIMIT $2
  `,
    [sessionId, limit]
  );
  return rows;
}

// ── Daily usage (last 30 days) for trends ──

export async function getDailyUsage(): Promise<
  { day: string; input_tokens: number; output_tokens: number; total: number }[]
> {
  const { rows } = await pool.query(`
    WITH days AS (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        '1 day'
      )::date AS day
    )
    SELECT
      d.day::text,
      COALESCE(SUM(e.input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(e.output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(e.input_tokens + e.output_tokens + e.cache_read_tokens), 0)::bigint AS total
    FROM days d
    LEFT JOIN usage_events e
      ON e.ts::date = d.day
    GROUP BY d.day
    ORDER BY d.day
  `);
  return rows.map((r) => ({
    ...r,
    input_tokens: Number(r.input_tokens),
    output_tokens: Number(r.output_tokens),
    total: Number(r.total),
  }));
}

// ── Upsert session from hook or ingestion ──

export async function upsertSession(params: {
  session_id: string;
  project_name?: string | null;
  cwd?: string | null;
  git_branch?: string | null;
  model?: string | null;
}): Promise<void> {
  await pool.query(
    `
    INSERT INTO sessions (session_id, project_name, cwd, git_branch, model)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (session_id) DO UPDATE SET
      project_name = COALESCE(EXCLUDED.project_name, sessions.project_name),
      cwd = COALESCE(EXCLUDED.cwd, sessions.cwd),
      git_branch = COALESCE(EXCLUDED.git_branch, sessions.git_branch),
      model = COALESCE(EXCLUDED.model, sessions.model),
      last_seen = NOW()
  `,
    [
      params.session_id,
      params.project_name ?? null,
      params.cwd ?? null,
      params.git_branch ?? null,
      params.model ?? null,
    ]
  );
}

// ── Insert usage event and update session totals ──

export async function insertUsageEvent(params: {
  session_id: string;
  model?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  span_name?: string | null;
  trace_id?: string | null;
  span_id?: string | null;
  ts?: Date;
  raw_attributes?: Record<string, unknown> | null;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO usage_events
        (session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_create_tokens,
         span_name, trace_id, span_id, ts, raw_attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        params.session_id,
        params.model ?? null,
        params.input_tokens,
        params.output_tokens,
        params.cache_read_tokens,
        params.cache_create_tokens,
        params.span_name ?? null,
        params.trace_id ?? null,
        params.span_id ?? null,
        params.ts ?? new Date(),
        params.raw_attributes ? JSON.stringify(params.raw_attributes) : null,
      ]
    );

    // Update session totals
    await client.query(
      `UPDATE sessions SET
        total_input_tokens = total_input_tokens + $2,
        total_output_tokens = total_output_tokens + $3,
        total_cache_read_tokens = total_cache_read_tokens + $4,
        total_cache_create_tokens = total_cache_create_tokens + $5,
        model = COALESCE($6, model),
        last_seen = NOW(),
        is_active = TRUE
       WHERE session_id = $1`,
      [
        params.session_id,
        params.input_tokens,
        params.output_tokens,
        params.cache_read_tokens,
        params.cache_create_tokens,
        params.model ?? null,
      ]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Insert session snapshot ──

export async function insertSnapshot(params: {
  session_id: string;
  total_input_tokens?: number | null;
  total_output_tokens?: number | null;
  cwd?: string | null;
  git_branch?: string | null;
  project_name?: string | null;
  event_type?: string | null;
  raw_payload?: Record<string, unknown> | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO session_snapshots
      (session_id, total_input_tokens, total_output_tokens, cwd, git_branch, project_name, event_type, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      params.session_id,
      params.total_input_tokens ?? null,
      params.total_output_tokens ?? null,
      params.cwd ?? null,
      params.git_branch ?? null,
      params.project_name ?? null,
      params.event_type ?? null,
      params.raw_payload ? JSON.stringify(params.raw_payload) : null,
    ]
  );
}
