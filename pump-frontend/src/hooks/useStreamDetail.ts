import { useQuery } from '@tanstack/react-query';
import { liveStreamsApi, type StreamDetail, type BetRecord, type StreamBetsFilters } from '@/lib/api';

export interface UseStreamDetailOptions {
  streamId: string;
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseStreamDetailResult {
  stream: StreamDetail | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Hook for fetching and managing stream detail data with TanStack Query
 * Provides real-time polling integration and error handling
 */
export function useStreamDetail(options: UseStreamDetailOptions): UseStreamDetailResult {
  const { streamId, enabled = true, refetchInterval } = options;

  const query = useQuery({
    queryKey: ['streamDetail', streamId],
    queryFn: async () => {
      const response = await liveStreamsApi.get(streamId);
      return response.data;
    },
    enabled: enabled && !!streamId,
    refetchInterval,
    staleTime: 10 * 1000, // Consider data stale after 10 seconds for real-time updates
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors, but not for 4xx errors
      if (failureCount >= 3) return false;
      const status = (error as any)?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    stream: query.data || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export interface UseStreamBetsOptions {
  streamId: string;
  filters?: StreamBetsFilters;
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseStreamBetsResult {
  bets: BetRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Hook for fetching stream bets with pagination and filtering
 * Supports real-time updates through polling
 */
export function useStreamBets(options: UseStreamBetsOptions): UseStreamBetsResult {
  const { streamId, filters, enabled = true, refetchInterval } = options;

  const query = useQuery({
    queryKey: ['streamBets', streamId, filters],
    queryFn: async () => {
      const response = await liveStreamsApi.getBets(streamId, filters);
      return response.data;
    },
    enabled: enabled && !!streamId,
    refetchInterval,
    staleTime: 5 * 1000, // Consider data stale after 5 seconds for bet updates
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors, but not for 4xx errors
      if (failureCount >= 3) return false;
      const status = (error as any)?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    bets: query.data?.bets || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

/**
 * Combined hook for stream detail page that fetches both stream info and bets
 * Provides coordinated loading states and error handling
 */
export function useStreamDetailPage(streamId: string, betsFilters?: StreamBetsFilters) {
  const streamDetail = useStreamDetail({
    streamId,
    refetchInterval: 30 * 1000, // Refresh stream metadata every 30 seconds
  });

  const streamBets = useStreamBets({
    streamId,
    filters: betsFilters,
    refetchInterval: 10 * 1000, // Refresh bets every 10 seconds
  });

  return {
    stream: streamDetail.stream,
    bets: streamBets.bets,
    totalBets: streamBets.total,
    isLoading: streamDetail.isLoading || streamBets.isLoading,
    isError: streamDetail.isError || streamBets.isError,
    error: streamDetail.error || streamBets.error,
    isFetching: streamDetail.isFetching || streamBets.isFetching,
    refetchStream: streamDetail.refetch,
    refetchBets: streamBets.refetch,
    refetchAll: () => {
      streamDetail.refetch();
      streamBets.refetch();
    },
  };
}