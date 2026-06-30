CREATE TABLE IF NOT EXISTS projects (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  default_domain TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS domains (
  domain TEXT PRIMARY KEY,
  cloudflare_zone_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT,
  requests INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  bytes_mib REAL NOT NULL DEFAULT 0,
  threats INTEGER NOT NULL DEFAULT 0,
  top_day TEXT,
  hostnames_json TEXT NOT NULL DEFAULT '[]',
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS hostnames (
  hostname TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  project_key TEXT NOT NULL DEFAULT 'uncategorized',
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'cloudflare',
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  project_key TEXT NOT NULL DEFAULT 'uncategorized',
  domain TEXT,
  hostnames_json TEXT NOT NULL DEFAULT '[]',
  shared INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS resource_bindings (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT 'uses'
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  range TEXT NOT NULL,
  date TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  resource_id TEXT,
  source TEXT NOT NULL DEFAULT 'real'
);

CREATE TABLE IF NOT EXISTS connectors (
  platform TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  real INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  message TEXT
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  connector TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  message TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  scope_type TEXT NOT NULL DEFAULT 'global',
  scope_id TEXT NOT NULL DEFAULT 'global',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metric_scope ON metric_snapshots (scope_type, scope_id, metric_key, date);
CREATE INDEX IF NOT EXISTS idx_resources_project ON resources (project_key);
CREATE INDEX IF NOT EXISTS idx_resources_domain ON resources (domain);
CREATE INDEX IF NOT EXISTS idx_alerts_scope_status ON alerts (scope_type, scope_id, status);
