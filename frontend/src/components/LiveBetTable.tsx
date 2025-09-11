import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils"; // if not already present
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import {
  ColumnFiltersState,
  SortingState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { createColumns } from "./live-streams/columns";
import type { BetRecord } from "@/lib/api";

interface LiveBetTableProps {
  bets: BetRecord[];
  isLoading?: boolean;
  isError?: boolean;
  showVirtualScrolling?: boolean;
  maxHeight?: string;
  onBetClick?: (bet: BetRecord) => void;
  highlightNewBets?: boolean;
  newBetIds?: Set<number>;
  className?: string;

  // Enhanced features
  showDistanceColumn?: boolean;
  distanceColumn?: boolean; // Alternative prop name for compatibility
  pinnedMultipliers?: number[];
  highlightMultiplier?: number;
  showBookmarks?: boolean;
  onBookmark?: (bet: BetRecord, note?: string) => void;

  // Infinite scrolling support
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
  totalCount?: number;

  // Analysis mode features
  focusedMultiplier?: number | null;
  onMultiplierFocus?: (multiplier: number) => void;
  isAnalysisMode?: boolean;
}

/**
 * UI-only table for displaying live bet records with proper virtualization.
 * - No server data fetching; expects fully prepared `bets` from caller (react-query cache).
 * - Uses TanStack Table for sorting/filtering UI state and TanStack Virtual for performance.
 * - Implements container-based virtualization following tutorial patterns.
 * - Optional client-side distance calculation (when showDistanceColumn is true).
 * - Automatically updates when new bets arrive via React Query cache invalidation.
 */
function LiveBetTable({
  bets,
  isLoading = false,
  isError = false,
  showVirtualScrolling = false,
  maxHeight = "600px",
  onBetClick,
  className,

  // Enhanced features
  showDistanceColumn = false,
  distanceColumn = false,
  pinnedMultipliers = [],
  showBookmarks = false,
  onBookmark,

  // Infinite scrolling
  hasNextPage = false,
  fetchNextPage,
  isFetchingNextPage = false,
  totalCount,

  // Analysis mode features
  focusedMultiplier = null,
  onMultiplierFocus,
  isAnalysisMode = false,
}: LiveBetTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "nonce", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Calculate if distance column should be shown
  const shouldShowDistance = showDistanceColumn || distanceColumn;

  // Calculate if pinned multipliers filter should be shown
  const shouldShowPinnedFilter = pinnedMultipliers.length > 0;

  // Snap floats to 2dp so 400.02 and 400.020000... land in the same bucket
  const normalizeMultiplier = (m: number | null | undefined) =>
    m == null || Number.isNaN(m) ? null : Math.round(m * 100) / 100;

  // Calculate distances using "previous >= this row's multiplier" logic
  const useDistancesAtLeastMultiplier = useMemo(() => {
    if (!bets || !shouldShowDistance) return new Map<number, number | null>();

    // Sort a copy by nonce ASC (chronological)
    const asc = [...bets].sort((a, b) => a.nonce - b.nonce);

    // Keep track of all hits in chronological order
    const allHits: Array<{ m: number; nonce: number }> = [];
    const distanceById = new Map<number, number | null>();

    for (const b of asc) {
      const m =
        normalizeMultiplier(b.round_result ?? b.payout_multiplier) ?? null;
      if (m == null) {
        distanceById.set(b.id, null);
        continue;
      }

      // Find the most recent hit with multiplier >= m
      let prevNonce: number | null = null;
      for (let i = allHits.length - 1; i >= 0; i--) {
        const hit = allHits[i];
        if (hit && hit.m >= m) {
          prevNonce = hit.nonce;
          break;
        }
      }

      const distance = prevNonce == null ? null : b.nonce - prevNonce;
      distanceById.set(b.id, distance);

      // Add this hit to the list
      allHits.push({ m, nonce: b.nonce });
    }

    return distanceById;
  }, [bets, shouldShowDistance]);

  // Apply computed distances to bets
  const betsWithDistance = useMemo(() => {
    if (!bets || !shouldShowDistance) return bets;

    return bets.map((bet) => ({
      ...bet,
      distance_prev_opt: useDistancesAtLeastMultiplier.get(bet.id) ?? null,
    }));
  }, [bets, shouldShowDistance, useDistancesAtLeastMultiplier]);

  // Handle bookmark functionality
  const handleBookmark = useCallback(
    (bet: BetRecord, note?: string) => {
      if (onBookmark) {
        if (note !== undefined) {
          onBookmark(bet, note);
        } else {
          onBookmark(bet);
        }
      }
    },
    [onBookmark]
  );

  const columns = useMemo(
    () =>
      createColumns({
        showBookmarks,
        showDistanceColumn: shouldShowDistance,
        onBookmark: handleBookmark,
        pinnedMultipliers,
        focusedMultiplier,
        onMultiplierFocus: onMultiplierFocus,
        isAnalysisMode,
      }),
    [
      showBookmarks,
      shouldShowDistance,
      handleBookmark,
      pinnedMultipliers,
      focusedMultiplier,
      onMultiplierFocus,
      isAnalysisMode,
    ]
  );

  const table = useReactTable({
    data: betsWithDistance,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Enable column filters to work with real-time data
    enableFilters: true,
    enableColumnFilters: true,
    // Ensure filters are recomputed when data changes
    autoResetPageIndex: false,
    // Disable global filtering to focus on column-specific filters
    enableGlobalFilter: false,
  });

  const prevCountRef = useRef<number>(bets.length);
  useEffect(() => {
    if (bets.length > prevCountRef.current) {
      table.resetColumnFilters();
    }
    prevCountRef.current = bets.length;
  }, [bets.length]);

  const prevMode = useRef<boolean>(isAnalysisMode);
  useEffect(() => {
    if (prevMode.current !== isAnalysisMode) {
      setSorting([{ id: "nonce", desc: !isAnalysisMode }]);
      prevMode.current = isAnalysisMode;
    }
  }, [isAnalysisMode]);

  const tableRef = useRef<HTMLDivElement>(null);

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 48, // Estimate row height
    overscan: 10, // Render extra items outside viewport for smoother scrolling
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const visibleRows = virtualRows
    .map((virtualRow) => rows[virtualRow.index])
    .filter(Boolean);

  // Infinite scrolling: fetch more when near bottom
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement && fetchNextPage && hasNextPage) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // Fetch more when within 400px of bottom
        if (
          scrollHeight - scrollTop - clientHeight < 400 &&
          !isFetchingNextPage &&
          hasNextPage
        ) {
          fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetchingNextPage, hasNextPage]
  );

  // Check on mount if already at bottom
  useEffect(() => {
    if (showVirtualScrolling) {
      fetchMoreOnBottomReached(tableRef.current);
    }
  }, [fetchMoreOnBottomReached, showVirtualScrolling]);

  // Handle filter reset
  const handleResetFilters = useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  // Loading state
  if (isLoading && bets.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading bets...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="text-destructive text-sm">
          Failed to load bet data. Please try again.
        </div>
      </div>
    );
  }

  if (!bets || bets.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="text-muted-foreground text-sm">No bets available</div>
      </div>
    );
  }

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
        {/* Filter Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Min Multiplier:
            </label>
            <Input
              type="number"
              placeholder="1000"
              value={
                (
                  table.getColumn("multiplier")?.getFilterValue() as [
                    number | undefined,
                    boolean | undefined
                  ]
                )?.[0] ?? ""
              }
              onChange={(e) => {
                const value = e.target.value;
                const currentFilter = table
                  .getColumn("multiplier")
                  ?.getFilterValue() as
                  | [number | undefined, boolean | undefined]
                  | undefined;

                const newFilter: [number | undefined, boolean | undefined] = [
                  value ? Number(value) : undefined,
                  currentFilter?.[1] ?? false,
                ];

                table.getColumn("multiplier")?.setFilterValue(newFilter);
              }}
              className="w-24 h-8"
              step="0.01"
              min="0"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Difficulty:
            </label>
            <Select
              value={
                (table.getColumn("difficulty")?.getFilterValue() as string) ??
                "all"
              }
              onValueChange={(value) =>
                table
                  .getColumn("difficulty")
                  ?.setFilterValue(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-32 h-8">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pinned Multipliers Filter */}
          {shouldShowPinnedFilter && (
            <div className="flex items-center gap-2">
              <Switch
                checked={
                  (
                    table.getColumn("multiplier")?.getFilterValue() as [
                      number | undefined,
                      boolean | undefined
                    ]
                  )?.[1] ?? false
                }
                onCheckedChange={(checked) => {
                  const currentFilter = table
                    .getColumn("multiplier")
                    ?.getFilterValue() as
                    | [number | undefined, boolean | undefined]
                    | undefined;

                  const newFilter: [number | undefined, boolean | undefined] = [
                    currentFilter?.[0] ?? undefined,
                    checked,
                  ];

                  table.getColumn("multiplier")?.setFilterValue(newFilter);
                }}
              />
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Show Only Pinned
              </label>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="h-8 flex items-center gap-2"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Filters
          </Button>
        </div>

        {/* Results Info */}
        <div className="text-sm text-muted-foreground">
          {table.getRowModel().rows.length} of {bets.length} bets
          {totalCount &&
            totalCount > bets.length &&
            ` (${totalCount.toLocaleString()} total)`}
        </div>
      </div>

      {/* Table with conditional virtualization */}
      <div className="overflow-x-auto shadow-md rounded-lg">
        {showVirtualScrolling ? (
          <div
            ref={tableRef}
            className="overflow-auto relative"
            style={{ height: maxHeight }}
            onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRows[0]?.start ?? 0}px)`,
                }}
              >
                <Table className="min-w-full divide-y">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                          >
                            {header.column.getCanSort() ? (
                              <div
                                className="cursor-pointer select-none flex items-center"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                <span className="ml-2">
                                  {header.column.getIsSorted() ? (
                                    header.column.getIsSorted() === "asc" ? (
                                      <ArrowUp size={14} />
                                    ) : (
                                      <ArrowDown size={14} />
                                    )
                                  ) : (
                                    <div className="w-4" />
                                  )}
                                </span>
                              </div>
                            ) : (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody className="divide-y">
                    {visibleRows.map((row) => {
                      if (!row) return null;
                      const virtualItem = virtualRows.find(
                        (vRow) => rows[vRow.index]?.id === row.id
                      );
                      if (!virtualItem) return null;

                      return (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                          className={cn(
                            "hover:bg-muted/50 transition-colors",
                            onBetClick && "cursor-pointer"
                          )}
                          onClick={() => onBetClick?.(row.original)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className="px-6 py-2 whitespace-nowrap text-sm"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <Table className="min-w-full divide-y">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {header.column.getCanSort() ? (
                        <div
                          className="cursor-pointer select-none flex items-center"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          <span className="ml-2">
                            {header.column.getIsSorted() ? (
                              header.column.getIsSorted() === "asc" ? (
                                <ArrowUp size={14} />
                              ) : (
                                <ArrowDown size={14} />
                              )
                            ) : (
                              <div className="w-4" />
                            )}
                          </span>
                        </div>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="divide-y">
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "hover:bg-muted/50 transition-colors",
                    onBetClick && "cursor-pointer"
                  )}
                  onClick={() => onBetClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-6 py-2 whitespace-nowrap text-sm"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Infinite scroll indicators */}
        {showVirtualScrolling && isFetchingNextPage && (
          <div className="flex items-center justify-center py-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Loading more...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { LiveBetTable };
export default LiveBetTable;
