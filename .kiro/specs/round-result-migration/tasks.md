# Implementation Plan

- [ ] 1. Introduce Round Result domain in live-mode
- [ ] 1.1 Add canonical Round Result representation for live bets
  - Define structured outcome including multiplier and metadata
  - Ensure deterministic identity from seed, client seed, nonce, difficulty
  - _Requirements: 1.1, 1.2_

- [ ] 1.2 Remove acceptance/storage of client-sent multipliers
  - Forbid `payout_multiplier` and client `round_result` in ingestion payloads
  - Return 422 with deprecation code and offending fields
  - _Requirements: 2.1, 9.1_

- [ ] 2. Evolve live-mode data model
- [ ] 2.1 Add Round Result fields and supporting indexes
  - Add JSON field and/or derived columns for common filters
  - Create indices for live queries on Round Result and timestamps
  - _Requirements: 3.1, 8.3_

- [ ] 2.2 Deprecate and plan removal of `payout_multiplier`
  - Keep legacy columns during backfill and reads migration
  - Mark for removal after backfill completion
  - _Requirements: 3.1, 3.4_

- [ ] 3. Compute Round Result at ingestion
- [ ] 3.1 Implement server-side computation for each live bet
  - Use deterministic single-round verification for provided inputs
  - Persist computed Round Result and ingestion metadata
  - _Requirements: 4.1, 1.2_

- [ ] 3.2 Handle missing inputs for Round Result computation
  - Store pending status when inputs are insufficient
  - Background job to complete computation when inputs arrive
  - _Requirements: 3.2, 4.1_

- [ ] 4. Update live read/query endpoints
- [ ] 4.1 Return Round Result in live lists, details, summaries, tail
  - Remove `payout_multiplier` from all responses
  - Ensure filters/aggregations use Round Result equivalents
  - _Requirements: 2.2, 4.2, 4.3_

- [ ] 4.2 Validate absence of deprecated fields at boundaries
  - Enforce schema-level validation for ingestion payloads
  - Add warning logs for attempts with deprecated fields
  - _Requirements: 2.1, 9.2_

- [ ] 5. Frontend live-mode updates
- [ ] 5.1 Remove `payout_multiplier` from types and forms
  - Ensure no client code sends outcome fields to ingestion
  - Update mocks and fixtures accordingly
  - _Requirements: 5.1, 5.3_

- [ ] 5.2 Render Round Result in live components and KPIs
  - Update tables, cards, and trackers to use Round Result
  - Maintain UX and accuracy for live analytics
  - _Requirements: 5.2, 5.4, 6.1_

- [ ] 6. Live analytics and exports
- [ ] 6.1 Migrate aggregations to Round Result
  - Replace multiplier-based metrics with Round Result equivalents
  - Adjust binning/thresholds and document mapping
  - _Requirements: 6.1, 6.2_

- [ ] 6.2 Update CSV/report exports for live-mode
  - Include Round Result columns; remove `payout_multiplier`
  - Validate export correctness and compatibility
  - _Requirements: 6.3_

- [ ] 7. Migration & backfill
- [ ] 7.1 Implement backfill for historical live data
  - Recompute Round Result where inputs exist
  - Mark unverifiable rows with migration status
  - _Requirements: 3.2, 3.3_

- [ ] 7.2 Remove legacy columns and references
  - Drop `payout_multiplier` after backfill and reads migration
  - Delete code paths, tests, and docs referencing it
  - _Requirements: 3.4, 10.2, 10.4_

- [ ] 8. Validation, security, and logging
- [ ] 8.1 Enforce validation and structured errors
  - 422 for deprecated fields with code `LIVE_OUTCOME_CLIENT_FORBIDDEN`
  - Ensure OpenAPI documents new schemas
  - _Requirements: 2.1, 2.4, 9.1_

- [ ] 8.2 Add security logging for deprecated-field attempts
  - Log client identifiers and counts for rate-limit review
  - _Requirements: 9.2_

- [ ] 9. Testing and performance
- [ ] 9.1 Update unit, integration, and E2E tests for live-mode
  - Determinism tests for Round Result
  - Ingestion negative tests for deprecated fields
  - _Requirements: 7.1, 7.2, 7.4_

- [ ] 9.2 Validate live performance targets
  - Measure p95 ingestion and tail latencies under target load
  - Confirm index efficacy and cache usage
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 10. Documentation updates (code-level only)
- [ ] 10.1 Update API examples and inline comments (live-mode)
  - Ensure examples show Round Result outputs only
  - Remove references to `payout_multiplier`
  - _Requirements: 10.1, 10.4_
