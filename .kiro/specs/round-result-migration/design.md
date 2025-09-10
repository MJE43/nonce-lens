# Design Document

## Overview
Live Streams currently accepts and stores `payout_multiplier` from clients and uses it throughout ingestion, storage, querying, and UI. This design replaces client-provided multipliers with a canonical Round Result computed server-side at ingestion time and used end-to-end for live-mode analytics and display. Runs and the offline analysis engine remain unchanged.

## Goals
- Remove any acceptance or storage of `payout_multiplier` and client-sent `round_result` in Live Streams POST payloads.
- Compute Round Result server-side deterministically using inputs available on each bet (server seed hash or seed, client seed, nonce, difficulty, and any per-round parameters as defined by live ingestion contract).
- Persist Round Result in Live Streams tables and expose it in read endpoints and tails.
- Maintain performance and determinism guarantees, preserve existing UX, and provide migration for historical data.

## Non-Goals
- Changes to Runs endpoints, engine interfaces for offline analysis, or run/hit schemas.
- Modifying the core algorithm in `engine/pump.py` used by Runs.

## Data Model Changes (Live Streams)
- Remove/Deprecate: `payout_multiplier` column(s) in live bets tables.
- Add: `round_result` representation. Recommended as a compact JSON with fields:
  - `multiplier`: number (Round Result Multiplier)
  - `max_multiplier`: number (if distinct from multiplier for expert modes)
  - `stops`: optional array (details needed for UI if applicable)
  - `difficulty`: string enum
  - `nonce`: number
  - `engine_version`: string

For SQLModel, either:
- Inline JSON (TEXT) column `round_result_json` with validated Pydantic model in schemas, or
- First-class columns for frequently queried attributes (e.g., `round_multiplier`, `difficulty`, `nonce`) and a JSON blob for extended attributes.

Indexes:
- Create indices on `difficulty`, `nonce`, and `created_at` as today; add index on `round_multiplier` if used for filtering.

## API Contract Changes (Live Streams)
- Ingestion POST request: reject `payout_multiplier` and `round_result` fields with 422; compute outcome server-side.
- Read endpoints (list, detail, summaries, tail): include `round_result` and exclude `payout_multiplier`.
- OpenAPI: update Pydantic response schemas to include `round_result` and remove multiplier fields.

## Backend Components to Update
- `app/models/live_streams.py`: update SQLModel definitions to add Round Result fields/JSON and remove `payout_multiplier`.
- `app/schemas/live_streams.py`: add `round_result` models in responses; ensure ingestion request excludes forbidden fields.
- `app/routers/live_streams.py`:
  - In ingestion endpoints, validate absence of deprecated fields and compute Round Result before persisting.
  - Update filters/aggregations to operate on Round Result fields.
  - Update tail endpoints to return `round_result`.
- `app/tests/*live_streams*`: update fixtures and assertions to use Round Result.

## Round Result Computation
Use the same deterministic logic as engine verification for a single nonce:
- Inputs: `server_seed` (or hashed server seed + server verification as applicable), `client_seed`, `nonce`, `difficulty`.
- Function: `verify_pump_single` (or equivalent helper) to compute per-round outcome.
- Output: structured `round_result` with at least `multiplier` and metadata.

If live ingestion does not receive raw `server_seed` (only a hash), store and compute with available verifiable data. If computation requires server seed not present during ingestion, mark rows with `pending_round_result` and a background job computes once seed is available.

## Migration Plan
1. Schema evolution: add `round_result_json` and optional derived columns; keep `payout_multiplier` temporarily.
2. Code paths:
   - Ingestion: compute and write Round Result; do not write `payout_multiplier`.
   - Reads: prefer Round Result; ignore multiplier; feature flag to toggle if needed.
3. Backfill job:
   - For rows with `payout_multiplier` only, recompute Round Result if inputs are available; otherwise set `migration_status` with reason.
4. Cleanup:
   - Remove `payout_multiplier` field(s) and code references after backfill completion.

## Validation & Error Handling
- Validation: reject payloads containing `payout_multiplier` or `round_result`.
- Errors: return 422 with code `LIVE_OUTCOME_CLIENT_FORBIDDEN` and details of offending fields.
- Logging: log deprecated-field attempts at warning level with client identifiers.

## Performance Considerations
- Round computation must keep ingestion p95 ≤ 150ms and tail p95 ≤ 250ms.
- Add indices supporting common live queries on Round Result.
- Cache stable configuration (difficulty tables) to avoid recomputation.

## Frontend Updates (Live Streams)
- Remove any use of `payout_multiplier` from types and components.
- Update API client and hooks to consume `round_result`.
- Ensure forms do not send `payout_multiplier` or `round_result`.

## Testing Strategy
- Unit: validate Round Result computation determinism for sample inputs.
- Integration: ingestion rejects deprecated fields; reads/tail return `round_result` only.
- Migration: backfill correctness and index usage.
- Performance: latency SLOs for ingestion and tail.

## Rollout Strategy
- Phase 1: Add Round Result fields and dual-read (prefer Round Result, fallback during backfill).
- Phase 2: Enforce ingestion rejection of deprecated fields; begin backfill.
- Phase 3: Remove `payout_multiplier` columns and code; update docs.


