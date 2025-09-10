import { useState, useMemo, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Filter, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BetRecord } from "@/lib/api";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { createColumns } from "./live-streams/columns";
import { useVirtualizer } from "@tanstack/react-virtual";

// Helper: shallow compare BetFilters to avoid unnecessary state updates
// function arraysEqual(a?: number[], b?: number[]) {
//   if (a === b) return true;
//   if (!a && !b) return true;
//   if (!a || !b) return false;
//   if (a.length !== b.length) return false;
//   for (let i = 0; i < a.length; i += 1) {
//     if (a[i] !== b[i]) return false;
//   }
//   return true;
// }
//
// function filtersShallowEqual(a: BetFilters, b: BetFilters) {
//   return (
//     a.minMultiplier === b.minMultiplier &&
//     a.difficulty === b.difficulty &&
//     a.minAmount === b.minAmount &&
//     a.maxAmount === b.maxAmount &&
//     a.showOnlyPinned === b.showOnlyPinned &&
//     arraysEqual(a.pinnedMultipliers, b.pinnedMultipliers)
//   );
// }

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
}

export type SortField =
  | "nonce"
  | "id"
  | "date_time"
  | "amount"
  | "round_result"
  | "payout"
  | "difficulty";
export type SortDirection = "asc" | "desc";

export interface BetFilters {
  minMultiplier?: number;
  difficulty?: string;
  minAmount?: number;
  maxAmount?: number;
  showOnlyPinned?: boolean;
  pinnedMultipliers?: number[];
}

/**
 * Sortable, filterable table for bet records with real-time updates
 * Supports virtual scrolling for performance with large datasets
 * Includes multiplier highlighting and difficulty badges
 * Requirements: 4.2, 4.3, 5.1
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
}: LiveBetTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "nonce", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Calculate if distance column should be shown
  const shouldShowDistance = showDistanceColumn || distanceColumn;

  // Calculate if pinned multipliers filter should be shown
  const shouldShowPinnedFilter = pinnedMultipliers.length > 0;

  // Client-side distance calculation
  const betsWithDistance = useMemo(() => {
    if (!bets || !shouldShowDistance) return bets;

    const lastNonceByMultiplier = new Map<number, number>();

    return bets.map((bet) => {
      const multiplier = bet.round_result ?? bet.payout_multiplier;

      // Use server-provided distance if available
      if (
        bet.distance_prev_opt !== undefined &&
        bet.distance_prev_opt !== null
      ) {
        return bet;
      }

      // Calculate client-side distance
      const lastNonce = lastNonceByMultiplier.get(multiplier);
      const distance = lastNonce ? bet.nonce - lastNonce : null;

      lastNonceByMultiplier.set(multiplier, bet.nonce);

      return {
        ...bet,
        distance_prev_opt: distance,
      };
    });
  }, [bets, shouldShowDistance]);

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
      }),
    [showBookmarks, shouldShowDistance, handleBookmark, pinnedMultipliers]
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
  });

  const tableRef = useRef<HTMLDivElement>(null);

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 48, // Estimate row height
  });

  // Handle filter reset
  const handleResetFilters = useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex gap-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="border rounded-lg">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
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

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted_foreground">
            Min Multiplier:
          </label>
          <Input
            type="number"
            placeholder="1.0"
            value={
              (
                table.getColumn("multiplier")?.getFilterValue() as [
                  number,
                  boolean
                ]
              )?.[0] ?? ""
            }
            onChange={(e) => {
              const value = e.target.value;
              const currentFilter = table
                .getColumn("multiplier")
                ?.getFilterValue() as [number, boolean] | undefined;
              table
                .getColumn("multiplier")
                ?.setFilterValue([
                  value ? Number(value) : undefined,
                  currentFilter?.[1],
                ]);
            }}
            className="w-24 h-8"
            step="0.01"
            min="0"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Difficulty:</label>
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
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
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
                    number,
                    boolean
                  ]
                )?.[1] ?? false
              }
              onCheckedChange={(checked) => {
                const currentFilter = table
                  .getColumn("multiplier")
                  ?.getFilterValue() as [number, boolean] | undefined;
                table
                  .getColumn("multiplier")
                  ?.setFilterValue([currentFilter?.[0], checked]);
              }}
            />
            <label className="text-sm text-muted-foreground">
              Show Only Pinned
            </label>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Amount:</label>
          <Input
            type="number"
            placeholder="Min"
            value={
              (
                table.getColumn("amount")?.getFilterValue() as
                  | [number, number]
                  | undefined
              )?.[0] ?? ""
            }
            onChange={(e) => {
              const value = e.target.value;
              const currentFilter = table
                .getColumn("amount")
                ?.getFilterValue() as [number, number] | undefined;
              table
                .getColumn("amount")
                ?.setFilterValue([
                  value ? Number(value) : undefined,
                  currentFilter?.[1],
                ]);
            }}
            className="w-20 h-8"
            step="0.00000001"
            min="0"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={
              (
                table.getColumn("amount")?.getFilterValue() as
                  | [number, number]
                  | undefined
              )?.[1] ?? ""
            }
            onChange={(e) => {
              const value = e.target.value;
              const currentFilter = table
                .getColumn("amount")
                ?.getFilterValue() as [number, number] | undefined;
              table
                .getColumn("amount")
                ?.setFilterValue([
                  currentFilter?.[0],
                  value ? Number(value) : undefined,
                ]);
            }}
            className="w-20 h-8"
            step="0.00000001"
            min="0"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          {table.getRowModel().rows.length} of {bets.length} bets
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleResetFilters}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Filters
        </Button>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className={cn(
          "border rounded-lg overflow-auto",
          showVirtualScrolling && "max-h-[600px]"
        )}
        style={showVirtualScrolling ? { maxHeight } : undefined}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "cursor-pointer transition-all duration-200",
                    onBetClick && "hover:bg-accent/50"
                  )}
                  onClick={() => onBetClick?.(row.original)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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

      {/* Virtual scrolling spacer */}
      {/* {showVirtualScrolling && bets.length > visibleBets.length && (
        <div
          style={{
            height: `${(bets.length - visibleBets.length) * 48}px`,
          }}
        />
      )} */}
    </div>
  );
}

export { LiveBetTable };
export default LiveBetTable;
