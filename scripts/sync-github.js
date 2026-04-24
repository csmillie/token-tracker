#!/usr/bin/env node

// Syncs commits and PRs from GitHub for all mapped projects.
// Uses `gh` CLI (must be authenticated).
// Run daily via cron or manually: node scripts/sync-github.js

const { execSync } = require("child_process");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_DATABASE || "tokentracker",
  user: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "",
};

function gh(args) {
  try {
    const out = execSync(`gh ${args}`, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(out);
  } catch (e) {
    console.error(`  gh ${args} failed:`, e.message);
    return null;
  }
}

async function syncProject(pool, project) {
  const { project_name, github_owner, github_repo } = project;
  const repo = `${github_owner}/${github_repo}`;
  console.log(`Syncing ${project_name} (${repo})...`);

  // Fetch commits from last 30 days
  const commits = gh(
    `api repos/${repo}/commits --paginate -q '.[]' --jq '.' --method GET -f since=$(date -v-30d +%Y-%m-%dT00:00:00Z) -f per_page=100 2>/dev/null || true`
  );

  // Use gh api directly for better control
  const commitData = gh(
    `api "repos/${repo}/commits?since=$(date -v-30d +%Y-%m-%dT00:00:00Z)&per_page=100" 2>/dev/null`
  );

  if (commitData && Array.isArray(commitData)) {
    let inserted = 0;
    for (const c of commitData) {
      const sha = c.sha;
      const author = c.author?.login || c.commit?.author?.name || "unknown";
      const message = c.commit?.message || "";
      const committedAt = c.commit?.committer?.date || c.commit?.author?.date;
      if (!committedAt) continue;

      await pool.query(
        `INSERT INTO github_commits (sha, project_name, author, message, committed_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE message=VALUES(message)`,
        [sha, project_name, author, message, new Date(committedAt)]
      );
      inserted++;
    }
    console.log(`  ${inserted} commits`);
  }

  // Fetch PRs updated in last 30 days
  const prData = gh(
    `api "repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=50"`
  );

  if (prData && Array.isArray(prData)) {
    let inserted = 0;
    for (const pr of prData) {
      await pool.query(
        `INSERT INTO github_prs (id, project_name, number, title, state, author, opened_at, merged_at, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title=VALUES(title), state=VALUES(state),
           merged_at=VALUES(merged_at), closed_at=VALUES(closed_at)`,
        [
          pr.id,
          project_name,
          pr.number,
          pr.title,
          pr.merged_at ? "merged" : pr.state,
          pr.user?.login || "unknown",
          pr.created_at ? new Date(pr.created_at) : null,
          pr.merged_at ? new Date(pr.merged_at) : null,
          pr.closed_at ? new Date(pr.closed_at) : null,
        ]
      );
      inserted++;
    }
    console.log(`  ${inserted} PRs`);
  }

  // Update last_synced
  await pool.query(
    "UPDATE project_repos SET last_synced = NOW() WHERE project_name = ?",
    [project_name]
  );
}

async function main() {
  const pool = await mysql.createPool(DB_CONFIG);

  try {
    const [projects] = await pool.query("SELECT * FROM project_repos");
    console.log(`Found ${projects.length} projects to sync\n`);

    for (const project of projects) {
      try {
        await syncProject(pool, project);
      } catch (e) {
        console.error(`  Error syncing ${project.project_name}:`, e.message);
      }
    }

    console.log("\nSync complete.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
