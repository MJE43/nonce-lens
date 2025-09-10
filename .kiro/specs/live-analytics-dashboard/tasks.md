# Implementation Plan

## Backend API Enhancements - COMPLETED ✅

- [x] 1.1 Enhanced tail endpoint with distance calculations
  - Modify `/live/streams/{id}/tail` to support `include_distance` parameter
  - Add server-side distance calculation using window function: `nonce - LAG(nonce) OVER (PARTITION BY payout_multiplier ORDER BY nonce)`
  - Return `distance_prev_opt` field in BetRecord responses
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 1.2 Bookmarks CRUD endpoints
  - Create `live_bookmarks` table with fields: id, stream_id, nonce, multiplier, note, created_at
  - Implement POST `/live/streams/{id}/bookmarks` for creating bookmarks
  - Implement GET `/live/streams/{id}/bookmarks` for listing bookmarks
  - Implement DELETE `/live/bookmarks/{id}` for removing bookmarks
  - Implement PUT `/live/bookmarks/{id}` for updating bookmark notes
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 1.3 Snapshots CRUD endpoints
  - Create `live_snapshots` table with fields: id, stream_id, name, filter_state, last_id_checkpoint, created_at
  - Implement POST `/live/streams/{id}/snapshots` for creating snapshots
  - Implement GET `/live/streams/{id}/snapshots` for listing snapshots
  - Implement GET `/live/streams/{id}/snapshots/{snapshot_id}/replay` for replaying snapshot data
  - Implement DELETE `/live/snapshots/{id}` for removing snapshots
  - _Requirements: 8.4, 8.5, 18.1, 18.2, 18.3_

- [x] 1.4 Optional server-side metrics endpoint
  - Implement GET `/live/streams/{id}/metrics` for pre-aggregated analytics
  - Support pinned multipliers parameter for targeted calculations
  - Return KPIs, multiplier stats, density buckets, and top peaks
  - _Requirements: 20.1, 20.2_

## Frontend Analytics State Management - COMPLETED ✅

- [x] 2.1 Incremental calculators implementation
  - Create WelfordCalculator class for mean/std calculations using Welford's method
  - Create HistogramQuantileEstimator class for p90/p99 approximation using 64-bin histogram
  - Create EMACalculator class for 30-second exponential moving average
  - Create RingBuffer class for last_k_gaps tracking (k=50)
  - Create DensityBucketManager class for hit density visualization
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 2.2 Alert engine implementation
  - Create AlertEngine class with gap, cluster, and threshold alert types
  - Implement gap alerts using p95 threshold or mean + z*std deviation
  - Implement cluster alerts with sliding window by nonce and time
  - Implement threshold alerts for high multiplier detection
  - Add rate limiting (one toast per multiplier per 10s)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 2.3 Analytics state hook
  - Create useAnalyticsState hook for managing all incremental calculations
  - Integrate multiplier tracking with pinned multipliers persistence
  - Implement client-side distance calculation fallback
  - Add rolling window statistics calculator
  - Manage top peaks list (N=20) with live updates
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 7.1, 7.2, 16.1, 16.2_

## Live KPIs Panel Component - COMPLETED ✅

- [x] 3.1 Create LiveKPIPanel component
  - Display highest multiplier, hits count, hit rate (hits/min)
  - Show 30-second EMA hit rate calculation
  - Display latest nonce, latest gap, and stream duration
  - Update incrementally from tail appends without rescanning
  - Support "Freeze UI" mode that continues stats updates while stopping auto-scroll
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [x] 3.2 Add filters toggle for KPIs
  - Implement "Apply filters to KPIs" toggle option
  - By default, KPIs show all-rows statistics
  - When enabled, apply table filters to KPI calculations
  - _Requirements: 5.1, 5.2_

## Multiplier Tracker Component - COMPLETED ✅

- [x] 4.1 Create MultiplierTracker component
  - Implement multiplier selection chips from stream's distinct multipliers or preset list
  - Display per-multiplier stats: count, last_nonce, last_gap, mean_gap, std_gap, max_gap, p90_gap
  - Calculate ETA using theoretical probability tables when available, else observed mean_gap
  - Show ETA model type (theoretical vs observed)
  - Implement "show distances" functionality to scroll and highlight table rows
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4.2 Persist pinned multipliers
  - Store pinned multipliers in session storage for persistence
  - Maintain ring buffer of last 50 gaps per pinned multiplier
  - Reset counters when switching streams
  - _Requirements: 2.2, 1.8_

- [ ] 5. Live Table Enhancements

- [ ] 5.1 Add distance column to live table



  - Display nonce gap to previous same-multiplier hit
  - Show "—" for first occurrence of each multiplier
  - Use client-side calculation when server doesn't provide distance_prev_opt
  - Handle historical pages with blank distance until fetched with include_distance=1
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5.2 Implement live filters
  - Add minimum multiplier threshold filter
  - Add sort options: "latest first" (id DESC) and "nonce ascending" (nonce ASC)
  - Add toggle for showing only pinned multipliers
  - Apply filters to table view only by default
  - Show "x of y" indicators when filters hide rows
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.4_

- [ ] 5.3 Add bookmark functionality to table rows

  - Add star icons to each table row for bookmarking
  - Implement click-to-bookmark with optional note addition
  - Show bookmarked state visually in table rows
  - _Requirements: 8.1, 8.2_

- [ ] 6. Hit Density Visualization

- [ ] 6.1 Create DensitySparkline component

  - Implement bucketing with default 1000 nonces per bucket (configurable to 5000)
  - Maintain counts[bucket_id] and recompute sparkline only for modified buckets
  - Handle out-of-order appends using bucket_id = floor(nonce / bucket_size)
  - Display sparkline visualization of hit clusters
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Alerts Panel Component

- [ ] 7.1 Create AlertsPanel component
  - Display recent alerts with non-blocking toasts
  - Show alert configuration interface for gap, cluster, and threshold alerts
  - Implement row highlighting when alerts fire
  - Never pause data ingestion for alerts
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.2 Configure alert rules
  - Gap alerts: trigger when gap > max(p95_observed, mean_gap + z*std_gap)
  - Cluster alerts: sliding window by nonce (2000) and time (60s), trigger when count ≥ 3
  - Threshold alerts: trigger when payout_multiplier ≥ target_x
  - Rate limit to one toast per multiplier per 10 seconds
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Rolling Window Statistics



- [ ] 8.1 Create RollingStatsPanel component
  - Support time window (default 60s) or hit count window (default 200 hits)
  - Calculate rolling mean(multiplier), max(multiplier), hits/min
  - Maintain separate calculations from all-time statistics
  - Highlight when rolling mean deviates from all-time mean by |z| ≥ 2
  - _Requirements: 7.1, 7.2, 7.3, 7.4_


- [ ] 9. Top Peaks List Component

- [ ] 9.1 Create TopPeaksList component
  - Maintain live list of highest N multipliers (default N=20)
  - Provide jump links to scroll to table rows
  - Update automatically when new peaks occur
  - Display multiplier value, nonce, and timestamp with click-to-navigate
  - _Requirements: 16.1, 16.2, 16.3_

- [ ] 10. Bookmarks Management

- [ ] 10.1 Create BookmarksPanel component
  - Display list of bookmarked entries with filtering capability
  - Allow adding/editing notes for bookmarks
  - Implement jump-to-row functionality for bookmarked entries
  - Support removing bookmarks
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 11. Snapshots and Comparison Features
- [ ] 11.1 Create SnapshotManager component
  - Implement snapshot creation with current filter state and last_id checkpoint
  - Allow naming, listing, and deleting saved snapshots
  - Support loading snapshots for replay (rows ≤ checkpoint)
  - _Requirements: 8.4, 8.5, 18.1, 18.2, 18.3, 18.4_

- [ ] 11.2 Create ComparisonView component
  - Implement split view with two panels side-by-side
  - Support current live stream vs historical run comparison
  - Support current vs another live stream comparison
  - Share filter controls between both panels with independent tail polling
  - _Requirements: 8.6, 8.7, 17.1, 17.2, 17.3, 17.4_

- [ ] 12. Enhanced UI Controls and Keyboard Shortcuts
- [ ] 12.1 Implement keyboard navigation
  - Add "/" to focus filter input
  - Add "J/K" for row navigation in table
  - Add "G" for jump to nonce functionality
  - Add "P" for toggle pause/resume
  - Add "F" for toggle freeze UI
  - _Requirements: 10.2, 19.2_

- [ ] 12.2 Enhanced visual design
  - Implement color tiers for multipliers with soft background colors
  - Add sticky action row with Pause/Resume, Poll period, Export, Freeze UI controls
  - Organize layout: header strip, left column KPIs, right column tracker, full-width table
  - _Requirements: 10.1, 10.3, 19.3, 21.1, 21.2, 21.3, 21.4_

- [ ] 13. Performance Optimizations
- [ ] 13.1 Implement memory management
  - Limit tail append to ≤1000 rows per call
  - Keep at most 50k rows client-side
  - Switch to paged mode above 50k with live viewport of last 5k nonces
  - Complete UI append in ≤16ms per 100 rows using virtualized table
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 13.2 Optimize calculations
  - Use fixed 64-bin histogram for quantile approximation
  - Implement TDigest as alternative for better quantile accuracy
  - Manage ring buffers efficiently (last_k_gaps=50, top peaks=20)
  - _Requirements: 9.2, 9.3_

- [ ] 14. Error Handling and Reliability
- [ ] 14.1 Implement robust polling error handling
  - Use exponential backoff up to 5s, resume 500ms on success
  - Maintain UI state during connection issues
  - Handle temporary network issues gracefully
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 14.2 Add accessibility support
  - Ensure focus states on chips and table rows
  - Make toasts ARIA-live polite for screen readers
  - Follow accessibility best practices for interactive elements
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 15. Integration and Testing
- [ ] 15.1 Write unit tests for calculators
  - Test Welford algorithm correctness
  - Test histogram p90 accuracy (±1 bucket tolerance)
  - Test distance column semantics
  - Test ring buffer management
  - _Requirements: 15.1_

- [ ] 15.2 Write integration tests
  - Test tail → KPIs pipeline
  - Test pinned multipliers functionality
  - Test alerts firing and rate limiting
  - Test density bucket increments
  - _Requirements: 15.2_

- [ ] 15.3 Write end-to-end tests
  - Test complete workflow: pin multipliers, configure alerts, bookmark rows, export CSV
  - Test all functionality while tail continues appending
  - Test comparison modes and snapshot functionality
  - _Requirements: 15.3_

- [ ] 16. Final Integration and Polish
- [ ] 16.1 Integrate all components into LiveAnalyticsDashboard
  - Combine all analytics components into main dashboard layout
  - Ensure proper state management between components
  - Test complete user workflows
  - _Requirements: All requirements integration_

- [ ] 16.2 Performance testing and optimization
  - Verify 1000 rows append in <16ms performance target
  - Test memory usage stays <100MB for 50k rows
  - Ensure polling latency <500ms average
  - _Requirements: 14.1, 14.2, 14.3_