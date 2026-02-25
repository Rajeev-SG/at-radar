# AdTech Change Radar Agent Notes

## Architecture Summary
- `packages/worker`: Cloudflare Worker hosting API and scheduled ingestion handlers.
- `packages/worker` ingests source configs from `config/sources/*.yaml`, normalizes to `change_events`, and stores run metadata in D1-compatible tables.
- `packages/web`: Astro static UI that renders navigation/pages from `config/ui.yaml` and queries the Worker API.

## Invariants
- Config is the source of truth for sources, taxonomy, normalization, and UI navigation.
- DB schema changes ship only through SQL migrations in `packages/worker/migrations`.
- `change_events.event_id` is deterministic and stable for identical canonical records.
- Parser strategy behavior is deterministic against fixtures.

## Testing Philosophy
- Fixture-first contract tests for each built-in source to make parser regressions obvious.
- Integration tests execute migrations and ingest fixtures into SQLite/D1-compatible schema.
- E2E tests validate the user path (timeline -> filters -> detail) and feeds endpoints.

## How To Add A New Source
1. Add a new YAML under `config/sources/` using an existing strategy schema.
2. Add raw fixture(s) and expected parsed output under `packages/worker/fixtures/`.
3. Register the fixture mapping in contract tests (no code changes unless strategy is new).
4. Run `make test`.
5. Deploy; scheduled ingest will pick up the source automatically.

## Troubleshooting
- D1 binding errors: verify `packages/worker/wrangler.toml` has the remote DB `database_id` and local `preview_database_id`.
- Cron not firing: confirm `triggers.crons` in `packages/worker/wrangler.toml` and that the worker deployed successfully.
- Pages deploy API mismatch: set `PUBLIC_RADAR_API_URL` during `make deploy`, or use the deploy script which injects the Worker URL.
