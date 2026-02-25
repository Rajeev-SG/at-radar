# GPT-5.3-Codex Build Spec — AdTech Change Radar (Config-as-Code)

## 0) Mission

Build a deployable system that continuously tracks **AdTech platform changes** (release notes, changelogs, docs updates, deprecations) and exposes them via:

1. **Normalized event database**
2. **Query API**
3. **Web UI** (filter/search/timeline/event detail + diff)
4. **Feeds** (RSS + JSON feed for subscriptions)
5. **Operational logs** (run history, errors, freshness SLOs)

**Default deployment: Cloudflare Workers + D1 + Pages** (free-friendly, CLI deploy, scheduled ingestion via Cron Triggers). Cloudflare supports Cron Triggers for scheduled handlers and D1 bindings via Wrangler config. ([Cloudflare Docs][2])

> Agent working style: implement in small increments; after each increment run tests; fix until all tests pass; only then proceed. This is a verification-first build (structural errors caught automatically). ([TheCognitect.ai][1])

---

## 1) Non-negotiable constraints

### 1.1 Config-as-code requirements (hard)

All system behavior must be driven by versioned config files (YAML/JSON/SQL), not hard-coded:

* **Sources** defined in YAML (`config/sources/*.yaml`)
* **Taxonomy/tag rules** defined in YAML (`config/taxonomy.yaml`)
* **Normalization mapping** defined in YAML (`config/normalization.yaml`)
* **UI pages/charts** defined in YAML (`config/ui.yaml`)
* **DB schema** defined as SQL migrations (`packages/worker/migrations/*.sql`)
* **Schedules** defined in `wrangler.toml` (source-of-truth for Cron Triggers; do not manage schedules elsewhere). ([Cloudflare Docs][3])

### 1.2 Thorough testing (hard)

Must include:

* Unit tests (parsers, normalizers, taggers, diffing)
* Contract tests per source (fixtures + expected parsed result)
* Integration tests (D1 migrations + end-to-end ingest on fixtures)
* E2E tests (Playwright against local worker + local UI)
* CI pipeline runs all tests on every PR + main

### 1.3 “Free / cheap” deploy (hard)

Must deploy via CLI with minimal prerequisites:

* Node.js + npm
* Cloudflare account + Wrangler (CLI)
* No paid services required for baseline

Cloudflare D1 Free tier has bounded storage/limits (e.g., 500MB DB size free; query limits per invocation). Design within these constraints. ([Cloudflare Docs][4])

---

## 2) Data sources (initial set to ship)

Ship with these **built-in** sources preconfigured (as YAML configs). Use official endpoints/pages.

### 2.1 Release notes / changelogs (must ship)

* Google Ads API release notes ([Google for Developers][5])
* Google Ads API blog announcements (version releases) ([Google Ads Developer Blog][6])
* Meta Marketing API changelog ([Meta for Developers][7])
* Meta Graph API changelog ([Meta for Developers][8])
* TikTok for Developers changelog ([developers.tiktok.com][9])
* Amazon Ads API release notes (and “All releases” index) ([Amazon Ads][10])
* Amazon Ads API deprecations page ([Amazon Ads][11])

### 2.2 Docs-change monitors (must ship)

Support “page fingerprint monitoring” for arbitrary docs pages (HTML → extracted main content → hash). Create “DocUpdate” events when hash changes.

### 2.3 Extensibility (must ship)

Add new source by adding a single YAML file + fixtures, without code changes (except adding a new parser plugin only if the strategy is truly new).

---

## 3) Canonical event model (the governed “semantic layer”)

Everything normalizes to a single schema: `ChangeEvent`.

### 3.1 ChangeEvent schema (logical)

Required:

* `event_id` (stable: hash of `source_id + canonical_url + published_at + title`)
* `source_id` (string, from config)
* `platform` (enum-ish string: google_ads | meta | tiktok | amazon_ads | etc.)
* `surface` (api | ui | docs | policy | status)
* `event_type` (release | deprecation | breaking_change | bugfix | docs_update | policy_update | outage)
* `published_at` (ISO 8601 UTC)
* `title`
* `canonical_url`
* `summary` (plain text; can be heuristic initially)
* `raw_excerpt` (small excerpt for preview)
* `fingerprint` (content hash for dedupe/change detection)

Optional:

* `effective_at` (when change takes effect)
* `versions_affected` (e.g., API version strings)
* `entities_affected` (array: endpoints/features/products)
* `labels` (array of strings: “privacy”, “measurement”, “attribution”, “audiences”, “creative”, “reporting”)
* `severity` (low|medium|high) computed via rules
* `diff` (for docs_update: unified diff or structured diff metadata)

### 3.2 Storage model (D1 tables)

Implement these tables via migrations:

* `sources` (from config snapshot; versioned)
* `fetch_runs` (each cron run)
* `fetch_artifacts` (raw HTTP response metadata + stored body, truncated where necessary)
* `change_events` (canonical)
* `event_tags` (many-to-many)
* `event_links` (for “See also”, cross-posted release notes)
* `cursor_state` (incremental per source: last_seen_published_at, etag, last_modified, last_hash)

Design note: D1 is SQLite-like; keep schemas simple and index for timeline queries. Respect D1 query duration constraints. ([Cloudflare Docs][4])

---

## 4) Architecture (Cloudflare-first)

### 4.1 Components

1. **Worker (API + Ingestor)**

   * HTTP API for UI + feeds
   * `scheduled()` handler for Cron ingestion ([Cloudflare Docs][2])
   * Uses **D1** for storage/bindings ([Cloudflare Docs][12])
2. **Pages (Web UI)**

   * Static build (Astro recommended) deployed via Wrangler “Direct Upload” ([Cloudflare Docs][13])
   * Calls Worker API

### 4.2 Why this matches config-as-code

* Worker behavior is driven by YAML configs (sources/taxonomy/ui)
* Infrastructure configuration is declared in `wrangler.toml` (cron triggers + bindings) and treated as source of truth ([Cloudflare Docs][3])
* Verification discipline is built-in: config parsing, schema validation, fixtures, and E2E tests catch structural failures early ([TheCognitect.ai][1])

---

## 5) Repository layout (monorepo)

Create exactly this structure:

```
adtech-change-radar/
  AGENT.md
  README.md
  Makefile
  .editorconfig
  .gitignore
  .env.example

  config/
    sources/
      google_ads_api.yaml
      google_ads_blog.yaml
      meta_marketing_api.yaml
      meta_graph_api.yaml
      tiktok_changelog.yaml
      amazon_ads_release_notes.yaml
      amazon_ads_deprecations.yaml
      docs_monitors.yaml
    taxonomy.yaml
    normalization.yaml
    ui.yaml

  packages/
    worker/
      wrangler.toml
      package.json
      tsconfig.json
      src/
        index.ts
        ingest/
          engine.ts
          http.ts
          strategies/
            rss.ts
            html_list.ts
            html_fingerprint.ts
            json_feed.ts
          normalize.ts
          tagger.ts
          diff.ts
          config.ts
          validate.ts
        api/
          routes.ts
          feeds.ts
          health.ts
        db/
          schema.ts
          migrations.ts
          queries.ts
      migrations/
        0001_init.sql
        0002_indexes.sql
      test/
        unit/
        contract/
        integration/
        e2e/
      fixtures/
        (frozen HTML/JSON payloads per source)

    web/
      package.json
      astro.config.mjs
      src/
        pages/
        components/
        lib/
          api.ts
          config.ts
      public/
      test/
        e2e/

  .github/
    workflows/
      ci.yml
```

---

## 6) Config schemas (must implement validation)

### 6.1 `config/sources/*.yaml` (source definition)

Each file defines one “source”.

Required fields:

* `source_id` (unique string)
* `platform` (string)
* `surface` (api|ui|docs|policy|status)
* `strategy` (rss|html_list|html_fingerprint|json_feed)
* `request`:

  * `url`
  * optional `headers`
  * optional `params`
* `parse`:

  * for `rss`: mapping for title/link/date/summary
  * for `html_list`: CSS selectors + extraction rules
  * for `html_fingerprint`: CSS selector for “main content” + ignore selectors
* `rate_limit`:

  * `min_seconds_between_fetches`
  * `max_items_per_run`
* `cursor`:

  * `type`: `published_at` | `etag_last_modified` | `content_hash`
* `tags` (default tags)
* `rules` (optional heuristics for severity/event_type)

### 6.2 `config/taxonomy.yaml` (tagging rules)

Define:

* tag dictionary
* regex rules mapping to tags/severity/event_type overrides
* platform-specific patterns (e.g., “deprecation”, “sunset”, “breaking”, “must upgrade”, “API version”)

### 6.3 `config/ui.yaml` (UI is config-driven)

Define pages like:

* Timeline (filters)
* Platform view
* Tag view
* “Breaking in next 90 days”
* “Docs changed this week”
* “Privacy/Consent changes”

The UI must render nav + sections from this file.

### 6.4 Validation

Implement a config validator that:

* parses all YAML
* validates against a JSON Schema (checked into repo)
* errors with actionable messages
* CI fails if invalid

---

## 7) Ingestion engine behavior (deterministic + testable)

### 7.1 Fetch

* Use conditional requests when possible (ETag/Last-Modified) and store headers in `fetch_artifacts`.
* Enforce per-source rate limits.
* Store raw response body (cap size; truncate + store hash).

### 7.2 Parse per strategy

* `rss`: parse items; map to candidate events
* `html_list`: scrape list page; extract item cards (title, link, date)
* `html_fingerprint`: extract main content, remove ignored selectors, compute hash; if changed since last run → create `docs_update` event with diff metadata
* `json_feed`: parse list and map

### 7.3 Normalize

Transform to canonical `ChangeEvent` and compute:

* `event_id`
* `fingerprint`
* `raw_excerpt`
* `summary` (initial heuristic acceptable: first 240 chars cleaned)
* `published_at` best-effort; if missing, use fetch timestamp but mark `published_at_inferred=true`

### 7.4 Tag + severity

Apply taxonomy rules to populate tags and severity deterministically.

### 7.5 Dedupe

Events are unique by `event_id`. If same `canonical_url` appears with updated fingerprint → update existing row and bump `updated_at`.

---

## 8) API requirements (Worker)

Expose:

* `GET /api/health` (returns build version + DB ok)
* `GET /api/events` (filters: platform, tag, event_type, since, until, q, severity, limit, cursor pagination)
* `GET /api/events/:id`
* `GET /api/platforms`
* `GET /api/tags`
* `GET /api/feeds/rss` (RSS)
* `GET /api/feeds/json` (JSON feed)
* `POST /api/admin/run` (manual trigger; protected by bearer token env var)

---

## 9) UI requirements (Pages)

Minimum screens:

* Timeline with filters + search
* Event detail:

  * title, published_at, platform, tags, canonical link
  * summary + excerpt
  * diff viewer for docs_update
  * raw artifact metadata (ETag, Last-Modified, fetched_at)
* Platform page (latest changes)
* Tags page

UI must be “good enough agency-grade”: clean typographic hierarchy, sensible spacing, no overlapping, responsive.

---

## 10) Testing plan (must implement)

### 10.1 Unit tests

* config parsing + schema validation
* each parsing strategy with small fixtures
* normalization + stable IDs
* tagger rules (golden cases)
* diff generation for html_fingerprint

### 10.2 Contract tests (per source)

For each built-in source, include fixtures:

* raw payload fixture (html/xml/json)
* expected parsed output (JSON)
  Test: “parser output equals expected JSON” (snapshot style).

### 10.3 Integration tests

* Apply migrations to local D1
* Run ingest on fixtures (no real network)
* Assert inserted event counts, dedupe behavior, cursor updates

### 10.4 E2E tests (Playwright)

* Start Worker locally + UI locally
* Hit UI, apply filters, open event detail
* Verify RSS endpoint returns valid XML
* Verify pagination works

### 10.5 CI

GitHub Actions workflow runs:

* lint
* typecheck
* unit + contract + integration
* E2E (headless Playwright)

---

## 11) Deployment (CLI, Cloudflare)

### 11.1 Worker schedules (Cron Triggers)

Cron triggers run via `scheduled()` handler and are configured in Wrangler. ([Cloudflare Docs][2])
Use UTC schedules. ([Cloudflare Docs][2])

### 11.2 D1

Implement per Cloudflare D1 binding approach and local development guidance. ([Cloudflare Docs][12])

### 11.3 Pages

Deploy UI via Wrangler “Direct Upload”. ([Cloudflare Docs][13])

### 11.4 Required CLI commands (must work)

Provide `Makefile` targets that run end-to-end:

* `make bootstrap`
* `make test`
* `make dev`
* `make deploy`

(Agent must implement these targets fully.)

---

## 12) Acceptance criteria (definition of done)

1. `make test` passes locally (all suites)
2. CI passes on GitHub
3. `make deploy` results in:

   * Worker deployed (API reachable)
   * D1 contains tables and at least one seeded event
   * Pages UI deployed and renders timeline from API
4. Adding a new source requires only:

   * new YAML in `config/sources/`
   * new fixtures + expected output
   * no code changes (unless new strategy)

---

## 13) Seed configs (create these exact initial YAMLs)

Implement these source configs with the official URLs from the citations above.

### 13.1 Example: `config/sources/google_ads_api.yaml`

* strategy: `html_list` (or `rss` if you implement RSS by discovering one)
* url: Google Ads API release notes ([Google for Developers][5])

### 13.2 Example: `config/sources/meta_marketing_api.yaml`

* url: Meta Marketing API changelog ([Meta for Developers][7])

### 13.3 Example: `config/sources/tiktok_changelog.yaml`

* url: TikTok changelog ([developers.tiktok.com][9])

### 13.4 Example: `config/sources/amazon_ads_release_notes.yaml`

* url: Amazon Ads API release notes ([Amazon Ads][10])

### 13.5 Example: `config/sources/amazon_ads_deprecations.yaml`

* url: Amazon deprecations ([Amazon Ads][11])

### 13.6 Example: `config/sources/docs_monitors.yaml`

* include at least 3 doc pages to fingerprint (you choose from the above sources’ “overview/versioning” pages).

---

## 14) Work plan (agent execution order)

1. Scaffold repo + workspaces + Makefile + CI
2. Implement config loader + schema validator + tests
3. Implement D1 migrations + query helpers + tests
4. Implement ingestion engine (fixtures-first) + tests
5. Implement API routes + tests
6. Implement UI driven by `config/ui.yaml`
7. Implement E2E tests
8. Implement deploy targets + verify deployed smoke test (health endpoint + UI load)
9. Final cleanup: docs, diagrams in README, “how to add a source” guide

---

## 15) Safety / legality guardrails

* Respect robots.txt when scraping HTML sources (log and skip if disallowed).
* Aggressive caching + conditional requests.
* Hard rate limits per source config.
* Store minimal excerpts; never republish full copyrighted text—link to canonical URL.

---

## 16) Output requirements (what you must produce)

* All files created with full contents
* No placeholders like “TODO implement”
* All commands in README are real and verified by running in CI
* Include `AGENT.md` with:

  * architecture summary
  * invariants
  * testing philosophy
  * “how to add a new source” checklist
  * troubleshooting steps (D1 binding, cron, pages deploy)

---

[1]: https://thecognitect.ai/blog/practice/config-as-code-data-platform/ "The Config-as-Code Multiplier: A Full Marketing Data Stack. Solo. In Weeks. — TheCognitect.ai"
[2]: https://developers.cloudflare.com/workers/configuration/cron-triggers/ "Cron Triggers · Cloudflare Workers docs"
[3]: https://developers.cloudflare.com/workers/wrangler/configuration/?utm_source=chatgpt.com "Configuration - Wrangler · Cloudflare Workers docs"
[4]: https://developers.cloudflare.com/d1/platform/limits/ "Limits · Cloudflare D1 docs"
[5]: https://developers.google.com/google-ads/api/docs/release-notes?utm_source=chatgpt.com "Release notes - Ads API"
[6]: https://ads-developers.googleblog.com/2026/01/announcing-v23-of-google-ads-api.html?utm_source=chatgpt.com "Announcing v23 of the Google Ads API"
[7]: https://developers.facebook.com/docs/marketing-api/marketing-api-changelog/?utm_source=chatgpt.com "Changelog - Marketing API"
[8]: https://developers.facebook.com/docs/graph-api/changelog/?utm_source=chatgpt.com "Changelog - Graph API - Meta for Developers"
[9]: https://developers.tiktok.com/doc/changelog?utm_source=chatgpt.com "Changelog"
[10]: https://advertising.amazon.com/API/docs/en-us/release-notes/ads-api?utm_source=chatgpt.com "Amazon Ads API v1 release notes"
[11]: https://advertising.amazon.com/API/docs/en-us/release-notes/deprecations?utm_source=chatgpt.com "January 2026 - Deprecation of Legacy v2 APIs"
[12]: https://developers.cloudflare.com/d1/get-started/ "Getting started · Cloudflare D1 docs"
[13]: https://developers.cloudflare.com/pages/get-started/direct-upload/?utm_source=chatgpt.com "Direct Upload · Cloudflare Pages docs"

---

Once you've fixed everything and verified that the change radar is actually 'useful' you can initialize git in this repo and push the working build to GitHub, the readme should be explanatory and educational and treat this project as a demonstrator