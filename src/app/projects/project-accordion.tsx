"use client";

import { useState } from "react";
import type { ProjectUsage } from "@/lib/types";
import { ProjectTimelineChart } from "./project-timeline-chart";

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

export function ProjectAccordion({ project }: { project: ProjectUsage }) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelinePoint[] | null>(null);
  const [github, setGitHub] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);

    if (!timeline) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/timeline?project=${encodeURIComponent(project.project_name)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch");
        setTimeline(data.timeline);
        setGitHub(data.github ?? null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-overlay transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text-primary font-medium">
            {project.project_name}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm tabular-nums">
          <span className="text-text-secondary">
            <span className="text-text-muted mr-1">In:</span>
            {project.total_input.toLocaleString()}
          </span>
          <span className="text-text-secondary">
            <span className="text-text-muted mr-1">Out:</span>
            {project.total_output.toLocaleString()}
          </span>
          <span className="text-text-primary font-medium">
            {project.total.toLocaleString()}
          </span>
          <span className="text-text-muted">
            {project.session_count} session{project.session_count !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4">
          {loading && (
            <div className="text-center text-text-muted py-8 text-sm">
              Loading timeline...
            </div>
          )}
          {error && (
            <div className="text-center text-red py-4 text-sm">{error}</div>
          )}
          {timeline && <ProjectTimelineChart data={timeline} github={github} />}
        </div>
      )}
    </div>
  );
}
