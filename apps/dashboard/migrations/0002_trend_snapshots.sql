CREATE TABLE IF NOT EXISTS trend_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  scope_type TEXT NOT NULL DEFAULT 'global',
  scope_id TEXT NOT NULL DEFAULT 'global',
  source TEXT NOT NULL DEFAULT 'real'
);

CREATE INDEX IF NOT EXISTS idx_trend_scope_date ON trend_snapshots (scope_type, scope_id, date);
