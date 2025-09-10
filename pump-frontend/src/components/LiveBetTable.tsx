import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BetRecord } from '@/lib/api';

interface LiveBetTableProps {
  bets: BetRecord[];
  isLoading?: boolean;
  isError?: boolean;
  onSort?: (field: SortField, direction: SortDirection) => void;
  onFilter?: (filters: BetFilters) => void;
  sortField?: SortField;
  sortDirection?: SortDirection;
  filters?: BetFilters;
  showVirtualScrolling?: boolean;
  maxHeight?: string;
  onBetClick?: (bet: BetRecord) => void;
  highlightNewBets?: boolean;
  newBetIds?: Set<number>;
  className?: string;
}

export type SortField = 'nonce' | 'dateTime' | 'amount' | 'payoutMultiplier' | 'payout' | 'difficulty';
export type SortDirection = 'asc' | 'desc';

export interface BetFilters {
  minMultiplier?: number;
  difficulty?: string;
  minAmount?: number;
  maxAmount?: number;
}

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  hard: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  expert: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
} as const;

const MULTIPLIER_THRESHOLDS = {
  high: 1000,
  extreme: 10000,
  legendary: 100000,
} as const;

/**
 * Sortable, filterable table for bet records with real-time updates
 * Supports virtual scrolling for performance with large datasets
 * Includes multiplier highlighting and difficulty badges
 * Requirements: 4.2, 4.3, 5.1
 */
export function LiveBetTable({
  bets,
  isLoading = false,
  isError = false,
  onSort,
  onFilter,
  sortField = 'nonce',
  sortDirection = 'asc',
  filters = {},
  showVirtualScrolling = false,
  maxHeight = '600px',
  onBetClick,
  highlightNewBets = false,
  newBetIds = new Set(),
  className,
}: LiveBetTableProps) {
  const [localFilters, setLocalFilters] = useState<BetFilters>(filters);
  const [filterInputs, setFilterInputs] = useState({
    minMultiplier: filters.minMultiplier?.toString() || '',
    minAmount: filters.minAmount?.toString() || '',
    maxAmount: filters.maxAmount?.toString() || '',
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Apply filters locally if no external filter handler
  const filteredBets = useMemo(() => {
    if (!bets) return [];

    return bets.filter((bet) => {
      if (localFilters.minMultiplier && bet.payoutMultiplier < localFilters.minMultiplier) {
        return false;
      }
      if (localFilters.difficulty && bet.difficulty !== localFilters.difficulty) {
        return false;
      }
      if (localFilters.minAmount && bet.amount < localFilters.minAmount) {
        return false;
      }
      if (localFilters.maxAmount && bet.amount > localFilters.maxAmount) {
        return false;
      }
      return true;
    });
  }, [bets, localFilters]);

  // Sort bets locally if no external sort handler
  const sortedBets = useMemo(() => {
    if (!filteredBets) return [];

    const sorted = [...filteredBets].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date sorting
      if (sortField === 'dateTime') {
        aValue = new Date(a.dateTime || a.receivedAt).getTime();
        bValue = new Date(b.dateTime || b.receivedAt).getTime();
      }

      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string sorting
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });

    return sorted;
  }, [filteredBets, sortField, sortDirection]);

  // Virtual scrolling logic
  const visibleBets = useMemo(() => {
    if (!showVirtualScrolling) return sortedBets;
    return sortedBets.slice(visibleRange.start, visibleRange.end);
  }, [sortedBets, showVirtualScrolling, visibleRange]);

  // Handle scroll for virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!showVirtualScrolling) return;

    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const itemHeight = 48; // Approximate row height
    const containerHeight = target.clientHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(start + visibleCount + 10, sortedBets.length); // Buffer

    setVisibleRange({ start, end });
  }, [showVirtualScrolling, sortedBets.length]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    
    if (onSort) {
      onSort(field, newDirection);
    }
  };

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<BetFilters>) => {
    const updatedFilters = { ...localFilters, ...newFilters };
    setLocalFilters(updatedFilters);
    
    if (onFilter) {
      onFilter(updatedFilters);
    }
  }, [localFilters, onFilter]);

  // Apply filter inputs with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      const newFilters: Partial<BetFilters> = {};
      
      if (filterInputs.minMultiplier) {
        const value = parseFloat(filterInputs.minMultiplier);
        if (!isNaN(value)) newFilters.minMultiplier = value;
      }
      
      if (filterInputs.minAmount) {
        const value = parseFloat(filterInputs.minAmount);
        if (!isNaN(value)) newFilters.minAmount = value;
      }
      
      if (filterInputs.maxAmount) {
        const value = parseFloat(filterInputs.maxAmount);
        if (!isNaN(value)) newFilters.maxAmount = value;
      }

      handleFilterChange(newFilters);
    }, 500);

    return () => clearTimeout(timer);
  }, [filterInputs, handleFilterChange]);

  // Format functions
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
    const date = new Date(dateTime || receivedAt || '');
    return date.toLocaleString();
  };

  const getMultiplierBadgeVariant = (multiplier: number) => {
    if (multiplier >= MULTIPLIER_THRESHOLDS.legendary) return 'destructive';
    if (multiplier >= MULTIPLIER_THRESHOLDS.extreme) return 'default';
    if (multiplier >= MULTIPLIER_THRESHOLDS.high) return 'secondary';
    return 'outline';
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </Button>
  );

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
          <label className="text-sm text-muted-foreground">Min Multiplier:</label>
          <Input
            type="number"
            placeholder="1.0"
            value={filterInputs.minMultiplier}
            onChange={(e) => setFilterInputs(prev => ({ ...prev, minMultiplier: e.target.value }))}
            className="w-24 h-8"
            step="0.01"
            min="0"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Difficulty:</label>
          <Select
            value={localFilters.difficulty || 'all'}
            onValueChange={(value) => handleFilterChange({ 
              difficulty: value === 'all' ? undefined : value 
            })}
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

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Amount:</label>
          <Input
            type="number"
            placeholder="Min"
            value={filterInputs.minAmount}
            onChange={(e) => setFilterInputs(prev => ({ ...prev, minAmount: e.target.value }))}
            className="w-20 h-8"
            step="0.00000001"
            min="0"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={filterInputs.maxAmount}
            onChange={(e) => setFilterInputs(prev => ({ ...prev, maxAmount: e.target.value }))}
            className="w-20 h-8"
            step="0.00000001"
            min="0"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          {filteredBets.length} of {bets.length} bets
        </div>
      </div>

      {/* Table */}
      <div 
        ref={tableRef}
        className={cn(
          "border rounded-lg overflow-auto",
          showVirtualScrolling && "max-h-[600px]"
        )}
        style={showVirtualScrolling ? { maxHeight } : undefined}
        onScroll={handleScroll}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead>
                <SortButton field="nonce">Nonce</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="dateTime">Date/Time</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="amount">Amount</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="payoutMultiplier">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Multiplier
                </SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="payout">Payout</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="difficulty">Difficulty</SortButton>
              </TableHead>
              <TableHead>Target/Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleBets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {filteredBets.length === 0 && bets.length > 0 
                    ? "No bets match the current filters"
                    : "No bets available"
                  }
                </TableCell>
              </TableRow>
            ) : (
              visibleBets.map((bet) => (
                <TableRow
                  key={bet.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200",
                    highlightNewBets && newBetIds.has(bet.id) && "bg-green-50 dark:bg-green-900/10 animate-pulse",
                    onBetClick && "hover:bg-accent/50"
                  )}
                  onClick={() => onBetClick?.(bet)}
                >
                  <TableCell className="font-mono text-sm">
                    {bet.nonce.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(bet.dateTime, bet.receivedAt)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatAmount(bet.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getMultiplierBadgeVariant(bet.payoutMultiplier)}
                      className="font-mono text-xs"
                    >
                      {formatMultiplier(bet.payoutMultiplier)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatAmount(bet.payout)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-xs capitalize", DIFFICULTY_COLORS[bet.difficulty])}
                    >
                      {bet.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {bet.roundTarget && bet.roundResult ? (
                      <div className="space-y-1">
                        <div>T: {bet.roundTarget.toFixed(2)}</div>
                        <div>R: {bet.roundResult.toFixed(2)}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Virtual scrolling spacer */}
      {showVirtualScrolling && sortedBets.length > visibleBets.length && (
        <div 
          style={{ 
            height: `${(sortedBets.length - visibleBets.length) * 48}px` 
          }} 
        />
      )}
    </div>
  );
}