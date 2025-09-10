# Requirements Document

## Introduction

This feature enhances the existing live streams functionality with a comprehensive real-time analytics dashboard. The dashboard provides live KPIs, multiplier tracking, distance analysis, alerts, and interactive filtering capabilities. All updates happen incrementally without rescanning, maintaining fast performance as new betting data streams in.

## Global Definitions

- **Hit**: Any ingested bet row in a stream
- **Occurrence(m)**: A row whose payoutMultiplier equals m within tolerance 1e-9
- **Gap(m)**: nonce_i - nonce_{i-1} for consecutive occurrences of m within the same stream
- **Pinned multipliers**: Persisted per stream; default empty. Stored as array on client (session) and optionally in DB for durability
- **Incremental calculations**: All live calculations must update only from newly appended rows returned by /tail?since_id=. No rescans
- **Ordering**: Ingestion stores rows in arrival order; nonces are monotonic per stream. UI renders ordered by nonce ASC or id DESC; tail works on id

## Requirements

### Requirement 1

**User Story:** As a gambling analyst, I want to see live KPIs that update automatically as new betting data arrives, so that I can monitor stream performance in real-time without manual refreshes.

#### Acceptance Criteria

1. WHEN new betting data arrives THEN the system SHALL update pinned KPIs without rescanning the entire dataset
2. WHEN displaying highest multiplier THEN the system SHALL show the current stream's maximum multiplier value
3. WHEN counting hits THEN the system SHALL display the total number of hits seen in the current stream
4. WHEN calculating hit rate THEN the system SHALL use formula: Hits/min = 60 * rows_seen / max(1, seconds_since_first_row)
5. WHEN calculating EMA THEN the system SHALL use EMA(30s): ema_t = α*rate_t + (1-α)*ema_{t-1}, α = 2/(1+30)
6. WHEN showing latest nonce THEN the system SHALL display the most recent nonce and time delta since the last row
7. WHEN calculating latest gap THEN the system SHALL show current_nonce - previous_nonce across all rows (not per multiplier)
8. WHEN switching streams THEN the system SHALL zero all counters
9. WHEN "Freeze UI" is enabled THEN the system SHALL keep KPIs updating while stopping auto-scroll

### Requirement 2

**User Story:** As a betting pattern investigator, I want to pin specific multipliers and track their occurrence patterns, so that I can analyze the behavior of high-value outcomes.

#### Acceptance Criteria

1. WHEN selecting multipliers to pin THEN the system SHALL provide chips from either the stream's distinct multipliers seen so far or a preset list for the difficulty
2. WHEN persisting pinned multiplier stats THEN the system SHALL maintain per pinned m: count, last_nonce, last_gap, mean_gap, std_gap, max_gap, p90_gap (approx), and a ring buffer last_k_gaps (k=50)
3. WHEN calculating ETA THEN the system SHALL use theoretical tail prob p(m) table if available: ETA ≈ last_nonce + 1/p(m), else ETA ≈ last_nonce + mean_gap_observed
4. WHEN displaying ETA THEN the system SHALL label which model is used (theoretical vs observed)
5. WHEN user clicks "show distances" THEN the system SHALL scroll to and highlight table rows for the selected multiplier

### Requirement 3

**User Story:** As a provably-fair gaming researcher, I want to see distance calculations between same-multiplier hits, so that I can analyze clustering patterns and gap distributions.

#### Acceptance Criteria

1. WHEN displaying the live table THEN the system SHALL include a distance column showing nonce gap to previous same-multiplier hit
2. WHEN showing first occurrence of a multiplier THEN the system SHALL display "—" in the distance column
3. WHEN server does not send distance_prev_opt THEN the client SHALL keep a last_nonce_by_multiplier map and fill distance only for new rows
4. WHEN displaying historical pages THEN the system SHALL show blank distance until scrolled into by tail or fetched with include_distance=1
5. WHEN computing distances server-side THEN the system SHALL use window function: nonce - LAG(nonce) OVER (PARTITION BY payout_multiplier ORDER BY nonce)

### Requirement 4

**User Story:** As a cryptocurrency gambling analyst, I want to visualize hit density patterns across nonce ranges, so that I can identify clustering without heavy charting overhead.

#### Acceptance Criteria

1. WHEN bucketing nonces THEN the system SHALL use default bucket_size = 1000 nonces (configurable to 5000)
2. WHEN maintaining counts THEN the system SHALL keep counts[bucket_id] and recompute sparkline only for the modified bucket
3. WHEN handling out-of-order appends THEN the system SHALL use bucket_id = floor(nonce / bucket_size) safely
4. WHEN displaying density THEN the system SHALL show a sparkline visualization of hit clusters

### Requirement 5

**User Story:** As a betting pattern investigator, I want to filter live data by multiplier thresholds and sort options, so that I can focus on specific outcome ranges.

#### Acceptance Criteria

1. WHEN applying filters THEN the system SHALL apply to table view only; KPIs and density remain all-rows by default
2. WHEN providing filter toggle THEN the system SHALL offer "Apply filters to KPIs" option
3. WHEN setting minimum multiplier THEN the system SHALL filter results to show only hits above the threshold
4. WHEN selecting sort order THEN the system SHALL support "latest first" (id DESC) and "nonce ascending" (nonce ASC) options
5. WHEN toggling pinned multipliers THEN the system SHALL show only results matching pinned multiplier values
6. WHEN sorting THEN the system SHALL document that distance meanings don't change

### Requirement 6

**User Story:** As a gambling analyst, I want automated alerts for significant events, so that I can be notified of unusual patterns without constant monitoring.

#### Acceptance Criteria

1. WHEN gap alert triggers for m THEN the system SHALL fire when gap_now > max(p95_observed, mean_gap + z*std_gap) with defaults p95, z=2
2. WHEN rate limiting gap alerts THEN the system SHALL limit to one toast per m per 10s
3. WHEN cluster alert triggers THEN the system SHALL maintain sliding window by nonce (W nonces) and by time (W seconds) with defaults: W=2000 nonces or 60s; N=3
4. WHEN cluster alert fires THEN the system SHALL trigger when count ≥ N
5. WHEN threshold alert triggers THEN the system SHALL fire when payout_multiplier ≥ target_x and allow multiple targets
6. WHEN displaying alerts THEN the system SHALL show non-blocking toasts + row highlight and never pause ingest

### Requirement 7

**User Story:** As a provably-fair gaming researcher, I want rolling window statistics, so that I can detect regime shifts separate from all-time statistics.

#### Acceptance Criteria

1. WHEN configuring rolling windows THEN the system SHALL support either time window W_s (default 60s) or last N hits (default 200), selectable
2. WHEN calculating rolling metrics THEN the system SHALL show mean(multiplier), max(multiplier), hits/min
3. WHEN updating rolling stats THEN the system SHALL maintain separate calculations from all-time statistics
4. WHEN detecting deviations THEN the system SHALL highlight when rolling mean deviates from all-time mean by >|z|≥2

### Requirement 8

**User Story:** As a cryptocurrency gambling analyst, I want to bookmark significant events and compare different data sets, so that I can maintain context and perform comparative analysis.

#### Acceptance Criteria

1. WHEN persisting bookmarks THEN the system SHALL use bookmarks table: { id, stream_id, nonce, multiplier, note, created_at }
2. WHEN bookmarking rows THEN the system SHALL allow users to click star icons and add notes
3. WHEN filtering bookmarks THEN the system SHALL provide a view showing only bookmarked entries
4. WHEN creating snapshots THEN the system SHALL store filter state and the last last_id checkpoint
5. WHEN viewing snapshots THEN the system SHALL replay rows ≤ checkpoint
6. WHEN comparing data THEN the system SHALL support two panels bound to two sources (another live stream or a saved run) with shared filters and independent tails

### Requirement 9

**User Story:** As a betting pattern investigator, I want efficient incremental calculations, so that the system remains responsive as data volume grows.

#### Acceptance Criteria

1. WHEN calculating mean/std of gaps THEN the system SHALL use Welford's method: n+=1; delta = x - mean; mean += delta/n; m2 += delta*(x - mean); std = sqrt(m2/max(1,n-1))
2. WHEN computing quantiles THEN the system SHALL use fixed 64-bin histogram per pinned m to approx p90/p99, or TDigest
3. WHEN managing ring buffers THEN the system SHALL use last_k_gaps=50 per pinned m; table "top peaks" keep size 20
4. WHEN processing new rows THEN the system SHALL update only affected statistics and mappings
5. WHEN managing memory THEN the system SHALL avoid full arrays for quantile calculations

### Requirement 10

**User Story:** As a gambling analyst, I want intuitive UI controls and keyboard shortcuts, so that I can efficiently navigate and control the live dashboard.

#### Acceptance Criteria

1. WHEN providing sticky actions THEN the system SHALL include action row with: Pause/Resume, Poll period, Export, Freeze UI
2. WHEN using keyboard THEN the system SHALL support "/" focus filter, "J/K" row nav, "G" jump to nonce, "P" toggle pause
3. WHEN displaying multipliers THEN the system SHALL use color tiers mapped to class buckets with documented thresholds per difficulty
4. WHEN filtering results THEN the system SHALL show "x of y" indicators when filters hide rows
5. WHEN managing layout THEN the system SHALL organize components in header strip, left column KPIs, right column tracker, and full-width table

### Requirement 11

**User Story:** As a provably-fair gaming researcher, I want precise multiplier matching and proper initialization behavior, so that the system handles edge cases correctly.

#### Acceptance Criteria

1. WHEN matching occurrences by multiplier THEN the system SHALL use ATOL = 1e-9 tolerance
2. WHEN first loading with existing rows THEN the system SHALL request /bets?include_distance=1&order=nonce_asc&limit=… to populate distance column correctly before switching to tail
3. WHEN handling empty streams THEN the system SHALL display appropriate placeholder states

### Requirement 12

**User Story:** As a gambling analyst, I want reliable data streaming with proper error handling, so that temporary network issues don't break the live dashboard.

#### Acceptance Criteria

1. WHEN polling for updates THEN the system SHALL use tail polling interval default 500 ms
2. WHEN errors occur THEN the system SHALL use exponential backoff up to 5 s, then resume 500 ms on success
3. WHEN handling connection issues THEN the system SHALL maintain UI state and resume seamlessly

### Requirement 13

**User Story:** As a user with accessibility needs, I want proper focus management and screen reader support, so that I can navigate the dashboard effectively.

#### Acceptance Criteria

1. WHEN navigating with keyboard THEN the system SHALL ensure focus states on chips and table rows
2. WHEN displaying alerts THEN the system SHALL make toasts ARIA-live polite
3. WHEN providing interactive elements THEN the system SHALL follow accessibility best practices

### Requirement 14

**User Story:** As a gambling analyst, I want the system to maintain performance under high data volumes, so that the dashboard remains responsive during busy periods.

#### Acceptance Criteria

1. WHEN receiving tail updates THEN the system SHALL limit tail append ≤ 1000 rows per call
2. WHEN updating UI THEN the system SHALL complete UI append time ≤ 16 ms per 100 rows using virtualized table
3. WHEN managing memory THEN the system SHALL keep at most 50k rows client-side; above that, switch to paged mode with a "live viewport" of the last 5k nonces

### Requirement 15

**User Story:** As a development team member, I want comprehensive testing coverage for analytics features, so that we can ensure correctness and reliability.

#### Acceptance Criteria

1. WHEN testing units THEN the system SHALL verify Welford correctness, histogram p90 accuracy (±1 bucket), distance column semantics
2. WHEN testing integration THEN the system SHALL verify tail → KPIs, pinned multipliers, alerts firing/ratelimit, density bucket increments
3. WHEN testing end-to-end THEN the system SHALL verify pin two multipliers, trigger cluster alert, bookmark a row, export CSV; all while tail appends

### Requirement 16

**User Story:** As a system integrator, I want clear API specifications for live analytics support, so that backend and frontend can work together seamlessly.

#### Acceptance Criteria

1. WHEN calling /live/streams/{id}/tail?since_id= THEN the system SHALL return rows with fields: { id, nonce, payout_multiplier, date_time, amount, payout, difficulty, round_target, round_result, distance_prev_opt }
2. WHEN requesting distance calculations THEN the system SHALL support query param include_distance=1 to return distance_prev_opt using window function: nonce - LAG(nonce) OVER (PARTITION BY payout_multiplier ORDER BY nonce)
3. WHEN providing optional server compute THEN the system SHALL allow table to show distances for historical rows without client prepass