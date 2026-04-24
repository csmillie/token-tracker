-- GitHub repo mapping and activity sync

CREATE TABLE IF NOT EXISTS project_repos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  project_name    VARCHAR(255) NOT NULL UNIQUE,
  github_owner    VARCHAR(255) NOT NULL,
  github_repo     VARCHAR(255) NOT NULL,
  cwd             TEXT,
  last_synced     DATETIME,

  INDEX idx_project_repos_name (project_name)
);

CREATE TABLE IF NOT EXISTS github_commits (
  sha             VARCHAR(40) PRIMARY KEY,
  project_name    VARCHAR(255) NOT NULL,
  author          VARCHAR(255),
  message         TEXT,
  committed_at    DATETIME NOT NULL,

  INDEX idx_github_commits_project (project_name),
  INDEX idx_github_commits_ts (committed_at),
  INDEX idx_github_commits_project_ts (project_name, committed_at)
);

CREATE TABLE IF NOT EXISTS github_prs (
  id              BIGINT PRIMARY KEY,
  project_name    VARCHAR(255) NOT NULL,
  number          INT NOT NULL,
  title           TEXT,
  state           VARCHAR(50),
  author          VARCHAR(255),
  opened_at       DATETIME,
  merged_at       DATETIME,
  closed_at       DATETIME,

  INDEX idx_github_prs_project (project_name),
  INDEX idx_github_prs_project_ts (project_name, opened_at)
);
