CREATE INDEX IF NOT EXISTS idx_change_events_published_at ON change_events (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_events_platform ON change_events (platform, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_events_event_type ON change_events (event_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_events_severity ON change_events (severity, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_events_canonical_url ON change_events (canonical_url);
CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags (tag);
CREATE INDEX IF NOT EXISTS idx_fetch_artifacts_run ON fetch_artifacts (run_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_cursor_state_source ON cursor_state (source_id, target_id);
