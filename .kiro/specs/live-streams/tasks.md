# Implementation Plan

- [x] 1. Create database models for live streams functionality






  - Create `app/models/live_streams.py` with LiveStream, LiveBet, and SeedAlias SQLModel classes
  - Implement proper field validation, constraints, and relationships
  - Add database indexes for performance optimization
  - _Requirements: 2.1, 2.2, 7.2_

- [x] 2. Set up database integration and migrations







  - Update `app/db.py` to import live streams models for table creation
  - Ensure foreign key constraints and indexes are properly created
  - Test database schema creation and constraint enforcement
  - _Requirements: 7.2, 7.3_

- [x] 3. Create Pydantic schemas for API request/response validation







  - Create `app/schemas/live_streams.py` with IngestBetRequest, StreamSummary, StreamDetail, BetRecord, and TailResponse models
  - Implement field validation for flattened payload structure
  - Add response models for all API endpoints
  - _Requirements: 1.1, 1.4, 7.1_

- [x] 4. Implement ingestion API endpoint



- [x] 4.1 Create basic ingestion router structure


  - Create `app/routers/live_streams.py` with POST `/live/ingest` endpoint
  - Implement X-Ingest-Token authentication middleware
  - Add basic request validation and error handling
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4.2 Implement stream upsert and bet insertion logic


  - Code automatic stream creation for new seed pairs
  - Implement idempotent bet insertion with duplicate handling
  - Add timestamp parsing with UTC conversion and null fallback
  - Update last_seen_at on stream activity
  - _Requirements: 2.1, 2.2, 2.5, 7.4_

- [x] 4.3 Add comprehensive error handling and responses


  - Implement proper HTTP status codes and error messages
  - Add validation error responses with detailed field information
  - Handle database constraint violations gracefully
  - _Requirements: 1.4, 1.5, 7.5_

- [x] 5. Implement live streams query APIs





- [x] 5.1 Create streams listing endpoint


  - Implement GET `/live/streams` with pagination and sorting
  - Add stream metadata aggregation (total bets, highest multiplier)
  - Include proper limit enforcement (≤100) and offset handling
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 5.2 Create stream detail endpoint


  - Implement GET `/live/streams/{id}` for individual stream summary
  - Add stream validation and 404 handling for invalid IDs
  - Include recent activity and statistical summaries
  - _Requirements: 4.1, 4.2_

- [x] 5.3 Create paginated bets listing endpoint


  - Implement GET `/live/streams/{id}/bets` with filtering and pagination
  - Add min_multiplier filtering and order options (nonce_asc|id_desc)
  - Enforce limit constraints (≤1000) and proper offset handling
  - _Requirements: 4.2, 4.3_

- [x] 5.4 Create tail endpoint for incremental updates


  - Implement GET `/live/streams/{id}/tail` with since_id parameter
  - Return only new bets with id > since_id ordered by id ASC
  - Include last_id in response for next polling iteration
  - _Requirements: 5.1, 5.2_

- [x] 6. Implement stream management endpoints





- [x] 6.1 Create stream deletion endpoint


  - Implement DELETE `/live/streams/{id}` with cascade deletion
  - Add proper authorization and confirmation handling
  - Include comprehensive error responses for invalid operations
  - _Requirements: 6.2, 6.4_

- [x] 6.2 Create stream update endpoint


  - Implement PUT `/live/streams/{id}` for notes and metadata updates
  - Add input validation and sanitization for user content
  - Handle concurrent update scenarios properly
  - _Requirements: 6.3_

- [x] 6.3 Create CSV export endpoint


  - Implement GET `/live/streams/{id}/export.csv` for data export
  - Generate CSV with all bets ordered by nonce ASC
  - Add proper content-type headers and streaming for large datasets
  - _Requirements: 6.1_

- [x] 7. Integrate live streams router with main application





  - Update `app/main.py` to include live streams router
  - Ensure proper CORS configuration for new endpoints
  - Add health check integration for live streams functionality
  - _Requirements: 7.1, 7.3_
-

- [-] 8. Create React pages for live streams interface


- [x] 8.1 Create LiveStreamsList page component


  - Implement streams table with seed hash prefix, client seed, last_seen, total_rows
  - Add "Auto-follow latest" toggle with polling logic
  - Include navigation to stream detail pages
  - Add loading states and error handling
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8.2 Create LiveStreamDetail page component





  - Implement stream metadata header with seed information and statistics
  - Create bet table with nonce ASC default ordering
  - Add min_multiplier filtering functionality
  - Include export and delete action buttons
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 9. Implement real-time updates for frontend

- [ ] 9.1 Create useLiveStreams hook
  - Implement TanStack Query integration for streams listing
  - Add automatic refetching and cache management
  - Include error handling and retry logic
  - _Requirements: 3.5, 5.3_

- [ ] 9.2 Create useStreamDetail hook
  - Implement stream-specific data fetching with TanStack Query
  - Add real-time polling integration for stream updates
  - Include loading and error state management
  - _Requirements: 4.4, 5.1, 5.4_

- [ ] 9.3 Create useStreamTail hook
  - Implement incremental bet updates using since_id parameter
  - Add polling every 1-2 seconds with automatic error recovery
  - Include optimistic UI updates and conflict resolution
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 10. Add navigation and routing for live streams

  - Update main navigation to include "Live" section
  - Add React Router routes for `/live` and `/live/:id` pages
  - Implement proper route guards and parameter validation
  - Add breadcrumb navigation for stream detail pages
  - _Requirements: 3.4, 4.5_

- [ ] 11. Create reusable UI components for live streams

- [ ] 11.1 Create StreamSummaryCard component
  - Implement compact stream information display
  - Add activity indicators and quick action buttons
  - Include proper loading and error states
  - _Requirements: 3.1, 3.5_

- [ ] 11.2 Create LiveBetTable component
  - Implement sortable, filterable table for bet records
  - Add real-time row additions with smooth animations
  - Include multiplier highlighting and difficulty badges
  - Add virtual scrolling for performance with large datasets
  - _Requirements: 4.2, 4.3, 5.1_

- [ ] 11.3 Create StreamActions component
  - Implement export, delete, and note management actions
  - Add confirmation dialogs for destructive operations
  - Include proper error handling and user feedback
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 12. Add comprehensive error handling and user feedback
  - Implement toast notifications for stream operations
  - Add "New stream detected" notifications with navigation options
  - Create error boundary components for live streams pages
  - Add offline state detection and recovery mechanisms
  - _Requirements: 5.5, 6.4_

- [ ] 13. Write comprehensive tests for backend functionality
- [ ] 13.1 Create unit tests for models and validation
  - Test LiveStream, LiveBet, and SeedAlias model validation
  - Add constraint testing for database fields
  - Test relationship integrity and cascade operations
  - _Requirements: 7.2, 7.5_

- [ ] 13.2 Create integration tests for API endpoints
  - Test complete ingestion workflow with various payloads
  - Add concurrent request handling tests
  - Test tail endpoint semantics with since_id ordering
  - Add null date_time and duplicate handling tests
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 5.1_

- [ ] 13.3 Create tests for query and management endpoints
  - Test pagination, filtering, and sorting functionality
  - Add stream deletion and update operation tests
  - Test CSV export functionality with large datasets
  - _Requirements: 3.1, 4.2, 6.1, 6.2_

- [ ] 14. Write tests for frontend components and hooks
- [ ] 14.1 Create component tests for pages and UI elements
  - Test LiveStreamsList and LiveStreamDetail page rendering
  - Add interaction testing for filtering and navigation
  - Test error states and loading indicators
  - _Requirements: 3.1, 4.1, 4.3_

- [ ] 14.2 Create tests for custom hooks and real-time updates
  - Test useLiveStreams, useStreamDetail, and useStreamTail hooks
  - Add polling behavior and error recovery testing
  - Test cache management and optimistic updates
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 15. Add configuration and security enhancements
  - Add X-Ingest-Token configuration to environment settings
  - Implement API binding to 127.0.0.1 for local-only access
  - Add CORS configuration specifically for live streams endpoints
  - Include rate limiting configuration for ingestion endpoint
  - _Requirements: 1.2, 1.3, 7.1_