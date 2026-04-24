import pool from "./db";
import type {
  OverviewStats,
  HourlyUsage,
  ActiveSession,
  ProjectUsage,
  UsageEvent,
} from "./types";
import type { RowDataPacket } from "mysql2";

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
    tokens_today: today.total,
    tokens_this_week: week.total,
    active_sessions: active,
    tokens_by_model: byModel,
    rolling_5h_total: rolling.total,
    cache_read_today: today.cache_read,
    cache_read_this_week: week.cache_read,
    cache_read_5h: rolling.cache_read,
  };
}

export async function getTokensToday(): Promise<{ total: number; cache_read: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(input_tokens + output_tokens), 0) AS total,
      COALESCE(SUM(cache_read_tokens), 0) AS cache_read
    FROM usage_events
    WHERE ts >= CURDATE()
  `);
  return { total: Number(rows[0].total), cache_read: Number(rows[0].cache_read) };
}

export async function getTokensThisWeek(): Promise<{ total: number; cache_read: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(input_tokens + output_tokens), 0) AS total,
      COALESCE(SUM(cache_read_tokens), 0) AS cache_read
    FROM usage_events
    WHERE ts >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
  `);
  return { total: Number(rows[0].total), cache_read: Number(rows[0].cache_read) };
}

export async function getActiveSessionCount(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT COUNT(*) AS count
    FROM sessions
    WHERE is_active = 1
      AND last_seen > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
  `);
  return Number(rows[0].count);
}

export async function getTokensByModel(): Promise<
  { model: string; total: number }[]
> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT COALESCE(model, 'unknown') AS model,
           SUM(input_tokens + output_tokens) AS total
    FROM usage_events
    WHERE ts >= CURDATE()
    GROUP BY model
    ORDER BY total DESC
  `);
  return (rows as RowDataPacket[]).map((r) => ({ model: r.model, total: Number(r.total) }));
}

export async function getRolling5hTotal(): Promise<{ total: number; cache_read: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(SUM(input_tokens + output_tokens), 0) AS total,
      COALESCE(SUM(cache_read_tokens), 0) AS cache_read
    FROM usage_events
    WHERE ts >= DATE_SUB(NOW(), INTERVAL 5 HOUR)
  `);
  return { total: Number(rows[0].total), cache_read: Number(rows[0].cache_read) };
}

// ── Hourly usage (last 24h) ──

export async function getHourlyUsage(): Promise<HourlyUsage[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    WITH RECURSIVE hours AS (
      SELECT DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 23 HOUR), '%Y-%m-%d %H:00:00') AS hour
      UNION ALL
      SELECT DATE_ADD(hour, INTERVAL 1 HOUR)
      FROM hours
      WHERE hour < DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00')
    )
    SELECT
      h.hour,
      COALESCE(SUM(e.input_tokens), 0) AS input_tokens,
      COALESCE(SUM(e.output_tokens), 0) AS output_tokens,
      COALESCE(SUM(e.cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(e.input_tokens + e.output_tokens), 0) AS total
    FROM hours h
    LEFT JOIN usage_events e
      ON DATE_FORMAT(e.ts, '%Y-%m-%d %H:00:00') = h.hour
    GROUP BY h.hour
    ORDER BY h.hour
  `);
  return rows as HourlyUsage[];
}

// ── Active sessions ──

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
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
        WHEN TIMESTAMPDIFF(SECOND, s.first_seen, s.last_seen) > 60
        THEN FLOOR((s.total_input_tokens + s.total_output_tokens)
              / (TIMESTAMPDIFF(SECOND, s.first_seen, s.last_seen) / 3600.0))
        ELSE 0
      END AS burn_rate
    FROM sessions s
    WHERE s.is_active = 1
      AND s.last_seen > DATE_SUB(NOW(), INTERVAL 2 HOUR)
    ORDER BY s.last_seen DESC
  `);
  return (rows as RowDataPacket[]).map((r) => ({
    ...r,
    total_input_tokens: Number(r.total_input_tokens),
    total_output_tokens: Number(r.total_output_tokens),
    burn_rate: Number(r.burn_rate),
  })) as ActiveSession[];
}

// ── All sessions (recent) ──

export async function getRecentSessions(
  limit = 50
): Promise<ActiveSession[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
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
        WHEN TIMESTAMPDIFF(SECOND, s.first_seen, s.last_seen) > 60
        THEN FLOOR((s.total_input_tokens + s.total_output_tokens)
              / (TIMESTAMPDIFF(SECOND, s.first_seen, s.last_seen) / 3600.0))
        ELSE 0
      END AS burn_rate
    FROM sessions s
    ORDER BY s.last_seen DESC
    LIMIT ?
  `,
    [limit]
  );
  return (rows as RowDataPacket[]).map((r) => ({
    ...r,
    total_input_tokens: Number(r.total_input_tokens),
    total_output_tokens: Number(r.total_output_tokens),
    burn_rate: Number(r.burn_rate),
  })) as ActiveSession[];
}

// ── Per-project usage ──

export async function getProjectUsage(): Promise<ProjectUsage[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE(s.project_name, s.cwd, 'unknown') AS project_name,
      SUM(s.total_input_tokens) AS total_input,
      SUM(s.total_output_tokens) AS total_output,
      SUM(s.total_input_tokens + s.total_output_tokens) AS total,
      COUNT(DISTINCT s.session_id) AS session_count
    FROM sessions s
    GROUP BY COALESCE(s.project_name, s.cwd, 'unknown')
    ORDER BY total DESC
  `);
  return (rows as RowDataPacket[]).map((r) => ({
    ...r,
    total_input: Number(r.total_input),
    total_output: Number(r.total_output),
    total: Number(r.total),
  })) as ProjectUsage[];
}

// ── Recent events for a session ──

export async function getSessionEvents(
  sessionId: string,
  limit = 100
): Promise<UsageEvent[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT * FROM usage_events
    WHERE session_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `,
    [sessionId, limit]
  );
  return rows as UsageEvent[];
}

// ── Daily usage (last 30 days) for trends ──

export async function getDailyUsage(): Promise<
  { day: string; input_tokens: number; output_tokens: number; total: number }[]
> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    WITH RECURSIVE days AS (
      SELECT CURDATE() - INTERVAL 29 DAY AS day
      UNION ALL
      SELECT day + INTERVAL 1 DAY
      FROM days
      WHERE day < CURDATE()
    )
    SELECT
      CAST(d.day AS CHAR) AS day,
      COALESCE(SUM(e.input_tokens), 0) AS input_tokens,
      COALESCE(SUM(e.output_tokens), 0) AS output_tokens,
      COALESCE(SUM(e.input_tokens + e.output_tokens), 0) AS total
    FROM days d
    LEFT JOIN usage_events e
      ON DATE(e.ts) = d.day
    GROUP BY d.day
    ORDER BY d.day
  `);
  return (rows as RowDataPacket[]).map((r) => ({
    day: String(r.day),
    input_tokens: Number(r.input_tokens),
    output_tokens: Number(r.output_tokens),
    total: Number(r.total),
  }));
}

// ── Per-project token timeline (hourly, last 7 days) ──

export async function getProjectTimeline(
  projectName: string
): Promise<
  { hour: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; total: number }[]
> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    WITH RECURSIVE hours AS (
      SELECT DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 7 DAY), '%Y-%m-%d %H:00:00') AS hour
      UNION ALL
      SELECT DATE_ADD(hour, INTERVAL 1 HOUR)
      FROM hours
      WHERE hour < DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00')
    )
    SELECT
      h.hour,
      COALESCE(SUM(e.input_tokens), 0) AS input_tokens,
      COALESCE(SUM(e.output_tokens), 0) AS output_tokens,
      COALESCE(SUM(e.cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(e.input_tokens + e.output_tokens), 0) AS total
    FROM hours h
    LEFT JOIN usage_events e
      ON DATE_FORMAT(e.ts, '%Y-%m-%d %H:00:00') = h.hour
      AND e.session_id IN (
        SELECT session_id FROM sessions
        WHERE COALESCE(project_name, cwd, 'unknown') = ?
      )
    GROUP BY h.hour
    ORDER BY h.hour
  `,
    [projectName]
  );
  return rows as { hour: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; total: number }[];
}

// ── GitHub activity for a project (last 7 days) ──

export async function getProjectGitHubActivity(
  projectName: string
): Promise<{
  commits: { sha: string; message: string; author: string; committed_at: string }[];
  prs: { number: number; title: string; state: string; author: string; opened_at: string | null; merged_at: string | null }[];
}> {
  const [commits] = await pool.query<RowDataPacket[]>(
    `SELECT sha, message, author, committed_at
     FROM github_commits
     WHERE project_name = ? AND committed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY committed_at`,
    [projectName]
  );

  const [prs] = await pool.query<RowDataPacket[]>(
    `SELECT number, title, state, author, opened_at, merged_at
     FROM github_prs
     WHERE project_name = ?
       AND (opened_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            OR merged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
     ORDER BY COALESCE(merged_at, opened_at)`,
    [projectName]
  );

  return {
    commits: commits as { sha: string; message: string; author: string; committed_at: string }[],
    prs: prs as { number: number; title: string; state: string; author: string; opened_at: string | null; merged_at: string | null }[],
  };
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
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      project_name = COALESCE(VALUES(project_name), project_name),
      cwd = COALESCE(VALUES(cwd), cwd),
      git_branch = COALESCE(VALUES(git_branch), git_branch),
      model = COALESCE(VALUES(model), model),
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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO usage_events
        (session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_create_tokens,
         span_name, trace_id, span_id, ts, raw_attributes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
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
    await conn.query(
      `UPDATE sessions SET
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?,
        total_cache_read_tokens = total_cache_read_tokens + ?,
        total_cache_create_tokens = total_cache_create_tokens + ?,
        model = COALESCE(?, model),
        last_seen = NOW(),
        is_active = 1
       WHERE session_id = ?`,
      [
        params.input_tokens,
        params.output_tokens,
        params.cache_read_tokens,
        params.cache_create_tokens,
        params.model ?? null,
        params.session_id,
      ]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
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
     VALUES (?,?,?,?,?,?,?,?)`,
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
