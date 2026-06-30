CREATE TABLE IF NOT EXISTS traffic_breakdowns (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'requests',
  source TEXT NOT NULL DEFAULT 'real',
  helper TEXT,
  date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_breakdowns_scope
ON traffic_breakdowns (scope_type, scope_id, kind, date);

CREATE TABLE IF NOT EXISTS page_events (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  device TEXT,
  event_name TEXT NOT NULL DEFAULT 'pageview',
  session_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_events_domain_created
ON page_events (domain, created_at);

CREATE INDEX IF NOT EXISTS idx_page_events_path
ON page_events (domain, path, created_at);
