-- Enriched articles table for LLM-generated content
CREATE TABLE IF NOT EXISTS enriched_articles (
  article_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  what_changed TEXT,
  so_what TEXT,
  why_it_matters TEXT,
  model_used TEXT,
  prompt_version TEXT NOT NULL DEFAULT '1.0',
  generated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_enriched_articles_event_id ON enriched_articles(event_id);
