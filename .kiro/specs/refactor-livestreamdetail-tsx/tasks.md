# Tasks for Refactor LiveStreamDetail.tsx

This document breaks down the refactoring of `LiveStreamDetail.tsx` into actionable tasks, following the three-phase approach outlined in the technical design.

## Phase 1: Logic Consolidation

**Objective**: Replace all manual data fetching, polling, and state management inside `LiveStreamDetail.tsx` with existing, specialized hooks.

-   **Task 1.1: Integrate `useStreamTail` for Real-Time Updates** ✅
    -   **Description**: Remove the manual `useEffect` polling logic (lines 147-183) and associated state variables (`lastId`, `newBetsCount`, `isPolling`, `highFrequencyMode`, `pollingIntervalRef`).
    -   **Implementation**:
        1.  Instantiate the `useStreamTail` hook.
        2.  Wire the existing `isPolling` and `highFrequencyMode` state controls to the `enabled` and `pollingInterval` options of the hook.
        3.  Use the `onNewBets` callback from the hook to update the component's primary `bets` state.

-   **Task 1.2: Integrate `useAnalyticsState` for Advanced Metrics** ✅
    -   **Description**: Wire the `useAnalyticsState` hook into the data flow to process incoming bets.
    -   **Implementation**:
        1.  Instantiate the `useAnalyticsState` hook.
        2.  Inside the `onNewBets` callback provided to `useStreamTail`, call `analytics.updateFromTail(newBets)`.

-   **Task 1.3: Simplify Local State** ✅
    -   **Description**: Remove all `useState` and `useEffect` calls that are now redundant after the integration of the specialized hooks.
    -   **Implementation**:
        1.  Review all state variables in `LiveStreamDetail.tsx`.
        2.  Remove any state that is now managed by `useStreamTail`, `useAnalyticsState`, or `useEnhancedStreamDetail`.
        3.  Ensure the only remaining state is for UI controls (e.g., filter inputs, notes editing).

## Phase 2: UI Modernization

**Objective**: Replace the legacy inline table with the new, feature-rich `LiveBetTable` component.

-   **Task 2.1: Replace Table Implementation**
    -   **Description**: Remove the entire `<Table>...</Table>` block (lines 747-819) and replace it with the `<LiveBetTable />` component.
    -   **Implementation**:
        1.  Delete the JSX for the old table.
        2.  Import and render the `LiveBetTable` component in its place.

-   **Task 2.2: Connect State to Props**
    -   **Description**: Pass the required data and handlers from the `LiveStreamDetail` component's state (now managed by hooks) to the `LiveBetTable` component as props.
    -   **Implementation**:
        1.  Connect the `bets` state to the `bets` prop.
        2.  Connect the `betsLoading` state to the `isLoading` prop.
        3.  Pass down the filter state and `onFilter`/`onSort` handlers to manage the table's presentation.
        4.  Enable the `showDistanceColumn` prop.

## Phase 3: Component Extraction

**Objective**: Break down the remaining UI sections of `LiveStreamDetail` into smaller, "dumb" components.

-   **Task 3.1: Create `StreamMetadataCard` Component**
    -   **Description**: Extract the JSX for displaying stream info, seeds, and statistics (lines 415-568) into a new component.
    -   **Implementation**:
        1.  Create a new file: `pump-frontend/src/components/live-streams/StreamMetadataCard.tsx`.
        2.  Define the `StreamMetadataCardProps` interface as specified in the design.
        3.  Move the relevant JSX from `LiveStreamDetail.tsx` into the new component.
        4.  Replace the extracted JSX in `LiveStreamDetail.tsx` with the new `<StreamMetadataCard />` component, passing the required props.

-   **Task 3.2: Create `BetFiltersPanel` Component**
    -   **Description**: Extract the JSX for filter controls (lines 621-699) into a new component.
    -   **Implementation**:
        1.  Create a new file: `pump-frontend/src/components/live-streams/BetFiltersPanel.tsx`.
        2.  Define the `BetFiltersPanelProps` interface.
        3.  Move the filter-related JSX into the new component.
        4.  Replace it in `LiveStreamDetail.tsx` with `<BetFiltersPanel />`, passing the required props.

-   **Task 3.3: Create `StreamActionsPanel` Component**
    -   **Description**: Extract the action buttons (lines 570-617) into a new component.
    -   **Implementation**:
        1.  Create `pump-frontend/src/components/live-streams/StreamActionsPanel.tsx`.
        2.  Define `StreamActionsPanelProps`.
        3.  Move the action buttons JSX into the new component.
        4.  Replace it in the parent with `<StreamActionsPanel />`.

-   **Task 3.4: Create `StreamNotesEditor` Component**
    -   **Description**: Extract the notes section (lines 515-568) into its own component.
    -   **Implementation**:
        1.  Create `pump-frontend/src/components/live-streams/StreamNotesEditor.tsx`.
        2.  Define `StreamNotesEditorProps`.
        3.  Move the notes display and editing JSX into the new component.
        4.  Replace it in the parent with `<StreamNotesEditor />`.
