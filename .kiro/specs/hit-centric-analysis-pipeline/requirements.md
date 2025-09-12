# Requirements Document

## Introduction

This feature implements a hit-centric analysis pipeline that enables efficient analysis of ultra-rare multipliers (like 11,200× and 48,800×) across large nonce ranges (70k+) without the performance constraints of current bet-streaming approaches. The system shifts from streaming all bets to fetching only relevant hits with proper distance calculations, enabling deep historical analysis and pattern recognition for rare events that occur predictably but only after sufficient nonce history.

## Global Definitions

- **Hit**: A bet with a specific multiplier bucket (rounded to 2 decimal places)
- **Bucket**: Multiplier rounded to 2 decimal places (e.g., 11200.00, 48800.00)
- **Distance**: Nonce gap between consecutive hits of the same multiplier bucket
- **Range**: A nonce window (e.g., 0-10k, 60k-70k) used for analysis
- **Hit-centric**: Analysis focused on specific multiplier occurrences rather than all bet data
- **Deep Analysis Mode**: Analysis mode that can efficiently handle 70k+ nonce ranges

## Requirements

### Requirement 1

**User Story:** As a gambling analyst tracking ultra-rare multipliers, I want to analyze patterns across large nonce ranges (70k+) without performance degradation, so that I can identify predictable clustering patterns for high-value outcomes.

#### Acceptance Criteria

1. WHEN analyzing rare multipliers THEN the system SHALL support nonce ranges up to 70,000+ without UI performance issues
2. WHEN switching between nonce ranges THEN the system SHALL load data within 2 seconds for any 10k window
3. WHEN tracking multipliers like 11,200× and 48,800× THEN the system SHALL provide accurate statistics across the full seed history
4. WHEN computing distances THEN the system SHALL maintain accuracy regardless of the nonce range being analyzed
5. WHEN jumping between ranges THEN the system SHALL cache recently accessed ranges for instant navigation

### Requirement 2

**User Story:** As a provably-fair gaming researcher, I want a hit-centric API that returns only relevant multiplier occurrences, so that I can analyze specific patterns without downloading unnecessary data.

#### Acceptance Criteria

1. WHEN requesting hits for a specific bucket THEN the system SHALL return GET /streams/{id}/hits?bucket=11200&after_nonce=0&before_nonce=70000&limit=500&order=nonce_asc
2. WHEN returning hit data THEN the system SHALL include {nonce, bucket, distance_prev} for each hit
3. WHEN handling range boundaries THEN the system SHALL include prev_nonce_before_range to ensure correct distance calculation for the first hit in range
4. WHEN requesting multiple ranges THEN the system SHALL support batch queries for efficiency
5. WHEN no hits exist in range THEN the system SHALL return empty array with proper metadata

### Requirement 3

**User Story:** As a betting pattern investigator, I want server-side distance calculations that work correctly across range boundaries, so that gap analysis remains accurate when viewing historical windows.

#### Acceptance Criteria

1. WHEN computing distances server-side THEN the system SHALL use LAG window function: nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce)
2. WHEN handling range boundaries THEN the system SHALL find the previous hit before the range to seed the distance calculation correctly
3. WHEN storing bucket values THEN the system SHALL use generated column bucket_2dp = round(payout_multiplier, 2) with index on (stream_id, bucket_2dp, nonce)
4. WHEN first hit in range has no predecessor THEN the system SHALL return distance as null
5. WHEN querying across multiple ranges THEN the system SHALL maintain distance calculation consistency

### Requirement 4

**User Story:** As a gambling analyst, I want fast statistical aggregations over large nonce ranges, so that I can get instant median/mean/count for rare multipliers without client-side processing.

#### Acceptance Criteria

1. WHEN requesting statistics THEN the system SHALL provide GET /streams/{id}/hits/stats?bucket=11200&ranges=0-20000,20000-40000,40000-70000
2. WHEN computing statistics THEN the system SHALL return {count, median, mean, min, max} per range using SQL aggregation
3. WHEN calculating percentiles THEN the system SHALL use percentile_cont(0.5) WITHIN GROUP (ORDER BY distance) for accurate medians
4. WHEN handling large ranges THEN the system SHALL complete statistical queries within 1 second for 70k nonce spans
5. WHEN no hits exist THEN the system SHALL return null statistics with count=0

### Requirement 5

**User Story:** As a cryptocurrency gambling analyst, I want a range navigator that lets me jump efficiently between nonce windows, so that I can explore patterns across the full seed history.

#### Acceptance Criteria

1. WHEN navigating ranges THEN the system SHALL provide controls for 0-10k, 10-20k, 20-30k, etc. up to current nonce
2. WHEN jumping to a range THEN the system SHALL load hit data for the selected bucket and range within 2 seconds
3. WHEN showing current position THEN the system SHALL display "Range: 60k-70k • Bucket: 11.2kx • 43 hits"
4. WHEN using prev/next controls THEN the system SHALL navigate to adjacent 10k windows
5. WHEN providing jump-to input THEN the system SHALL allow direct nonce entry (e.g., "Go to 45000")

### Requirement 6

**User Story:** As a betting pattern investigator, I want pinned multiplier chips that show statistics for the current range, so that I can quickly compare different rare multipliers.

#### Acceptance Criteria

1. WHEN pinning multipliers THEN the system SHALL store bucket keys (e.g., 11200, 48800) in session state
2. WHEN displaying chips THEN the system SHALL show each pinned multiplier as a chip with current range statistics
3. WHEN clicking a chip THEN the system SHALL switch focus to that bucket and reload current range data
4. WHEN showing chip badges THEN the system SHALL display median distance for the current range
5. WHEN range changes THEN the system SHALL update all chip statistics automatically

### Requirement 7

**User Story:** As a provably-fair gaming researcher, I want a unified analysis engine that ensures consistent calculations between different UI components, so that statistics never drift between views.

#### Acceptance Criteria

1. WHEN computing distances THEN the system SHALL use a single analysisMath.ts engine for all calculations
2. WHEN bucketing multipliers THEN the system SHALL consistently use Math.round(multiplier * 100) / 100 everywhere
3. WHEN sharing data THEN the system SHALL provide React context with {bets, distanceById, statsByBucket} from single source
4. WHEN switching modes THEN the system SHALL ensure Analysis Mode and Live Mode use the same calculation pipeline
5. WHEN displaying statistics THEN the system SHALL show identical numbers in chips, table, and summary views

### Requirement 8

**User Story:** As a gambling analyst, I want a sticky analysis bar that consolidates controls and shows live statistics, so that I have a unified interface for deep analysis.

#### Acceptance Criteria

1. WHEN in analysis mode THEN the system SHALL show sticky bar with Mode toggle, Min Multiplier input, Range selector, and Focus chip
2. WHEN displaying statistics THEN the system SHALL show Count • Median • Mean • Range for the focused bucket
3. WHEN showing scope THEN the system SHALL display "43 hits • nonce 60k-70k • bucket 11.2kx"
4. WHEN using controls THEN the system SHALL provide Prev 10k / Next 10k / Jump to... buttons
5. WHEN exiting analysis THEN the system SHALL return to live mode with single button click

### Requirement 9

**User Story:** As a cryptocurrency gambling analyst, I want efficient caching and memory management, so that the system remains responsive when exploring multiple ranges.

#### Acceptance Criteria

1. WHEN caching ranges THEN the system SHALL keep the last 6 accessed ranges in React Query cache
2. WHEN managing memory THEN the system SHALL evict older ranges automatically to prevent memory bloat
3. WHEN using web workers THEN the system SHALL optionally compute large distance arrays in background threads
4. WHEN compressing data THEN the system SHALL use gzip/deflate for API responses
5. WHEN handling large datasets THEN the system SHALL maintain UI responsiveness with proper virtualization

### Requirement 10

**User Story:** As a betting pattern investigator, I want the table to integrate seamlessly with hit-centric analysis, so that I can see detailed data alongside summary statistics.

#### Acceptance Criteria

1. WHEN in analysis mode THEN the table SHALL show only hits for the current bucket and range
2. WHEN displaying distances THEN the table SHALL use precomputed distance values from the hit API
3. WHEN sorting THEN the table SHALL default to nonce ASC in analysis mode, nonce DESC in live mode
4. WHEN virtualizing THEN the table SHALL handle up to 10k hits per range with smooth scrolling
5. WHEN highlighting THEN the table SHALL highlight rows when clicking chip statistics

### Requirement 11

**User Story:** As a system administrator, I want database optimizations that support efficient hit queries, so that the system can handle large-scale analysis without performance degradation.

#### Acceptance Criteria

1. WHEN storing multipliers THEN the system SHALL add generated column bucket_2dp for consistent bucketing
2. WHEN indexing THEN the system SHALL create index on (stream_id, bucket_2dp, nonce) for fast hit queries
3. WHEN querying hits THEN the system SHALL use cursor-based pagination with before_nonce/after_nonce
4. WHEN computing statistics THEN the system SHALL leverage SQL aggregation functions for server-side calculation
5. WHEN handling concurrent queries THEN the system SHALL maintain query performance under load

### Requirement 12

**User Story:** As a gambling analyst, I want global statistics that span the entire seed history, so that I can understand overall patterns for rare multipliers.

#### Acceptance Criteria

1. WHEN requesting global stats THEN the system SHALL compute statistics over the full 0-70k nonce range
2. WHEN showing theoretical vs observed THEN the system SHALL compare observed median with theoretical expectation (1/probability)
3. WHEN displaying ETA THEN the system SHALL show estimated nonces until next occurrence based on historical patterns
4. WHEN computing confidence THEN the system SHALL show confidence intervals for median estimates
5. WHEN tracking trends THEN the system SHALL identify if recent ranges deviate from historical patterns
6. WHEN labeling statistics THEN the system SHALL clearly mark statistics as "Exact (SQL)" or "Approximate (t-digest)" so analysts can distinguish between precise and estimated values

### Requirement 13

**User Story:** As a provably-fair gaming researcher, I want approximate statistics for ultra-large datasets, so that I can get instant insights even when exact computation would be slow.

#### Acceptance Criteria

1. WHEN handling massive datasets THEN the system SHALL optionally use t-digest or GK sketches for approximate quantiles
2. WHEN precomputing rollups THEN the system SHALL store digest summaries per 10k-nonce shards
3. WHEN merging digests THEN the system SHALL combine shard digests for arbitrary range queries
4. WHEN showing approximation THEN the system SHALL clearly label approximate vs exact statistics
5. WHEN accuracy matters THEN the system SHALL provide option to compute exact statistics for smaller ranges

### Requirement 14

**User Story:** As a betting pattern investigator, I want pattern detection across multiple ranges, so that I can identify clustering behaviors that span large nonce distances.

#### Acceptance Criteria

1. WHEN analyzing clusters THEN the system SHALL identify ranges with unusually high hit density
2. WHEN detecting patterns THEN the system SHALL highlight ranges where median distance deviates significantly from expected
3. WHEN comparing ranges THEN the system SHALL show side-by-side statistics for different 10k windows
4. WHEN tracking evolution THEN the system SHALL show how statistics change across sequential ranges
5. WHEN alerting THEN the system SHALL notify when current range shows unusual patterns compared to history

### Requirement 15

**User Story:** As a development team member, I want comprehensive testing for hit-centric analysis, so that distance calculations and statistics remain accurate across all scenarios.

#### Acceptance Criteria

1. WHEN testing distance calculations THEN the system SHALL verify correct distances across range boundaries
2. WHEN testing bucketing THEN the system SHALL ensure 11200.00 and 11200.0000001 map to same bucket
3. WHEN testing statistics THEN the system SHALL verify median/mean accuracy against known datasets
4. WHEN testing caching THEN the system SHALL verify cache consistency when switching between ranges
5. WHEN testing performance THEN the system SHALL complete 70k nonce analysis within acceptable time limits