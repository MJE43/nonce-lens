# Requirements Document

## Introduction
This document outlines the requirements for refactoring the `LiveStreamDetail.tsx` component. The goal is to improve code maintainability, leverage existing hooks for logic, and modularize the UI by breaking it down into smaller, reusable components. This refactor will result in a cleaner, more scalable, and easier-to-understand codebase.

## Requirements

### Requirement 1: Logic Consolidation
**Objective:** As a developer, I want to refactor `LiveStreamDetail.tsx` to use existing specialized hooks for data fetching and state management, so that logic is centralized, reusable, and easier to maintain.

#### Acceptance Criteria
1.  WHEN the `LiveStreamDetail` component is active, THEN the system SHALL use the `useStreamTail` hook to manage real-time bet updates.
2.  IF manual polling logic exists in a `useEffect` hook, THEN the system SHALL replace it entirely with the `useStreamTail` hook.
3.  WHEN `useStreamTail` receives new bets, THEN the system SHALL invoke `analytics.updateFromTail` to update the analytics state.
4.  IF `isPolling` or `highFrequencyMode` state changes, THEN the system SHALL pass these states as options to the `useStreamTail` hook.
5.  IF data fetching and analytics logic are handled by hooks, THEN the `LiveStreamDetail` component SHALL only contain state related to UI controls.

### Requirement 2: UI Modernization
**Objective:** As a developer, I want to replace the legacy table with the modern `LiveBetTable` component, so that the UI is consistent and benefits from enhanced features.

#### Acceptance Criteria
1.  WHERE bet data is displayed, THE system SHALL use the `<LiveBetTable />` component.
2.  IF a legacy `<Table>` implementation exists for displaying bets, THEN the system SHALL remove it.
3.  WHEN data is updated by the state management hooks, THEN the `LiveStreamDetail` component SHALL pass the updated `bets` and `isLoading` state as props to the `LiveBetTable` component.
4.  WHEN the user interacts with filter or sort controls, THEN the `LiveStreamDetail` component SHALL provide `onFilter` and `onSort` handlers to the `LiveBetTable` to manage local UI state.

### Requirement 3: Component Extraction
**Objective:** As a developer, I want to decompose the `LiveStreamDetail` UI into smaller, single-responsibility components, so that the codebase is more modular and easier to understand.

#### Acceptance Criteria
1.  WHERE stream metadata is displayed, THE system SHALL use a dedicated `StreamMetadataCard` component.
2.  WHERE bet filtering controls are displayed, THE system SHALL use a dedicated `BetFiltersPanel` component.
3.  IF distinct UI sections for status, notes, or actions exist, THEN the system SHALL extract them into `StreamStatusPanel`, `StreamNotesEditor`, and `StreamActionsPanel` components respectively.
4.  IF a child component requires data or callbacks, THEN the `LiveStreamDetail` component SHALL pass all necessary data and callbacks as props.
