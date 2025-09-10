# Requirements Document

## Project Description (Input)
Migrate the `LiveBetTable` component from a custom implementation to use the TanStack Table library for more robust and maintainable state management.

## Requirements

### Functional Requirements

-   **FR-1 (Feature Parity):** The migrated table must retain all existing features of the `LiveBetTable` component.
-   **FR-2 (Data Display):** The table must correctly render all data fields from the `BetRecord` type, including `Nonce`, `Date/Time`, `Amount`, `Multiplier`, `Distance`, `Payout`, `Difficulty`, and `Target/Result`.
-   **FR-3 (Sorting):** All columns that are currently sortable must remain sortable. The default sort order must be by `Nonce` in descending order (most recent first).
-   **FR-4 (Filtering):** All existing client-side filtering capabilities must be reimplemented using TanStack Table's filtering APIs. This includes:
    -   Minimum Multiplier (numeric input)
    -   Difficulty (select dropdown)
    -   Amount (min/max numeric inputs)
    -   Show Only Pinned (switch/toggle)
-   **FR-5 (UI/Styling):** The visual appearance of the table must be identical to the current implementation. It must continue to use `shadcn/ui` components (`<Table>`, `<TableRow>`, `<Badge>`, etc.) for rendering. TanStack Table will be used in a "headless" capacity.
-   **FR-6 (Real-time Updates):** The table must efficiently handle the ingestion of new bets in real-time, updating its state without causing full table re-renders or performance degradation. Highlighting of new rows must be preserved.
-   **FR-7 (Conditional Columns):** The "Distance" and "Bookmarks" columns must be conditionally rendered based on component props, just as they are now.
-   **FR-8 (Row Interactions):** The `onBetClick` and `onBookmark` props must function as they do currently, allowing users to click on a row or bookmark a bet.
-   **FR-9 (Loading/Error States):** The table must continue to display its current loading skeleton and error message states.

### Non-Functional Requirements

-   **NFR-1 (Performance):** The performance of the TanStack Table implementation must be equal to or better than the existing custom solution. Row virtualization should be implemented using `@tanstack/react-virtual` for seamless integration and optimal performance with large datasets.
-   **NFR-2 (Maintainability):** The refactored `LiveBetTable.tsx` component must have significantly less custom state management logic. The complex `useState`, `useMemo`, and `useEffect` hooks for sorting and filtering should be replaced by TanStack Table's core APIs.
-   **NFR-3 (No Breaking Changes):** The public props interface (`LiveBetTableProps`) should remain unchanged to ensure that the migration is a drop-in replacement for any parent component using it (e.g., `LiveStreamDetail.tsx`).
-   **NFR-4 (Dependencies):** The `@tanstack/react-table` and `@tanstack/react-virtual` libraries must be added as project dependencies.

### Out of Scope

-   **New Features:** This migration is a refactoring effort. No new user-facing features should be added to the table at this time.
-   **Backend Changes:** No changes to the API or data fetching logic are required for this task.
