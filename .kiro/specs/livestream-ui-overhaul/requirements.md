# Requirements Document

## Introduction

This document outlines the requirements for a streamlined UI overhaul of the LiveStreamDetail page. The goal is to simplify the interface by consolidating dual tables into a single enhanced betting stream table with an intelligent analytics sidebar, eliminating complexity while preserving all analytical capabilities.

## Requirements

### Requirement 1: Sticky Controls Toolbar

**User Story:** As a user analyzing live betting streams, I want the main controls to remain visible while scrolling through the data table, so that I can quickly adjust filters and settings without losing my place in the stream.

#### Acceptance Criteria

1. WHEN the page loads THEN the system SHALL display a sticky toolbar at the top of the content area with backdrop blur and z-index 10
2. WHEN the user scrolls down the page THEN the toolbar SHALL remain fixed at the top of the viewport
3. WHEN the toolbar is displayed THEN it SHALL contain left cluster controls: Min Multiplier input, Difficulty filter, Freeze UI toggle
4. WHEN the toolbar is displayed THEN it SHALL contain right cluster controls: Pinned multiplier chips, Add button, overflow menu, and live stats
5. WHEN live stats are displayed THEN they SHALL show: Last nonce, time delta since last row, Hits/min (EMA-30s), Total bets count

### Requirement 2: Enhanced Betting Stream Table

**User Story:** As a user, I want to monitor live betting activity with distance calculations and multiplier highlighting in a single unified table, so that I can see both raw stream data and analytical insights together.

#### Acceptance Criteria

1. WHEN the table loads THEN it SHALL display columns: Nonce, Date/Time, Amount, Multiplier, Distance, Payout, Difficulty, Target/Result
2. WHEN the Distance column is displayed THEN it SHALL show gap to previous same-multiplier occurrence calculated server-side
3. WHEN the first occurrence of a multiplier is shown THEN the Distance SHALL display "—"
4. WHEN a row matches a pinned multiplier THEN it SHALL display with subtle accent ring and badge color
5. WHEN new bets arrive THEN the system SHALL append rows without resorting unless user clicks header
6. WHEN "Freeze UI" is enabled THEN the system SHALL maintain scroll position during updates
7. WHEN Target/Result data is displayed THEN it SHALL be collapsed to one line format: "T: 1066.73 R: 73.21"
8. WHEN hovering over Target/Result THEN the system SHALL show a two-line tooltip with full labels

### Requirement 3: Analytics Sidebar

**User Story:** As a user, I want detailed multiplier analytics and controls in a dedicated sidebar, so that I can perform focused analysis while monitoring the live stream.

#### Acceptance Criteria

1. WHEN a multiplier is pinned THEN the sidebar SHALL display a stats card with: Count, Last Nonce, Last Gap, Mean Gap, P90 Gap, Max Gap
2. WHEN ETA is calculated THEN it SHALL be displayed below stats, colored by source (observed vs theoretical)
3. WHEN "Focus" is clicked on a pinned multiplier THEN the system SHALL highlight matching rows in the main table
4. WHEN a row is highlighted from "Focus" action THEN it SHALL display a 2-second glow effect and auto-scroll to latest hit
5. WHEN the "+ Pin" button is clicked THEN it SHALL open a searchable popover with available multipliers
6. WHEN the multiplier popover is displayed THEN it SHALL include presets by difficulty and text filter functionality
7. WHEN there are more pinned multipliers than displayed THEN an overflow badge "+N" SHALL show additional count
8. WHEN no multipliers are pinned THEN the sidebar SHALL show helpful onboarding text and suggested multipliers

### Requirement 4: Multiplier Filtering and Highlighting

**User Story:** As a user, I want to filter and highlight specific multipliers in the stream, so that I can quickly identify patterns of interest without losing context of the full stream.

#### Acceptance Criteria

1. WHEN a pinned multiplier chip is clicked THEN the system SHALL toggle "show-only-this" mode for quick filtering
2. WHEN "Show only pinned" is toggled THEN the system SHALL display only rows matching pinned multipliers
3. WHEN filters are applied THEN the system SHALL maintain filter state during real-time updates
4. WHEN a multiplier is clicked in the table THEN it SHALL be automatically added to pinned multipliers in the sidebar
5. WHEN difficulty badges are displayed THEN they SHALL have fixed width to prevent column jitter
6. WHEN filters are active THEN a "Reset Filters" button SHALL be visible in the toolbar

### Requirement 5: Responsive Layout and Visual Polish

**User Story:** As a user, I want a consistent and polished interface that works well at different zoom levels and screen sizes, so that I can analyze data comfortably in various viewing conditions.

#### Acceptance Criteria

1. WHEN the page is displayed on xl+ screens THEN the layout SHALL use a main table (70%) and sidebar (30%) split
2. WHEN the page is displayed on smaller screens THEN the sidebar SHALL collapse to a bottom drawer or overlay
3. WHEN numeric data is displayed THEN it SHALL use tabular numerals (font-mono tabular-nums) for nonces, multipliers, distances, amounts, payouts
4. WHEN numeric columns are displayed THEN they SHALL be right-aligned for quick scanning
5. WHEN the table has more than 2k rows THEN it SHALL use efficient scrolling without virtualization complexity
6. WHEN cards are displayed THEN they SHALL use consistent padding: p-4 with space-y-4 between sections
7. WHEN number abbreviations are used THEN they SHALL show tooltips with full precision (11.2kx, 3.2Mx format)

### Requirement 6: Performance and Memory Management

**User Story:** As a developer, I want the interface to maintain high performance during continuous data streaming, so that users can analyze large datasets without browser slowdown.

#### Acceptance Criteria

1. WHEN processing new bets THEN the system SHALL use incremental updates only, no rescans
2. WHEN calculating distances THEN the system SHALL compute them server-side during ingestion using last-nonce per multiplier map
3. WHEN computing sidebar statistics THEN the system SHALL use efficient algorithms for mean/std of distances
4. WHEN updating sidebar analytics THEN the system SHALL debounce to 250ms to prevent excessive re-renders
5. WHEN in-memory rows exceed 50k THEN the system SHALL cap memory and show "Show older" pagination
6. WHEN live updates occur THEN the system SHALL preserve scroll position when "Freeze UI" is active

### Requirement 7: Alert and Notification System

**User Story:** As a user, I want to be notified of significant events like unusual gaps or clustering patterns, so that I can quickly identify interesting betting patterns.

#### Acceptance Criteria

1. WHEN a pinned multiplier's new distance exceeds max(p95, mean+2σ) THEN the system SHALL show a gap alert in the sidebar
2. WHEN N or more hits ≥X occur within W nonces THEN the system SHALL show a cluster alert
3. WHEN alerts are triggered THEN they SHALL display as toast notifications with temporary row highlighting in the main table
4. WHEN alerts are active THEN the sidebar SHALL show an "Alerts" section with alert history
5. WHEN alert notifications are displayed THEN they SHALL be non-blocking and auto-dismiss after 5 seconds

### Requirement 8: Keyboard Navigation and Accessibility

**User Story:** As a power user, I want keyboard shortcuts and accessible navigation, so that I can efficiently control the interface without relying solely on mouse interactions.

#### Acceptance Criteria

1. WHEN "/" key is pressed THEN the system SHALL focus the min-multiplier input field
2. WHEN "J" or "K" keys are pressed THEN the system SHALL move table row selection up/down
3. WHEN "G" key is pressed THEN the system SHALL open "Go to nonce..." dialog
4. WHEN "S" key is pressed THEN the system SHALL toggle the sidebar visibility
5. WHEN keyboard navigation is used THEN all interactive elements SHALL be accessible via tab order
6. WHEN screen readers are used THEN the table and sidebar SHALL have proper ARIA labels and descriptions

### Requirement 9: Data Export and Stream Management

**User Story:** As a user, I want to export filtered data and manage stream settings, so that I can save analysis results and configure streams for my workflow.

#### Acceptance Criteria

1. WHEN Export CSV is clicked THEN the system SHALL export currently filtered/visible data from the main table
2. WHEN exporting with pinned multipliers THEN the system SHALL include sidebar analytics data in a separate sheet
3. WHEN stream notes are edited THEN changes SHALL be saved automatically with visual feedback
4. WHEN stream deletion is requested THEN the system SHALL show confirmation dialog with clear warning
5. WHEN export operations are in progress THEN the system SHALL show progress indicators in the toolbar
