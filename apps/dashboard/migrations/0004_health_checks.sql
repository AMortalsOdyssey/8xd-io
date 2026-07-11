CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  project_key TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down')),
  http_status INTEGER NOT NULL DEFAULT 0,
  response_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_check_runs (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down')),
  http_status INTEGER NOT NULL DEFAULT 0,
  response_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_checks_project
ON health_checks (project_key, status);

CREATE INDEX IF NOT EXISTS idx_health_check_runs_target_checked
ON health_check_runs (target_id, checked_at DESC);
