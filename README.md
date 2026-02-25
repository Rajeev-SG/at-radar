# AdTech Change Radar (Demonstrator)

A config-as-code demonstrator for tracking AdTech platform changes (release notes, changelogs, docs updates, deprecations) using Cloudflare Workers + D1 + Pages.

This project is intentionally built to show the full workflow, not just a UI:
- source configs in YAML
- parser strategies + normalization into a canonical event model
- query API + RSS/JSON feeds
- config-driven web UI
- tests across parser/unit/contract/integration/E2E
- CLI-first Cloudflare deployment

## Why This Exists

Most “change trackers” fail for one of two reasons:
1. The system architecture is incomplete (no persistence, no API, no tests).
2. The parsing works structurally but produces low-value content (JS blobs, anti-bot pages, generic headings, `[object Object]`, etc.).

This demonstrator addresses both:
- It ships a complete Cloudflare-first implementation.
- It includes parser quality controls and source-specific filtering so the output is actually useful.

## Current Deployment (Verified)

As of **February 25, 2026**:
- Worker API: `https://adtech-change-radar-api.rajeev-sgill.workers.dev`
- Pages UI: `https://c3abd03b.adtech-change-radar.pages.dev`

The deployed dataset was re-ingested after parser quality fixes (junk records cleared and rehydrated).

## What “Useful” Means Here

For this demonstrator, “useful” means:
- events have canonical source URLs (not feed/internal IDs)
- summaries are human-readable text (not `[object Object]`)
- docs monitors reject anti-bot/script blobs and obvious 404s
- version headings and release notes are extracted instead of generic page chrome (`Page Summary`, etc.)
- the timeline contains actionable entries (releases, deprecations, docs changes) with tags/severity

## Architecture

### `packages/worker` (Cloudflare Worker + Ingestor + API)
- Scheduled ingestion via `scheduled()` Cron Trigger
- HTTP API for UI and feeds
- D1 storage (events, runs, artifacts, cursors, tags)
- Config loader/validator from repo YAML + JSON Schemas
- Parser strategies:
  - `rss`
  - `html_list`
  - `html_fingerprint`
  - `json_feed`

### `packages/web` (Astro Pages UI)
- Static UI deployed to Cloudflare Pages
- Reads UI nav/page definitions from `config/ui.yaml`
- Fetches data from Worker API
- Timeline, event detail, platforms view, tags view

## Config-as-Code Layout

- `config/sources/*.yaml`: source definitions (URLs, strategies, parser rules)
- `config/taxonomy.yaml`: tagging + severity regex rules
- `config/normalization.yaml`: canonicalization defaults
- `config/ui.yaml`: navigation + page presets
- `config/schemas/*.json`: JSON Schemas used by validation
- `packages/worker/migrations/*.sql`: D1 schema migrations

## Repo Layout

```text
config/                  # Source/taxonomy/normalization/UI config
packages/worker/         # Cloudflare Worker + ingest + tests + fixtures
packages/web/            # Astro UI + Playwright E2E tests
scripts/                 # Config snapshot generation + deploy automation
.github/workflows/ci.yml # CI pipeline
```

## Getting Started (Local)

### Prerequisites
- Node.js 20+
- npm
- Cloudflare account + Wrangler CLI auth (for deploy)

### Install + Test
```bash
cp .env.example .env
make bootstrap
make test
```

### Local Dev
```bash
make dev
```
This runs:
- a local worker-compatible API server seeded from fixtures (`packages/worker`)
- the Astro UI (`packages/web`)

## Commands

- `make bootstrap`
  - installs dependencies and Playwright browser
- `make test`
  - lint + typecheck + worker tests + web tests + Playwright E2E
- `make dev`
  - local worker API + local Astro UI
- `make deploy`
  - runs tests, provisions/uses D1, applies migrations, deploys Worker + Pages, runs smoke checks

## Deployment Notes (Cloudflare)

The deploy flow is automated in `scripts/deploy-cloudflare.mjs` and handles:
- D1 database create/list + config patching (`wrangler.toml` IDs)
- D1 migrations apply
- Worker deploy with runtime vars
- Pages deploy with retrying smoke checks (to tolerate propagation delay)

### One-Time Account Requirement
You must register a `workers.dev` subdomain in Cloudflare before the first Worker deploy. This is an account-level Cloudflare onboarding step.

## Testing Strategy

### Unit Tests
- config validation
- normalization
- tagger rules
- diff generation
- parser strategy behavior

### Contract Tests
Fixture-based parser expectations per built-in source (`packages/worker/fixtures/...`).

### Integration Tests
- apply D1 migrations locally (SQLite shim)
- run fixture-only ingestion
- verify dedupe, inserts, cursor state, API behavior

### E2E (Playwright)
- start local worker + UI
- load timeline
- filter events
- open detail page
- verify feeds + pagination contract

## Lessons Learned (Important)

The original build spec was strong on structure and deployment, but under-specified **content quality acceptance**. In practice, “parsing succeeded” is not enough.

Examples of real-world failures this demonstrator had to explicitly address:
- generated page summaries contaminating release-note extraction
- anti-bot/browser-warning pages being treated as docs updates
- Atom feed objects stringifying to `[object Object]`
- non-canonical feed URLs instead of human-facing URLs

If you adapt this project, add per-source quality gates early.

## How To Add a New Source

1. Add a YAML file in `config/sources/`.
2. Reuse an existing strategy if possible (`rss`, `html_list`, `html_fingerprint`, `json_feed`).
3. Add raw fixtures + expected parser output under `packages/worker/fixtures/`.
4. Run `make test`.
5. Deploy and verify live content quality (not just parser success).

## Optional LLM Enrichment (Future)

An `OPENROUTER_API_KEY` can be used to add an optional enrichment pass after normalization for:
- higher quality summaries
- better severity classification
- tag refinement
- duplicate clustering

This should be layered on top of deterministic parser quality gates, not used as a substitute for them.

## Files Worth Reading First

- `packages/worker/src/ingest/engine.ts`
- `packages/worker/src/api/routes.ts`
- `packages/worker/src/db/queries.ts`
- `packages/web/src/pages/index.astro`
- `scripts/deploy-cloudflare.mjs`
- `AGENT.md`
