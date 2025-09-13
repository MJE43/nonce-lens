# Implementation Plan

- [ ] 1. Set up enhanced data models and types
  - Create TypeScript interfaces for EnhancedBetRecord with distance field
  - Define PinnedMultiplierStats interface for sidebar analytics
  - Update API types to include server-calculated distance data
  - _Requirements: 2.1, 2.2, 3.1_

- [ ] 2. Implement server-side distance calculation
  - Create DistanceCalculator class with last_nonce_by_multiplier map
  - Integrate distance calculation into bet ingestion pipeline
  - Update API endpoints to return distance data with bet records
  - Add unit tests for distance calculation logic
  - _Requirements: 2.2, 6.2_

- [ ] 3. Create enhanced betting stream table component
  - Extend existing BettingActivityTable with distance column
  - Add multiplier highlighting for pinned multipliers
  - Implement click handlers for multiplier selection
  - Add row highlighting effects for focus actions
  - _Requirements: 2.1, 2.4, 4.4_

- [ ] 4. Build analytics sidebar component structure
  - Create AnalyticsSidebar component with responsive layout
  - Implement PinnedMultiplierCard component with stats grid
  - Add multiplier management (pin/unpin/focus) functionality
  - Create searchable multiplier selection popover
  - _Requirements: 3.1, 3.5, 3.8_

- [ ] 5. Implement sidebar statistics calculations
  - Create functions for mean, P90, and max gap calculations
  - Implement ETA calculations (theoretical vs observed)
  - Add real-time statistics updates with debouncing
  - Write unit tests for statistical functions
  - _Requirements: 3.1, 3.2, 6.4_

- [ ] 6. Add multiplier filtering and highlighting system
  - Implement pinned multiplier state management
  - Add "show-only-this" filtering mode for quick analysis
  - Create multiplier chip components for toolbar
  - Add visual highlighting for matching rows in table
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ] 7. Create sticky controls toolbar
  - Build toolbar component with left/right control clusters
  - Add min multiplier input, difficulty filter, freeze UI toggle
  - Implement pinned multiplier chips display with overflow
  - Add live stats display (last nonce, time delta, hits/min, total bets)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 8. Implement focus actions and row highlighting
  - Add focus functionality to highlight specific multiplier rows
  - Create 2-second glow effect for focused rows
  - Implement auto-scroll to latest hit functionality
  - Add visual feedback for user interactions
  - _Requirements: 3.3, 3.4_

- [ ] 9. Add alert and notification system
  - Create alert detection for unusual gaps (p95, mean+2σ)
  - Implement cluster alert detection for multiple hits
  - Add toast notifications with temporary row highlighting
  - Create alerts section in sidebar with history
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Implement responsive layout and visual polish
  - Create 70/30 split layout for xl+ screens
  - Add sidebar collapse to drawer/overlay on smaller screens
  - Apply tabular numerals and right-alignment for numeric columns
  - Implement consistent padding and spacing throughout
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [ ] 11. Add keyboard navigation and accessibility
  - Implement keyboard shortcuts (/, J/K, G, S keys)
  - Add proper ARIA labels and descriptions for screen readers
  - Ensure tab order accessibility for all interactive elements
  - Create "Go to nonce" dialog functionality
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 12. Implement data export functionality
  - Add CSV export for currently filtered/visible table data
  - Include sidebar analytics data in separate export sheet
  - Add progress indicators for export operations
  - Create export button in toolbar with proper state management
  - _Requirements: 9.1, 9.2, 9.5_

- [ ] 13. Add performance optimizations
  - Implement incremental updates for real-time data
  - Add 250ms debouncing for expensive sidebar calculations
  - Create memory management with 50k row cap and pagination
  - Optimize rendering with React.memo for table rows and cards
  - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_

- [ ] 14. Create comprehensive test suite
  - Write unit tests for distance calculations and statistics
  - Add integration tests for real-time updates and interactions
  - Create end-to-end tests for complete user workflows
  - Add performance tests for large dataset handling
  - _Requirements: All requirements validation_

- [ ] 15. Final integration and polish
  - Integrate all components into main LiveStreamDetail page
  - Remove old HitCentricAnalysisTable and MultiplierTracker components
  - Update routing and navigation to use single-table interface
  - Add final visual polish and animation refinements
  - _Requirements: Complete feature integration_