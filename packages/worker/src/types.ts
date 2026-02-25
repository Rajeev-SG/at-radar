export type Surface = 'api' | 'ui' | 'docs' | 'policy' | 'status';
export type Strategy = 'rss' | 'html_list' | 'html_fingerprint' | 'json_feed';
export type EventType =
  | 'release'
  | 'deprecation'
  | 'breaking_change'
  | 'bugfix'
  | 'docs_update'
  | 'policy_update'
  | 'outage';
export type Severity = 'low' | 'medium' | 'high';

export interface SourceTarget {
  id: string;
  url: string;
  label?: string;
}

export interface SourceConfig {
  source_id: string;
  platform: string;
  surface: Surface;
  strategy: Strategy;
  request: {
    url: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
    targets?: SourceTarget[];
  };
  parse: Record<string, unknown>;
  rate_limit: {
    min_seconds_between_fetches: number;
    max_items_per_run: number;
  };
  cursor: {
    type: 'published_at' | 'etag_last_modified' | 'content_hash';
  };
  tags: string[];
  rules?: Array<Record<string, unknown>>;
}

export interface TaxonomyRule {
  pattern: string;
  add_tags?: string[];
  severity?: Severity;
  event_type?: EventType;
}

export interface TaxonomyConfig {
  tags: string[];
  rules: TaxonomyRule[];
  platform_rules?: Record<string, TaxonomyRule[]>;
}

export interface NormalizationConfig {
  summary: { max_chars: number; strip_html: boolean };
  raw_excerpt: { max_chars: number };
  fingerprint: { algorithm: string };
  published_at: { allow_inferred: boolean };
  severity_defaults: Record<string, string>;
}

export interface UiConfigPage {
  id: string;
  label: string;
  path: string;
  type: string;
  description?: string;
  filters?: Record<string, string>;
}

export interface UiConfig {
  brand: { title: string; subtitle: string };
  pages: UiConfigPage[];
}

export interface ConfigBundle {
  sources: SourceConfig[];
  taxonomy: TaxonomyConfig;
  normalization: NormalizationConfig;
  ui: UiConfig;
}

export interface CandidateEvent {
  source_id: string;
  platform: string;
  surface: Surface;
  event_type?: EventType;
  title: string;
  canonical_url: string;
  published_at?: string;
  effective_at?: string;
  summary?: string;
  raw_excerpt?: string;
  content_text?: string;
  target_id?: string;
  labels?: string[];
  versions_affected?: string[];
  entities_affected?: string[];
  diff?: unknown;
}

export interface ChangeEvent {
  event_id: string;
  source_id: string;
  platform: string;
  surface: Surface;
  event_type: EventType;
  published_at: string;
  published_at_inferred?: boolean;
  effective_at?: string | null;
  title: string;
  canonical_url: string;
  summary: string;
  raw_excerpt: string;
  fingerprint: string;
  versions_affected?: string[];
  entities_affected?: string[];
  labels?: string[];
  severity?: Severity;
  diff?: unknown;
  artifact_id?: string | null;
}

export interface ParsedArtifact {
  requestUrl: string;
  statusCode: number;
  etag?: string | null;
  lastModified?: string | null;
  bodyText: string;
  headers: Record<string, string>;
  fetchedAt: string;
  targetId?: string;
}

export interface SourceCursorState {
  source_cursor_key: string;
  source_id: string;
  target_id?: string | null;
  last_seen_published_at?: string | null;
  etag?: string | null;
  last_modified?: string | null;
  last_hash?: string | null;
  last_body_text?: string | null;
  updated_at?: string;
}

export interface RunSummary {
  runId: string;
  totalSources: number;
  totalEvents: number;
  errorCount: number;
  errors: Array<{ source_id: string; message: string }>;
}

export interface PreparedLike {
  bind(...values: unknown[]): PreparedLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; changes?: number }>;
}

export interface D1Like {
  prepare(sql: string): PreparedLike;
}
