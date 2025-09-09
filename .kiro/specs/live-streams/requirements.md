# Requirements Document

## Introduction

The Live Streams feature enables real-time ingestion and display of filtered bets from Antebot, automatically grouping them by seed pairs (serverSeedHashed, clientSeed) into separate live stream pages. This feature provides near-real-time monitoring of betting activity for specific seed combinations without requiring WebSocket connections, using polling or Server-Sent Events (SSE) for UI updates.

## Requirements

### Requirement 1

**User Story:** As a user monitoring betting activity, I want Antebot to send filtered bets to our system, so that I can track specific betting patterns in real-time.

#### Acceptance Criteria

1. WHEN Antebot sends a POST request to `/live/ingest` with valid bet data THEN the system SHALL accept and store the bet data
2. WHEN the request includes a valid X-Ingest-Token header THEN the system SHALL process the request
3. WHEN the request lacks a valid token THEN the system SHALL reject the request with 401 Unauthorized
4. WHEN duplicate bet data is received THEN the system SHALL handle it idempotently and return 200 OK with accepted:false
5. WHEN invalid or malformed data is received THEN the system SHALL return appropriate error responses

### Requirement 2

**User Story:** As a user analyzing betting patterns, I want bets to be automatically grouped by their seed pairs, so that I can view all bets for a specific seed combination together.

#### Acceptance Criteria

1. WHEN a bet is received with a new (serverSeedHashed, clientSeed) combination THEN the system SHALL create a new live stream
2. WHEN a bet is received with an existing seed pair THEN the system SHALL add it to the corresponding existing stream
3. WHEN seed values change THEN the system SHALL automatically create a new stream without manual intervention
4. IF a stream exists for a seed pair THEN all bets with that exact pair SHALL be grouped together
5. WHEN a new stream is created THEN the system SHALL update the last_seen_at timestamp

### Requirement 3

**User Story:** As a user monitoring live betting activity, I want to view a list of all active streams, so that I can select which seed pair to monitor.

#### Acceptance Criteria

1. WHEN I access the live streams list page THEN the system SHALL display all streams with their basic information
2. WHEN displaying streams THEN the system SHALL show last_seen timestamp, seed hash prefix, client seed, and total bet count
3. WHEN I enable "Auto-follow latest" THEN the system SHALL automatically load the most recently active stream
4. WHEN I click on a stream THEN the system SHALL navigate to the detailed stream view
5. IF no streams exist THEN the system SHALL display an appropriate empty state message

### Requirement 4

**User Story:** As a user analyzing a specific seed pair, I want to view detailed information about a stream, so that I can monitor betting activity for that seed combination.

#### Acceptance Criteria

1. WHEN I access a stream detail page THEN the system SHALL display stream metadata including seeds, timestamps, and summary statistics
2. WHEN displaying bets THEN the system SHALL show nonce, date_time, amount, payout_multiplier, payout, difficulty, round_target, and round_result
3. WHEN I apply a minimum multiplier filter THEN the system SHALL only show bets meeting that criteria
4. WHEN new bets arrive THEN the system SHALL update the display within 1-2 seconds
5. WHEN I request data export THEN the system SHALL provide CSV download functionality

### Requirement 5

**User Story:** As a user monitoring live activity, I want the interface to update automatically with new bets, so that I don't need to manually refresh the page.

#### Acceptance Criteria

1. WHEN new bets are added to a stream THEN the UI SHALL update automatically within 1-2 seconds
2. WHEN using polling updates THEN the system SHALL use incremental queries with since_id parameter
3. WHEN using SSE THEN the system SHALL maintain real-time event streams per stream
4. IF connection is lost THEN the system SHALL attempt to reconnect automatically
5. WHEN a new stream is detected THEN the system SHALL show a notification with option to open

### Requirement 6

**User Story:** As a user managing betting data, I want to export and delete streams, so that I can manage data retention and analysis workflows.

#### Acceptance Criteria

1. WHEN I request stream export THEN the system SHALL generate a CSV file with all bets for that stream
2. WHEN I delete a stream THEN the system SHALL remove the stream and all associated bets
3. WHEN I add notes to a stream THEN the system SHALL persist and display those notes
4. WHEN confirming deletion THEN the system SHALL require explicit confirmation before proceeding
5. IF export fails THEN the system SHALL provide clear error messaging

### Requirement 7

**User Story:** As a system administrator, I want the ingestion endpoint to be secure and performant, so that the system can handle filtered bet data reliably.

#### Acceptance Criteria

1. WHEN processing ingestion requests THEN the system SHALL validate all required fields
2. WHEN storing bet data THEN the system SHALL ensure data integrity with proper constraints
3. WHEN handling concurrent requests THEN the system SHALL maintain data consistency
4. WHEN parsing timestamps THEN the system SHALL convert to UTC and handle invalid formats gracefully
5. IF database constraints are violated THEN the system SHALL return appropriate error responses

### Requirement 8

**User Story:** As a user working with seed verification, I want to optionally link hashed seeds to their plain text versions, so that I can perform verification after seed rotation.

#### Acceptance Criteria

1. WHEN I provide a plain text server seed THEN the system SHALL optionally store the mapping to its hash
2. WHEN viewing stream details THEN the system SHALL display linked plain text seeds if available
3. WHEN seeds are rotated THEN the system SHALL maintain historical seed mappings
4. IF no plain text seed is provided THEN the system SHALL function normally with only hashed values
5. WHEN managing seed aliases THEN the system SHALL track first_seen and last_seen timestamps