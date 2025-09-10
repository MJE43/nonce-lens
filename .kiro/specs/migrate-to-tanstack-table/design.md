## Overview
**Purpose**: This feature refactors the `LiveBetTable` component, migrating it from a custom implementation to the TanStack Table library. The goal is to improve maintainability, reduce complexity, and eliminate state management bugs by leveraging a robust, headless table utility.
**Users**: This is a technical refactoring and will have no direct impact on end-users. Developers working on the frontend will benefit from a simpler, more powerful component.
**Impact**: This change will significantly refactor the internal logic of `LiveBetTable.tsx`, replacing custom sorting, filtering, and virtual scrolling hooks with TanStack Table's battle-tested APIs. The component's external props and visual appearance will remain unchanged.

### Goals
-   Replace all custom sorting logic with TanStack Table's sorting state management.
-   Replace all custom filtering logic with TanStack Table's filtering state management.
-   Replace the manual virtual scrolling implementation with the `@tanstack/react-virtual` library.
-   Reduce the complexity of `LiveBetTable.tsx`, making it easier to maintain and extend.
-   Preserve 100% of the existing functionality and visual appearance.

### Non-Goals
-   Introduce any new user-facing features to the table.
-   Change the visual design or styling of the table and its cells.
-   Alter the existing API for fetching bet data.

## Architecture

### Existing Architecture Analysis
The current `LiveBetTable` is a "smart" component that manages all of its state internally. It relies on a combination of `useState`, `useMemo`, and `useEffect` hooks to handle:
-   **Filtering**: State is held for each filter input, with a debounced `useEffect` to apply them.
-   **Sorting**: State tracks the current sort column and direction.
-   **Data Processing**: `useMemo` is used extensively to apply filters and sorting to the raw `bets` prop.
-   **Virtual Scrolling**: A manual implementation calculates visible rows based on scroll position.

This custom approach has proven to be brittle, leading to bugs like "maximum update depth exceeded" errors when dependency arrays for hooks are not perfectly managed. It concentrates too much complex logic in a single component, making it difficult to debug and extend.

### High-Level Architecture
The new architecture will adopt a "headless" component model. The `LiveBetTable` component will be responsible for rendering, while the `useReactTable` hook from TanStack Table will manage all the complex state and logic.

```mermaid
graph TD
    A[LiveStreamDetail Page] -- bets prop --> B(LiveBetTable Component);
    B -- data, columns, state --> C{useReactTable Hook};
    C -- table instance --> B;
    B -- renders headers --> D[shadcn/ui TableHeader];
    B -- renders rows --> E[shadcn/ui TableRow];
    E -- virtualized by --> F[@tanstack/react-virtual];

    subgraph "State Management (TanStack Table)"
        C
    end

    subgraph "Rendering (React)"
        B
        D
        E
        F
    end
```

**Architecture Integration**:
-   **Existing patterns preserved**: The component will continue to use `shadcn/ui` for all rendering, maintaining the established design system. The component's props interface will not change.
-   **New components rationale**: No new components are created, but the logic is centralized into the `useReactTable` hook.
-   **Technology alignment**: TanStack Table is a modern, hook-based library that aligns perfectly with our existing React and TypeScript stack. Its headless nature is ideal for our design system.

### Technology Stack and Design Decisions

**Technology Alignment**:
-   **@tanstack/react-table (v8)**: This library will be added to manage table state, including sorting, filtering, and data processing.
-   **@tanstack/react-virtual (v3)**: This library will be added to handle high-performance virtual scrolling, replacing the custom implementation.

**Key Design Decisions**:

-   **Decision**: Fully embrace client-side state management provided by TanStack Table.
-   **Context**: The `bets` prop can contain up to 10,000 records. All sorting and filtering operations are currently performed on the client. TanStack Table is highly optimized for this use case.
-   **Alternatives**:
    1.  **Server-side processing**: We could send filter/sort state to the API. This would add significant backend complexity and latency, which is undesirable for a real-time view.
    2.  **Hybrid model**: Keep some logic on the client. This defeats the purpose of simplifying the component and would re-introduce complexity.
-   **Selected Approach**: The `bets` array will be passed directly to `useReactTable`. All sorting and filtering state will be managed by the hook. The component will then re-render based on the memoized results from the table instance.
-   **Rationale**: This approach provides the best user experience (instant feedback on sort/filter changes) and dramatically simplifies the component's code.
-   **Trade-offs**: This places the processing burden on the client's browser. Given the data size (10,000 rows) and the nature of the data, this is an acceptable trade-off.

## Components and Interfaces

### `pump-frontend/src/components/LiveBetTable.tsx`

**Responsibility & Boundaries**
-   **Primary Responsibility**: To render a sortable, filterable, and virtualized table of `BetRecord` data.
-   **Domain Boundary**: Belongs to the `live-streams` feature domain.
-   **Data Ownership**: Does not own data. It receives the complete list of bets via props and displays it.

**Dependencies**
-   **Inbound**: `LiveStreamDetail.tsx`
-   **Outbound**: `@tanstack/react-table`, `@tanstack/react-virtual`, `shadcn/ui` components.

**Contract Definition**

The external `LiveBetTableProps` interface will remain **unchanged**.

```typescript
// No changes to the external props
interface LiveBetTableProps {
  bets: BetRecord[];
  isLoading?: boolean;
  // ... all other existing props
}
```

**Internal Implementation Plan**:

1.  **Column Definitions (`ColumnDef<BetRecord>`)**: A `columns.ts` file will be created to define the table columns. This decouples the column structure from the component logic.
    -   Each column will have a `header` (for rendering the title and sort button) and a `cell` function (for rendering the data).
    -   Custom rendering logic (e.g., `formatMultiplier`, `DifficultyBadge`) will be encapsulated within these cell functions.
    -   Accessor functions will be defined to retrieve the correct data for each column.

2.  **`useReactTable` Hook Setup**:
    -   The hook will be initialized with `data`, `columns`, and state management configuration.
    -   `getCoreRowModel()`, `getSortedRowModel()`, `getFilteredRowModel()` will be used.
    -   State for `sorting` and `columnFilters` will be managed using `useState` and passed to the hook.

3.  **Component Rendering**:
    -   The main component will no longer contain `useMemo` hooks for filtering and sorting.
    -   It will get the headers and rows directly from the `table.getHeaderGroups()` and `table.getRowModel().rows` methods provided by the hook.
    -   The filter inputs (`Input`, `Select`) will now update the `columnFilters` state, which is passed to `useReactTable`.

4.  **Virtualization**:
    -   The `useVirtualizer` hook from `@tanstack/react-virtual` will be used.
    -   It will be configured with the row count from the `table.getRowModel().rows.length` and an estimated row size.
    -   The rendering loop will iterate over `virtualizer.getVirtualItems()` instead of the full row set.

## Testing Strategy

-   **Unit Tests**:
    -   Test individual column definitions to ensure correct data access and cell rendering.
    -   Test the filter components to verify that they correctly update the `columnFilters` state on user interaction.
    -   Test that the `Reset Filters` button clears the `columnFilters` state.
-   **Integration Tests**:
    -   Render the `LiveBetTable` within its parent (`LiveStreamDetail`) and verify that the initial data is displayed correctly.
    -   Simulate real-time updates by changing the `bets` prop and ensure the table updates efficiently.
-   **E2E/UI Tests**:
    -   An existing Playwright or Cypress test that interacts with the filter inputs should be updated if necessary.
    -   The test should confirm that filtering the table correctly reduces the number of visible rows.
    -   The test should confirm that clicking a column header sorts the data.

## Migration Strategy

The migration will be performed in-place on the `LiveBetTable.tsx` file, following these steps to minimize disruption.

1.  **Install Dependencies**: Add `@tanstack/react-table` and `@tanstack/react-virtual` to `package.json`.
2.  **Define Columns**: Create a `columns.ts` file and define all table columns using `createColumnHelper`.
3.  **Integrate `useReactTable`**: Introduce the `useReactTable` hook into `LiveBetTable.tsx`. Initially, connect only the `data` and `columns`.
4.  **Refactor Rendering**: Update the JSX to render headers and rows from the `useReactTable` instance. At this point, the old sorting/filtering logic will be temporarily disabled but not yet removed.
5.  **Implement State Management**: Wire up the `sorting` and `columnFilters` state to the hook and connect them to the filter UI components.
6.  **Remove Old Logic**: Once TanStack state management is confirmed to be working, delete all the now-redundant `useMemo` and `useEffect` hooks related to custom sorting and filtering.
7.  **Implement Virtualization**: Replace the custom virtual scrolling logic with the `useVirtualizer` hook.
8.  **Final Cleanup**: Remove any remaining unused code and ensure the component props are still fully supported.
