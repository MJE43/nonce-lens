import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { liveStreamsApi, type BetRecord } from "@/lib/api";

const PAGE_LIMIT = 1000;
const PAGE_WINDOW = 10; // keep 10k rows hot
const TARGET_ROWS = 10000; // stop bootstrapping once we reach this

export interface UseAnalysisBetsOptions {
  streamId: string;
  minMultiplier: number;
  enabled?: boolean;
}

export interface UseAnalysisBetsResult {
  bets: BetRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isBootstrapping: boolean;
}

/**
 * Analysis Mode hook for deep history analysis with min-multiplier filtering
 *
 * Features:
 * - Server-side filtering by min_multiplier
 * - Windowed infinite scroll (keeps only last N pages in memory)
 * - Progressive bootstrap to ~10k rows without blocking UI
 * - Optimized for distance analysis and median calculation
 */
export function useAnalysisBets({
  streamId,
  minMultiplier,
  enabled = true,
}: UseAnalysisBetsOptions): UseAnalysisBetsResult {
  const query = useInfiniteQuery({
    queryKey: ["analysisBets", streamId, minMultiplier],
    queryFn: async ({ pageParam = 0 }) => {
      // Server-side filtering for heavy lifting
      const response = await liveStreamsApi.getBets(streamId, {
        min_multiplier: minMultiplier,
        order: "nonce_asc", // Chronological order for distance calculation
        limit: PAGE_LIMIT,
        offset: pageParam * PAGE_LIMIT,
      });
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce(
        (sum, page) => sum + page.bets.length,
        0
      );
      return totalFetched < lastPage.total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    enabled: enabled && !!streamId && minMultiplier > 0,
    staleTime: Infinity, // Analysis data doesn't go stale
    gcTime: 60_000, // Keep in cache for 1 minute
    structuralSharing: true, // Optimize re-renders
  });

  // Keep only the newest PAGE_WINDOW pages to control memory usage
  const windowedData = useMemo(() => {
    if (!query.data) return query.data;

    const pages = query.data.pages.slice(-PAGE_WINDOW);
    const pageParams = query.data.pageParams.slice(-PAGE_WINDOW);
    return { ...query.data, pages, pageParams };
  }, [query.data]);

  // Flatten all pages into single array
  const allBets = useMemo(
    () => windowedData?.pages.flatMap((page) => page.bets) ?? [],
    [windowedData]
  );

  const total = windowedData?.pages[0]?.total ?? 0;
  const totalFetched = allBets.length;
  const isBootstrapping = totalFetched < TARGET_ROWS && query.hasNextPage;

  // Progressive bootstrap to ~10k rows without locking the UI
  useEffect(() => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    if (totalFetched >= TARGET_ROWS) return;
    if (!enabled) return;

    const bootstrap = () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    const id =
      "requestIdleCallback" in window
        ? (window as any).requestIdleCallback(bootstrap, { timeout: 1000 })
        : setTimeout(bootstrap, 0);

    return () => {
      if ("cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [
    totalFetched,
    query.hasNextPage,
    query.isFetchingNextPage,
    query.fetchNextPage,
    enabled,
  ]);

  return {
    bets: allBets,
    total,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error || null,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isBootstrapping,
  };
}
