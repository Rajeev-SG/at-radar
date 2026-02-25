CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  surface TEXT NOT NULL,
  strategy TEXT NOT NULL,
  config_json TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  loaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS fetch_runs (
  run_id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  total_sources INTEGER NOT NULL DEFAULT 0,
  total_events INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_json TEXT
);

CREATE TABLE IF NOT EXISTS fetch_artifacts (
  artifact_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT,
  request_url TEXT NOT NULL,
  status_code INTEGER,
  etag TEXT,
  last_modified TEXT,
  fetched_at TEXT NOT NULL,
  body_hash TEXT,
  body_text TEXT,
  truncated INTEGER NOT NULL DEFAULT 0,
  headers_json TEXT,
  FOREIGN KEY(run_id) REFERENCES fetch_runs(run_id)
);

CREATE TABLE IF NOT EXISTS change_events (
  event_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  surface TEXT NOT NULL,
  event_type TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_at_inferred INTEGER NOT NULL DEFAULT 0,
  effective_at TEXT,
  title TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_excerpt TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  versions_affected_json TEXT,
  entities_affected_json TEXT,
  labels_json TEXT,
  severity TEXT,
  diff_json TEXT,
  artifact_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(source_id, canonical_url, published_at)
);

CREATE TABLE IF NOT EXISTS event_tags (
  event_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (event_id, tag),
  FOREIGN KEY(event_id) REFERENCES change_events(event_id)
);

CREATE TABLE IF NOT EXISTS event_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  rel TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  UNIQUE(event_id, rel, url)
);

CREATE TABLE IF NOT EXISTS cursor_state (
  source_cursor_key TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT,
  last_seen_published_at TEXT,
  etag TEXT,
  last_modified TEXT,
  last_hash TEXT,
  last_body_text TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
