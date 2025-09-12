# Implementation Plan

- [x] 1. Database schema and indexing foundation




  - Add generated `bucket_2dp` column to `live_bets` table with proper rounding
  - Create composite indexes for efficient hit queries: `(stream_id, bucket_2dp, nonce)` and `(stream_id, nonce, bucket_2dp)`
  - Write migration script to populate existing data and verify index performance
  - _Requirements: 1.1, 1.2, 3.3, 11.1_

- [x] 2. Hit query API endpoint implementation




  - Create `/live/streams/{stream_id}/hits` endpoint with bucket, range, and pagination parameters
  - Implement server-side distance calculation using LAG window function with proper range boundary handling
  - Add query parameter validation and error handling for invalid buckets/ranges
  - Write comprehensive API tests covering edge cases and performance scenarios
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.4, 11.1_





- [x] 3. Hit statistics API endpoints



  - Implement `/live/streams/{stream_id}/hits/stats` for per-range statistics using SQL aggregation
  - Create `/live/streams/{stream_id}/hits/stats/global` for full-seed statistics with theoretical ETA


  - Add percentile calculations using `percentile_cont()` for accurate medians
  - Include method labeling ("exact" vs "approximate") in all statistical responses
  - _Requirements: 4.1, 4.2, 4.4, 12.1, 12.2, 12.6_

- [x] 4. Batch hit query endpoint



  - Create `/live/streams/{stream_id}/hits/batch` for multi-bucket queries
  - Implement efficient batching logic to minimize database round trips
  - Add response formatting for `hits_by_bucket` and `stats_by_bucket` structure
  - Write tests for concurrent bucket analysis scenarios
  - _Requirements: 2.4, 6.1, 6.2_
-

- [x] 5. Shared analysis engine implementation





  - Create centralized `analysisMath.ts` with consistent bucketing using `Math.round(multiplier * 100) / 100`
  - Implement `computeDistancesNonceAsc()` function for client-side distance calculation
  - Add `calculateBucketStats()` for median, mean, min, max calculations
  - Write comprehensive unit tests ensuring calculation consistency across all scenarios
  - _Requirements: 7.1, 7.2, 7.3, 15.1, 15.2_

- [x] 6. Analysis context provider




  - Create `AnalysisProvider` React context with unified state management
  - Implement mode switching between 'live' and 'analysis' with proper data isolation
  - Add focused bucket management and current range state
  - Include `statsByPinnedBuckets` pre-computation for efficient chip rendering
  - Generate dynamic `scopeLabel` based on current analysis state
  - _Requirements: 7.4, 7.5, 8.1, 8.2, 8.5_




- [x] 7. Hit-centric data fetching hooks

  - Create `useHits()` hook with React Query integration and range-based caching
  - Implement `useHitStats()` and `useGlobalHitStats()` hooks for statistics fetching
  - Add `useHitsBatch()` for multi-bucket analysis
  - Configure cache strategies: 5-minute stale time for hits, 2-minute for stats
  - _Requirements: 1.5, 9.1, 9.2, 9.4_

- [ ] 7.1 Hook integration and testing






  - Create integration tests for hit-centric hooks with real API endpoints
  - Add error handling and loading state management in hook implementations
  - Verify cache invalidation and data consistency across hook interactions
  - Test hook performance with large datasets (10k+ hits)
  - _Requirements: 9.1, 9.2, 15.1, 15.2_

- [x] 8. Range navigator component






  - Create `RangeNavigator` component with prev/next 10k range buttons and jump-to input
  - Add visual indicators for current position within full nonce span
  - Implement keyboard shortcuts for range navigation (arrow keys, page up/down)
  - Include range size configuration (default 10k, configurable to 5k/20k)
  - Add `RangeSelector` dropdown for quick range selection
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
- [x] 9. Sticky analysis bar component




- [ ] 9. Sticky analysis bar component


  - Create `AnalysisBar` with mode toggle, min multiplier input, and range controls
  - Display focused bucket statistics (count, median, mean, range) with live updates
  - Show clear scope indicator: "43 hits • nonce 60k–70k • bucket 11.2kx"
  - Add exit analysis button and keyboard shortcut support
  - Create `StatisticsDisplay` component for showing hit statistics
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_




- [ ] 10. Pinned multiplier chips system


  - Create `MultiplierChip` component with bucket value and statistics display
  - Implement pinned bucket management in session state with persistence option
  - Add click-to-focus functionality and right-click/kebab menu for removal
  - Use pre-computed `statsByPinnedBuckets` for instant chip updates
  - Create `PinnedChipsContainer` component to manage multiple chips
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Table integration with hit-centric analysis





  - Modify existing table to display hit-only data in analysis mode
  - Integrate distance column with precomputed values from hit API

  - Add row highlighting when clicking chip statistics
  - Implement proper virtualization for 10k+ hits per range
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
-

- [x] 11.1 LiveStreamDetail page integration








  - Integrate hit-centric hooks (`useHits`, `useHitStats`, `useHitsBatch`) into LiveStreamDetail page
  - Connect AnalysisProvider context with existing page state management
  - Add mode switching logic between live streaming and hit-centric analysis
  - Update page layout to accommodate analysis bar and range navigator
  - _Requirements: 8.1, 8.2, 10.1, 10.2_

- [ ] 12. Performance optimizations and caching
  - Implement React Query cache management with LRU eviction for old ranges
  - Add Web Worker support for large distance calculations (optional)
  - Configure gzip compression for API responses
  - Add query performance monitoring and slow query alerts
  - _Requirements: 9.3, 9.5, 1.2, 1.4_

- [ ] 13. Error handling and user feedback
  - Create `AnalysisErrorBoundary` component for analysis-specific error handling
  - Add user-friendly error messages for common scenarios (range too large, invalid bucket)
  - Implement loading states and progress indicators for large range queries
  - Add retry logic with exponential backoff for failed requests
  - Create `LoadingSpinner` and `ErrorMessage` components for analysis views
  - _Requirements: 1.3, 4.3_

- [ ] 14. Global statistics and pattern detection
  - Create `GlobalStatsPanel` component to display theoretical vs observed ETA calculations
  - Add confidence interval computation for median estimates
  - Implement pattern detection for unusual clustering in current vs historical ranges
  - Create `PatternAlert` component for deviation notifications
  - Add `ComparisonView` for side-by-side range statistics
  - _Requirements: 12.2, 12.3, 12.5, 14.1, 14.2, 14.4_

- [ ] 15. Optional rollup system for massive datasets
  - Create `hit_rollups` table with on-demand generation and 1-hour cache expiration
  - Implement t-digest or GK sketch integration for approximate quantiles
  - Add rollup generation logic triggered by large range queries (>50k nonces)
  - Include clear labeling of approximate vs exact statistics in UI
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 16. Comprehensive testing suite
  - Write unit tests for distance calculation accuracy across range boundaries
  - Add integration tests for hit API endpoints with large datasets
  - Create end-to-end tests for complete analysis workflow (select multiplier → navigate ranges → verify statistics)
  - Implement performance tests ensuring 70k nonce analysis completes within 2 seconds
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 17. Accessibility and keyboard navigation
  - Add proper ARIA labels and focus management for analysis components
  - Implement keyboard shortcuts: "/" for filter focus, "J/K" for navigation, "G" for jump-to
  - Ensure screen reader compatibility for statistics announcements
  - Add high contrast mode support for multiplier chips and range indicators
  - Create `KeyboardShortcuts` component to display available shortcuts
  - _Requirements: 8.4, 10.2_

- [ ] 18. Documentation and monitoring
  - Create API documentation for new hit-centric endpoints
  - Add performance monitoring dashboards for query response times and cache hit rates
  - Write user guide for analysis mode workflow and keyboard shortcuts
  - Implement business metrics tracking for most analyzed multipliers and session durations
  - _Requirements: 4.5, 12.4_