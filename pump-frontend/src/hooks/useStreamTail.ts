import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { liveStreamsApi, type BetRecord, type TailResponse } from "@/lib/api";

export interface UseStreamTailOptions {
  streamId: string;
  enabled?: boolean;
  pollingInterval?: number;
  includeDistance?: boolean;
  initialLastId?: number;
  onNewBets?: (newBets: BetRecord[]) => void;
  onError?: (error: Error) => void;
}

export interface UseStreamTailResult {
  newBets: BetRecord[];
  lastId: number;
  isPolling: boolean;
  isError: boolean;
  error: Error | null;
  totalNewBets: number;
  startPolling: () => void;
  stopPolling: () => void;
  resetTail: () => void;
}

/**
 * Hook for incremental bet updates using since_id parameter
 * Polls every 1-2 seconds with automatic error recovery
 * Includes optimistic UI updates and conflict resolution
 */
export function useStreamTail(
  options: UseStreamTailOptions
): UseStreamTailResult {
  const {
    streamId,
    enabled = true,
    pollingInterval = 1500, // 1.5 seconds default
    includeDistance = false,
    initialLastId = 0,
    onNewBets,
    onError,
  } = options;

  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(enabled);
  const [lastId, setLastId] = useState(initialLastId);
  const [newBets, setNewBets] = useState<BetRecord[]>([]);
  const [totalNewBets, setTotalNewBets] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0);
  const maxErrorCount = 5;

  // Query for tail updates
  const tailQuery = useQuery({
    queryKey: ["streamTail", streamId, lastId],
    queryFn: async (): Promise<TailResponse> => {
      const response = await liveStreamsApi.tail(
        streamId,
        lastId,
        includeDistance
      );
      return response.data;
    },
    enabled: false, // We'll trigger this manually
    staleTime: 0, // Always fetch fresh data
    gcTime: 30 * 1000, // Keep in cache for 30 seconds
    retry: false, // Handle retries manually for better control
  });

  // Function to fetch new bets
  const fetchNewBets = useCallback(async () => {
    if (!streamId || !isPolling) return;

    try {
      const result = await tailQuery.refetch();

      if (result.data) {
        const { bets, lastId: newLastId } = result.data;

        if (bets.length > 0) {
          // Update state with new bets
          setNewBets((prev) => [...prev, ...bets]);
          setTotalNewBets((prev) => prev + bets.length);
          // Only update if changed to avoid unnecessary renders
          setLastId((prev) => (prev !== newLastId ? newLastId : prev));

          // Notify callback
          onNewBets?.(bets);

          // Invalidate related queries to update the UI
          queryClient.invalidateQueries({ queryKey: ["streamBets", streamId] });
          queryClient.invalidateQueries({
            queryKey: ["streamDetail", streamId],
          });
        } else {
          // Update lastId even if no new bets
          setLastId((prev) => (prev !== newLastId ? newLastId : prev));
        }

        // Reset error count on success
        errorCountRef.current = 0;
      }
    } catch (error) {
      errorCountRef.current += 1;

      // Stop polling if too many consecutive errors
      if (errorCountRef.current >= maxErrorCount) {
        setIsPolling(false);
        onError?.(error as Error);
      }

      console.warn(
        `Stream tail polling error (${errorCountRef.current}/${maxErrorCount}):`,
        error
      );
    }
  }, [streamId, isPolling, lastId, tailQuery, queryClient, onNewBets, onError]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!streamId) return;

    setIsPolling(true);
    errorCountRef.current = 0;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start new polling interval
    intervalRef.current = setInterval(fetchNewBets, pollingInterval);

    // Fetch immediately
    fetchNewBets();
  }, [streamId, pollingInterval]); // Remove fetchNewBets from dependencies

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Reset tail state
  const resetTail = useCallback(() => {
    setLastId(0);
    setNewBets([]);
    setTotalNewBets(0);
    errorCountRef.current = 0;
  }, []);

  // Auto-start polling when enabled
  useEffect(() => {
    if (enabled && streamId) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, streamId]); // Remove function dependencies to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    newBets,
    lastId,
    isPolling,
    isError: tailQuery.isError && errorCountRef.current >= maxErrorCount,
    error: tailQuery.error,
    totalNewBets,
    startPolling,
    stopPolling,
    resetTail,
  };
}

/**
 * Hook for managing real-time bet updates with optimistic UI
 * Combines tail polling with existing bet data for seamless updates
 */
export function useRealTimeBets(
  streamId: string,
  initialBets: BetRecord[] = []
) {
  const [allBets, setAllBets] = useState<BetRecord[]>(initialBets);
  const [isRealTimeActive, setIsRealTimeActive] = useState(true);
  const [newlyFetchedBets, setNewlyFetchedBets] = useState<BetRecord[]>([]);

  // Calculate initial lastId from existing bets
  const initialLastId = useMemo(() => {
    if (allBets.length === 0) return 0;
    return Math.max(...allBets.map((bet) => bet.id));
  }, [allBets]);

  const tail = useStreamTail({
    streamId,
    enabled: isRealTimeActive,
    initialLastId,
    onNewBets: (newBets) => {
      const existingIds = new Set(allBets.map((bet) => bet.id));
      const uniqueNewBets = newBets.filter((bet) => !existingIds.has(bet.id));

      if (uniqueNewBets.length > 0) {
        setAllBets((prev) =>
          [...prev, ...uniqueNewBets].sort((a, b) => b.nonce - a.nonce)
        );
        setNewlyFetchedBets(uniqueNewBets);
      } else {
        setNewlyFetchedBets([]);
      }
    },
    onError: (error) => {
      console.error("Real-time updates failed:", error);
      setIsRealTimeActive(false);
    },
  });

  // Update all bets when initial bets change
  useEffect(() => {
    // Guard: only update when content meaningfully changes
    setAllBets((prev) => {
      if (prev === initialBets) return prev;
      const prevLen = prev.length;
      const nextLen = (initialBets ?? []).length;
      if (prevLen === nextLen) {
        const prevLast = prevLen > 0 ? prev[prevLen - 1]?.id : undefined;
        const nextLast =
          nextLen > 0 ? (initialBets ?? [])[nextLen - 1]?.id : undefined;
        if (prevLast === nextLast) return prev;
      }
      return initialBets ?? [];
    });
  }, [initialBets]);

  const startRealTime = useCallback(() => {
    setIsRealTimeActive(true);
  }, []);

  const stopRealTime = useCallback(() => {
    setIsRealTimeActive(false);
    tail.stopPolling();
  }, [tail]);

  const resetRealTime = useCallback(() => {
    tail.resetTail();
    setAllBets(initialBets);
    setNewlyFetchedBets([]);
  }, [tail, initialBets]);

  return {
    bets: allBets,
    newBets: newlyFetchedBets,
    newBetsCount: newlyFetchedBets.length,
    isRealTimeActive,
    isPolling: tail.isPolling,
    isError: tail.isError,
    error: tail.error,
    startRealTime,
    stopRealTime,
    resetRealTime,
  };
}
