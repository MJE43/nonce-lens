import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { liveStreamsApi, type BetRecord, type TailResponse } from '@/lib/api';

export interface UseStreamTailOptions {
  streamId: string;
  enabled?: boolean;
  pollingInterval?: number;
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
export function useStreamTail(options: UseStreamTailOptions): UseStreamTailResult {
  const { 
    streamId, 
    enabled = true, 
    pollingInterval = 1500, // 1.5 seconds default
    onNewBets,
    onError 
  } = options;

  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(enabled);
  const [lastId, setLastId] = useState(0);
  const [newBets, setNewBets] = useState<BetRecord[]>([]);
  const [totalNewBets, setTotalNewBets] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0);
  const maxErrorCount = 5;

  // Query for tail updates
  const tailQuery = useQuery({
    queryKey: ['streamTail', streamId, lastId],
    queryFn: async (): Promise<TailResponse> => {
      const response = await liveStreamsApi.tail(streamId, lastId);
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
          setNewBets(prev => [...prev, ...bets]);
          setTotalNewBets(prev => prev + bets.length);
          setLastId(newLastId);
          
          // Notify callback
          onNewBets?.(bets);
          
          // Invalidate related queries to update the UI
          queryClient.invalidateQueries({ queryKey: ['streamBets', streamId] });
          queryClient.invalidateQueries({ queryKey: ['streamDetail', streamId] });
        } else {
          // Update lastId even if no new bets
          setLastId(newLastId);
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
      
      console.warn(`Stream tail polling error (${errorCountRef.current}/${maxErrorCount}):`, error);
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
  }, [streamId, pollingInterval, fetchNewBets]);

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
  }, [enabled, streamId, startPolling, stopPolling]);

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
export function useRealTimeBets(streamId: string, initialBets: BetRecord[] = []) {
  const [allBets, setAllBets] = useState<BetRecord[]>(initialBets);
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);

  const tail = useStreamTail({
    streamId,
    enabled: isRealTimeActive,
    onNewBets: (newBets) => {
      // Optimistically add new bets to the list
      setAllBets(prev => {
        // Avoid duplicates by checking bet IDs
        const existingIds = new Set(prev.map(bet => bet.id));
        const uniqueNewBets = newBets.filter(bet => !existingIds.has(bet.id));
        
        // Sort by nonce ascending (as per requirements)
        return [...prev, ...uniqueNewBets].sort((a, b) => a.nonce - b.nonce);
      });
    },
    onError: (error) => {
      console.error('Real-time updates failed:', error);
      setIsRealTimeActive(false);
    },
  });

  // Update all bets when initial bets change
  useEffect(() => {
    setAllBets(initialBets);
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
  }, [tail, initialBets]);

  return {
    bets: allBets,
    newBetsCount: tail.totalNewBets,
    isRealTimeActive,
    isPolling: tail.isPolling,
    isError: tail.isError,
    error: tail.error,
    startRealTime,
    stopRealTime,
    resetRealTime,
  };
}