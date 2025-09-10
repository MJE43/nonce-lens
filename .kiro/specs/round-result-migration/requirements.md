# Requirements Document

## Introduction
This specification defines a Live Streams ("live-mode") scoped migration to replace the legacy `payout_multiplier` with a canonical Round Result representation. Round Result Multiplier is only relevant for live-mode where the server receives live bets via POST, persists them, and serves UI/analytics derived from those records. The offline Runs path and analysis engine remain unaffected by this change.

## Scope
- In scope: Live Streams ingestion, storage, querying, tailing, filtering, aggregations, and frontend displays for live-mode.
- Out of scope: Runs endpoints, the offline analysis engine interfaces, batch analysis workflows, and any schemas/types used exclusively by Runs.

## Non-Goals
- Do not modify the Pump analysis engine algorithms or their external interfaces used by Runs.
- Do not change Runs request/response payloads, schemas, or tests beyond incidental shared-type cleanup.
- Do not require clients to send Round Result; the server computes it for live-mode.

## Requirements

### Requirement 1: Canonical Round Result for Live Streams
**Objective:** As a system architect, I want a canonical Round Result type for live-mode outcomes, so that Live Streams uses a consistent, deterministic representation.

#### Acceptance Criteria
1. WHEN a live bet is ingested THEN the Live Streams Service SHALL compute a Round Result object as the canonical outcome for that bet.
2. IF inputs (server seed, client seed, nonce, difficulty) are identical THEN the Live Streams Service SHALL yield an identical Round Result object bit-for-bit.
3. WHILE persisting live bets THE Database Layer SHALL store Round Result fields and SHALL NOT store `payout_multiplier`.
4. WHERE serialization of live bets is required THE Backend API SHALL expose Round Result via a single `round_result` field in responses using a stable JSON shape.

### Requirement 2: Backend API Contract Changes (Live Streams)
**Objective:** As an API consumer, I want clear live-mode contracts that exclude client-sent multipliers, so that outcomes are server-determined only.

#### Acceptance Criteria
1. WHEN a client submits POST requests for Live Streams ingestion THEN the API SHALL reject any `payout_multiplier` or `round_result` field with 422 and guidance that the server computes outcomes.
2. WHEN a client requests Live Streams resources (e.g., bets, summaries, tail) THEN the API SHALL return `round_result` in payloads and SHALL NOT include `payout_multiplier`.
3. IF an older client sends `payout_multiplier` or `round_result` THEN the API SHALL return a structured validation error with a clear deprecation code.
4. WHILE generating OpenAPI for Live Streams THE Backend API SHALL document `round_result` schemas and SHALL omit `payout_multiplier`.

### Requirement 3: Data Model & Migration (Live Streams)
**Objective:** As a database engineer, I want an idempotent migration for live-mode to replace `payout_multiplier` with Round Result, so that historical live data remains usable and queries stay fast.

#### Acceptance Criteria
1. WHEN the migration runs THEN the Database Layer SHALL add Round Result columns or embedded JSON to Live Streams tables, and SHALL deprecate or drop `payout_multiplier` depending on retention policy.
2. IF historical live rows contain `payout_multiplier` THEN the Migration Job SHALL backfill Round Result deterministically or mark rows unverifiable with a migration status code.
3. WHILE migrating live tables THE Migration Job SHALL complete within the existing performance budget and SHALL create indexes needed for Round Result queries.
4. WHERE rollback is required THE Migration Plan SHALL provide a reversible path without data loss of source inputs (seeds, nonce, difficulty).

### Requirement 4: Live Streams Ingestion & Tail
**Objective:** As a live analytics operator, I want ingestion and tail endpoints to operate on Round Result, so that real-time dashboards reflect canonical outcomes.

#### Acceptance Criteria
1. WHEN a live bet is ingested THEN the Live Streams Service SHALL compute and persist Round Result server-side and SHALL ignore client-sent multipliers.
2. WHEN querying the tail endpoints THEN the Live Streams Service SHALL return Round Result for each bet and SHALL omit `payout_multiplier`.
3. IF filters or aggregations previously used `payout_multiplier` THEN the Live Streams Service SHALL provide equivalent behavior using Round Result fields with matching semantics.
4. WHILE rate limiting and validation THE Live Streams Service SHALL validate absence of `payout_multiplier` and `round_result` in request bodies and headers.

### Requirement 5: Frontend Application & Types (Live Streams)
**Objective:** As a frontend developer, I want strict types and UI components using Round Result, so that client code is consistent and safe.

#### Acceptance Criteria
1. WHEN submitting live ingestion forms THEN the Frontend Application SHALL omit `payout_multiplier` and `round_result` from payloads.
2. WHEN rendering live lists, tables, and cards (e.g., `LiveBetTable`, `StreamSummaryCard`, `MultiplierTracker`) THEN the Frontend Application SHALL consume Round Result and SHALL NOT reference `payout_multiplier`.
3. IF TypeScript types for live-mode include `payout_multiplier` THEN the Frontend Types Layer SHALL remove it and SHALL add `round_result` types mirroring backend schemas.
4. WHILE building live charts and KPIs THE Frontend Application SHALL compute visuals from Round Result fields and SHALL preserve existing UX/accuracy.

### Requirement 6: Live Analytics & Aggregations
**Objective:** As a data analyst, I want live-mode aggregations to operate on Round Result, so that live insights remain valid after migration.

#### Acceptance Criteria
1. WHEN computing live summaries THEN the Analytics Layer SHALL aggregate using Round Result fields and SHALL reproduce equivalent metrics previously dependent on `payout_multiplier`.
2. IF live binning or thresholds previously referenced multiplier values THEN the Analytics Layer SHALL define equivalent Round Result-based bins with documented mapping.
3. WHILE exporting live CSV or reports THE Export Feature SHALL include Round Result columns and SHALL exclude `payout_multiplier`.
4. WHERE caching exists for live analytics THE Analytics Layer SHALL key caches by Round Result identity rather than `payout_multiplier`.

### Requirement 7: Determinism, Testing, and Compatibility (Live Streams)
**Objective:** As a QA engineer, I want deterministic live-mode tests and compatibility checks, so that the migration does not break provable fairness or live APIs.

#### Acceptance Criteria
1. WHEN live-mode unit tests run THEN the Test Suite SHALL assert Round Result determinism for fixed seed pairs and nonce ranges across difficulties.
2. IF live end-to-end API tests execute THEN the Test Suite SHALL verify absence of `payout_multiplier` in all responses and SHALL verify presence and structure of `round_result`.
3. WHILE running live regression tests THE Test Suite SHALL compare pre-migration and post-migration live analytics equivalence within documented tolerances.
4. WHERE legacy live clients are detected THE Test Suite SHALL include negative tests asserting 422 errors with clear deprecation codes on `payout_multiplier` usage.

### Requirement 8: Performance & Resource Targets (Live Streams)
**Objective:** As a performance engineer, I want unchanged or improved live performance, so that the migration does not degrade real-time experience.

#### Acceptance Criteria
1. WHEN ingesting live bets THEN the Live Streams Service SHALL meet p95 ingestion latency ≤ 150ms and p95 tail query latency ≤ 250ms under target load.
2. WHILE ingesting and tailing THE Live Streams Service SHALL sustain existing throughput SLOs without increased error rates.
3. IF database indices are updated THEN the Query Layer SHALL meet or improve existing p95 latency targets for live list and tail endpoints.
4. WHERE bundle size could grow THE Frontend Build SHALL remain within existing chunk size budgets after live-mode type and UI changes.

### Requirement 9: Validation, Security, and Logging (Live Streams)
**Objective:** As a security engineer, I want strict validation and structured logging, so that misuse is prevented and auditability is preserved.

#### Acceptance Criteria
1. WHEN live requests include `payout_multiplier` or `round_result` THEN the Validation Layer SHALL reject with a structured error code and SHALL not process the fields.
2. IF authentication and rate limiting are applied THEN the Security Layer SHALL log attempts that include deprecated fields as warnings with client identifiers.
3. WHILE CORS and headers are configured THE Backend API SHALL expose only Round Result-related schemas for Live Streams and SHALL not leak deprecated fields.
4. WHERE error handlers produce messages THE Backend API SHALL avoid exposing internal computation details while retaining sufficient context for debugging.

### Requirement 10: Documentation & Developer Experience (Live Streams)
**Objective:** As a developer, I want up-to-date documentation and examples, so that new and existing contributors adopt Round Result correctly.

#### Acceptance Criteria
1. WHEN generating API docs for Live Streams THEN the Documentation SHALL include Round Result response examples and SHALL exclude `payout_multiplier` and client-sent outcome fields.
2. IF README and PRD mention `payout_multiplier` in live-mode contexts THEN the Documentation SHALL update references to Round Result with migration notes.
3. WHILE running local dev THE Developer Tooling SHALL provide seed/nonce examples that demonstrate Round Result determinism for live-mode helpers.
4. WHERE code comments reference `payout_multiplier` in live-mode THE Codebase SHALL remove or rewrite them to reference Round Result exclusively.


