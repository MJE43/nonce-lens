import React from "react";
import { createColumnHelper, Column } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  StarOff,
  TrendingUp,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BetRecord } from "@/lib/api";

// Types for the table
export type SortField =
  | "nonce"
  | "id"
  | "date_time"
  | "amount"
  | "round_result"
  | "payout"
  | "difficulty";

export type SortDirection = "asc" | "desc";

// Constants
const DIFFICULTY_COLORS = {
  easy: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  hard: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  expert: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
} as const;

const MULTIPLIER_THRESHOLDS = {
  high: 1000,
  extreme: 10000,
  legendary: 100000,
} as const;

// Helper functions
const formatMultiplier = (multiplier: number) => {
  if (multiplier >= 1000) {
    return `${(multiplier / 1000).toFixed(1)}k×`;
  }
  return `${multiplier.toFixed(2)}×`;
};

const formatAmount = (amount: number) => {
  return amount.toFixed(8);
};

const formatDateTime = (dateTime?: string, receivedAt?: string) => {
  const date = new Date(dateTime || receivedAt || "");
  return date.toLocaleString();
};

const getMultiplierBadgeVariant = (multiplier: number) => {
  if (multiplier >= MULTIPLIER_THRESHOLDS.legendary) return "destructive";
  if (multiplier >= MULTIPLIER_THRESHOLDS.extreme) return "default";
  if (multiplier >= MULTIPLIER_THRESHOLDS.high) return "secondary";
  return "outline";
};

const SortableHeader = ({
  column,
  children,
}: {
  column: Column<BetRecord, unknown>;
  children: React.ReactNode;
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <div className="flex items-center gap-1">
        {children}
        {{
          asc: <ArrowUp className="h-3 w-3" />,
          desc: <ArrowDown className="h-3 w-3" />,
        }[column.getIsSorted() as string] ?? (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </Button>
  );
};

// Column helper
const columnHelper = createColumnHelper<BetRecord>();

// Column definitions
export const createColumns = (options: {
  showBookmarks?: boolean;
  showDistanceColumn?: boolean;
  onBookmark?: (bet: BetRecord, note?: string) => void;
  onBetClick?: (bet: BetRecord) => void;
  highlightMultiplier?: number;
  highlightNewBets?: boolean;
  newBetIds?: Set<number>;
  pinnedMultipliers?: number[];
}) => {
  const {
    showBookmarks = false,
    showDistanceColumn = false,
    onBookmark,
    pinnedMultipliers = [],
  } = options;

  const columns = [
    // Bookmarks column (conditional)
    ...(showBookmarks
      ? [
          columnHelper.accessor("id", {
            id: "bookmark",
            header: () => <Star className="h-3 w-3" />,
            cell: ({ row }) => {
              const bet = row.original;
              const isBookmarked =
                (bet as { isBookmarked?: boolean }).isBookmarked || false;

              return (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6",
                    isBookmarked && "bookmarked text-yellow-500"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookmark?.(bet);
                  }}
                  aria-label="Bookmark this bet"
                >
                  {isBookmarked ? (
                    <Star className="h-3 w-3 fill-current" />
                  ) : (
                    <StarOff className="h-3 w-3" />
                  )}
                </Button>
              );
            },
            enableSorting: false,
            size: 48,
          }),
        ]
      : []),

    // Nonce column
    columnHelper.accessor("nonce", {
      header: ({ column }) => (
        <SortableHeader column={column}>Nonce</SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue().toLocaleString()}</span>
      ),
      enableSorting: true,
    }),

    // Date/Time column
    columnHelper.accessor("date_time", {
      header: ({ column }) => (
        <SortableHeader column={column}>Date/Time</SortableHeader>
      ),
      cell: ({ row }) => {
        const bet = row.original;
        return (
          <span className="text-sm">
            {formatDateTime(bet.date_time, bet.received_at)}
          </span>
        );
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const aDate = new Date(
          rowA.original.date_time || rowA.original.received_at || ""
        ).getTime();
        const bDate = new Date(
          rowB.original.date_time || rowB.original.received_at || ""
        ).getTime();
        return aDate - bDate;
      },
    }),

    // Amount column
    columnHelper.accessor("amount", {
      header: ({ column }) => (
        <SortableHeader column={column}>Amount</SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{formatAmount(getValue())}</span>
      ),
      enableSorting: true,
    }),

    // Multiplier column
    columnHelper.accessor("round_result", {
      id: "multiplier",
      header: ({ column }) => (
        <SortableHeader column={column}>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Multiplier
          </div>
        </SortableHeader>
      ),
      cell: ({ row }) => {
        const bet = row.original;
        const multiplier = bet.round_result ?? bet.payout_multiplier ?? 0;

        return (
          <Badge
            variant={getMultiplierBadgeVariant(multiplier)}
            className="font-mono text-xs"
          >
            {formatMultiplier(multiplier)}
          </Badge>
        );
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const aMultiplier =
          rowA.original.round_result ?? rowA.original.payout_multiplier ?? 0;
        const bMultiplier =
          rowB.original.round_result ?? rowB.original.payout_multiplier ?? 0;
        return aMultiplier - bMultiplier;
      },
      filterFn: (row, _columnId, filterValue: [number, boolean]) => {
        const multiplier =
          row.original.round_result ?? row.original.payout_multiplier ?? 0;
        const [min, showPinned] = filterValue;

        if (showPinned && pinnedMultipliers.length > 0) {
          const tolerance = 1e-9;
          const isMatched = pinnedMultipliers.some(
            (target) => Math.abs(multiplier - target) < tolerance
          );
          if (!isMatched) return false;
        }

        if (min !== undefined && min !== null && multiplier < min) {
          return false;
        }

        return true;
      },
    }),

    // Distance column (conditional)
    ...(showDistanceColumn
      ? [
          columnHelper.accessor("distance_prev_opt", {
            id: "distance",
            header: ({ column }) => (
              <SortableHeader column={column}>
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  Distance
                </div>
              </SortableHeader>
            ),
            cell: ({ getValue }) => {
              const distance = getValue();
              return (
                <span className="font-mono text-sm">
                  {distance !== null && distance !== undefined
                    ? distance.toLocaleString()
                    : "—"}
                </span>
              );
            },
            enableSorting: true,
          }),
        ]
      : []),

    // Payout column
    columnHelper.accessor("payout", {
      header: ({ column }) => (
        <SortableHeader column={column}>Payout</SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{formatAmount(getValue())}</span>
      ),
      enableSorting: true,
    }),

    // Difficulty column
    columnHelper.accessor("difficulty", {
      header: ({ column }) => (
        <SortableHeader column={column}>Difficulty</SortableHeader>
      ),
      cell: ({ getValue }) => (
        <Badge
          variant="outline"
          className={cn(
            "text-xs capitalize",
            DIFFICULTY_COLORS[getValue() as keyof typeof DIFFICULTY_COLORS]
          )}
        >
          {getValue()}
        </Badge>
      ),
      enableSorting: true,
    }),

    // Target/Result column
    columnHelper.accessor("round_target", {
      id: "target_result",
      header: "Target/Result",
      cell: ({ row }) => {
        const bet = row.original;
        return (
          <div className="font-mono text-xs text-muted-foreground">
            {bet.round_target && bet.round_result ? (
              <div className="space-y-1">
                <div>T: {bet.round_target.toFixed(2)}</div>
                <div>R: {bet.round_result.toFixed(2)}</div>
              </div>
            ) : (
              "—"
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
  ];

  return columns;
};
