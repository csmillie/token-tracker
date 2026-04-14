"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = {
  input: "#6366f1",
  output: "#22c55e",
  cache: "#f59e0b",
  total: "#8b5cf6",
};

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

interface HourlyData {
  hour: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  total: number;
}

export function HourlyChart({ data }: { data: HourlyData[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.hour).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        Hourly Token Usage (24h)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            fontSize={11}
            interval="preserveStartEnd"
          />
          <YAxis stroke="#64748b" fontSize={11} tickFormatter={formatK} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1d27",
              border: "1px solid #2e3345",
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: 12,
            }}
            formatter={(v: number) => v.toLocaleString()}
          />
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
          <Line
            type="monotone"
            dataKey="cache_read_tokens"
            stroke={COLORS.cache}
            name="Cache Read"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ModelData {
  model: string;
  total: number;
}

export function ModelChart({ data }: { data: ModelData[] }) {
  const formatted = data.map((d) => ({
    ...d,
    short: d.model.replace(/^claude-/, "").replace(/-\d{8}$/, ""),
  }));

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        Tokens by Model (Today)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={formatted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" />
          <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={formatK} />
          <YAxis
            type="category"
            dataKey="short"
            stroke="#64748b"
            fontSize={11}
            width={120}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1d27",
              border: "1px solid #2e3345",
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: 12,
            }}
            formatter={(v: number) => v.toLocaleString()}
          />
          <Bar dataKey="total" fill={COLORS.total} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ProjectData {
  project_name: string;
  total: number;
  total_input: number;
  total_output: number;
}

export function ProjectChart({ data }: { data: ProjectData[] }) {
  const top = data.slice(0, 10);

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        Tokens by Project
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={top} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" />
          <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={formatK} />
          <YAxis
            type="category"
            dataKey="project_name"
            stroke="#64748b"
            fontSize={11}
            width={140}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1d27",
              border: "1px solid #2e3345",
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: 12,
            }}
            formatter={(v: number) => v.toLocaleString()}
          />
          <Legend />
          <Bar
            dataKey="total_input"
            fill={COLORS.input}
            name="Input"
            stackId="a"
          />
          <Bar
            dataKey="total_output"
            fill={COLORS.output}
            name="Output"
            stackId="a"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DailyData {
  day: string;
  input_tokens: number;
  output_tokens: number;
  total: number;
}

export function DailyChart({ data }: { data: DailyData[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.day).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        Daily Token Usage (30d)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            fontSize={11}
            interval="preserveStartEnd"
          />
          <YAxis stroke="#64748b" fontSize={11} tickFormatter={formatK} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1d27",
              border: "1px solid #2e3345",
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: 12,
            }}
            formatter={(v: number) => v.toLocaleString()}
          />
          <Legend />
          <Bar
            dataKey="input_tokens"
            fill={COLORS.input}
            name="Input"
            stackId="a"
          />
          <Bar
            dataKey="output_tokens"
            fill={COLORS.output}
            name="Output"
            stackId="a"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
