"use client";

import { useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

const COLORS = {
  input: "#6366f1",
  output: "#22c55e",
  cache: "#f59e0b",
  commit: "#94a3b8",
  prOpened: "#3b82f6",
  prMerged: "#a855f7",
};

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatLabel(dt: Date): string {
  return (
    dt.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// Snap a timestamp to the nearest hour label in the data
function snapToHour(ts: string, labelMap: Map<string, string>): string | null {
  const dt = new Date(ts);
  const hourKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:00:00`;
  return labelMap.get(hourKey) ?? null;
}

interface TimelinePoint {
  hour: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  total: number;
}

interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  committed_at: string;
}

interface GitHubPR {
  number: number;
  title: string;
  state: string;
  author: string;
  opened_at: string | null;
  merged_at: string | null;
}

interface GitHubData {
  commits: GitHubCommit[];
  prs: GitHubPR[];
}

interface Props {
  data: TimelinePoint[];
  github?: GitHubData | null;
}

interface EventMarker {
  label: string;
  type: "commit" | "pr-opened" | "pr-merged";
  description: string;
}

export function ProjectTimelineChart({ data, github }: Props) {
  const [showCache, setShowCache] = useState(false);
  const [showGitHub, setShowGitHub] = useState(true);

  const hasActivity = data.some(
    (d) => d.input_tokens > 0 || d.output_tokens > 0 || d.cache_read_tokens > 0
  );

  // Build label map: hour string -> display label
  const labelMap = new Map<string, string>();
  const formatted = data.map((d) => {
    const dt = new Date(d.hour);
    const lbl = formatLabel(dt);
    // Normalize the hour key for matching
    const hourKey = d.hour.replace("T", " ").replace(/\.\d+Z$/, "").slice(0, 19);
    labelMap.set(hourKey, lbl);
    return {
      input_tokens: d.input_tokens || null,
      output_tokens: d.output_tokens || null,
      cache_read_tokens: d.cache_read_tokens || null,
      label: lbl,
    };
  });

  // Build event markers from GitHub data
  const eventsByLabel = new Map<string, EventMarker[]>();
  if (github && showGitHub) {
    for (const c of github.commits) {
      const lbl = snapToHour(c.committed_at, labelMap);
      if (!lbl) continue;
      const existing = eventsByLabel.get(lbl) || [];
      existing.push({
        label: lbl,
        type: "commit",
        description: c.message.split("\n")[0].slice(0, 80),
      });
      eventsByLabel.set(lbl, existing);
    }
    for (const pr of github.prs) {
      if (pr.opened_at) {
        const lbl = snapToHour(pr.opened_at, labelMap);
        if (lbl) {
          const existing = eventsByLabel.get(lbl) || [];
          existing.push({
            label: lbl,
            type: "pr-opened",
            description: `PR #${pr.number}: ${pr.title?.slice(0, 70)}`,
          });
          eventsByLabel.set(lbl, existing);
        }
      }
      if (pr.merged_at) {
        const lbl = snapToHour(pr.merged_at, labelMap);
        if (lbl) {
          const existing = eventsByLabel.get(lbl) || [];
          existing.push({
            label: lbl,
            type: "pr-merged",
            description: `Merged PR #${pr.number}: ${pr.title?.slice(0, 70)}`,
          });
          eventsByLabel.set(lbl, existing);
        }
      }
    }
  }

  // Deduplicate reference line positions
  const markerLabels = Array.from(eventsByLabel.keys());

  if (!hasActivity && markerLabels.length === 0) {
    return (
      <div className="text-center text-text-muted py-8 text-sm">
        No activity in the last 7 days.
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) =>
      showCache
        ? Math.max(d.input_tokens, d.output_tokens, d.cache_read_tokens)
        : Math.max(d.input_tokens, d.output_tokens)
    ),
    1
  );

  const hasGitHubData = github && (github.commits.length > 0 || github.prs.length > 0);

  // Custom tooltip that includes GitHub events
  const CustomTooltip = useCallback(
    ({ active, payload, label: tooltipLabel }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
      if (!active || !tooltipLabel) return null;
      const events = eventsByLabel.get(tooltipLabel as string);
      return (
        <div
          style={{
            backgroundColor: "#1a1d27",
            border: "1px solid #2e3345",
            borderRadius: "6px",
            color: "#e2e8f0",
            fontSize: 12,
            padding: "8px 12px",
            maxWidth: 320,
          }}
        >
          <p style={{ marginBottom: 4, color: "#94a3b8" }}>{tooltipLabel}</p>
          {payload?.map((p, i) => (
            p.value != null && (
              <p key={i} style={{ color: p.color, margin: "2px 0" }}>
                {p.name}: {p.value.toLocaleString()}
              </p>
            )
          ))}
          {events && events.length > 0 && (
            <div style={{ borderTop: "1px solid #2e3345", marginTop: 6, paddingTop: 6 }}>
              {events.map((e, i) => (
                <p
                  key={i}
                  style={{
                    margin: "2px 0",
                    color:
                      e.type === "commit"
                        ? COLORS.commit
                        : e.type === "pr-merged"
                          ? COLORS.prMerged
                          : COLORS.prOpened,
                    fontSize: 11,
                  }}
                >
                  {e.type === "commit" ? "⦿" : e.type === "pr-merged" ? "⬥" : "◇"}{" "}
                  {e.description}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    },
    [eventsByLabel]
  );

  return (
    <div>
      <div className="flex justify-end gap-4 mb-3">
        {hasGitHubData && (
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showGitHub}
              onChange={(e) => setShowGitHub(e.target.checked)}
              className="rounded border-border"
            />
            Show commits & PRs
          </label>
        )}
        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCache}
            onChange={(e) => setShowCache(e.target.checked)}
            className="rounded border-border"
          />
          Show cache read
        </label>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            fontSize={10}
            interval="preserveStartEnd"
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickFormatter={formatK}
            domain={[0, Math.ceil(maxVal * 1.1)]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="input_tokens"
            stroke={COLORS.input}
            name="Input"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="output_tokens"
            stroke={COLORS.output}
            name="Output"
            strokeWidth={2}
            dot={false}
          />
          {showCache && (
            <Line
              type="monotone"
              dataKey="cache_read_tokens"
              stroke={COLORS.cache}
              name="Cache Read"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          )}
          {showGitHub &&
            markerLabels.map((lbl) => {
              const events = eventsByLabel.get(lbl)!;
              const hasPR = events.some((e) => e.type !== "commit");
              const hasMerge = events.some((e) => e.type === "pr-merged");
              return (
                <ReferenceLine
                  key={lbl}
                  x={lbl}
                  stroke={
                    hasMerge
                      ? COLORS.prMerged
                      : hasPR
                        ? COLORS.prOpened
                        : COLORS.commit
                  }
                  strokeDasharray={hasPR ? undefined : "3 3"}
                  strokeWidth={hasPR ? 1.5 : 1}
                  opacity={0.7}
                />
              );
            })}
        </LineChart>
      </ResponsiveContainer>
      {hasGitHubData && showGitHub && (
        <div className="flex gap-4 mt-2 text-xs text-text-muted justify-end">
          <span className="flex items-center gap-1">
            <span style={{ color: COLORS.commit }}>┊</span> commit
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: COLORS.prOpened }}>│</span> PR opened
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: COLORS.prMerged }}>│</span> PR merged
          </span>
        </div>
      )}
    </div>
  );
}
