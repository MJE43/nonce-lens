import { useQuery } from '@tanstack/react-query';
import { liveStreamsApi, type StreamSummary, type StreamListFilters } from '@/lib/api';

export interface UseLiveStreamsOptions {
  filters?: StreamListFilters;
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseLiveStreamsResult {
  streams: StreamSummary[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Hook for fetching and managing live streams list with TanStack Query
 * Provides automatic refetching, cache management, and error handling
 */
export function useLiveStreams(options: UseLiveStreamsOptions = {}): UseLiveStreamsResult {
  const { filters, enabled = true, refetchInterval } = options;

  const query = useQuery({
    queryKey: ['liveStreams', filters],
    queryFn: async () => {
      const response = await liveStreamsApi.list(filters);
      return response.data;
    },
    enabled,
    refetchInterval,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors, but not for 4xx errors
      if (failureCount >= 3) return false;
      const status = (error as any)?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    streams: query.data?.streams || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

/**
 * Hook for auto-following the latest stream
 * Polls the streams list and returns the most recently active stream
 */
export function useAutoFollowLatest(enabled: boolean = false) {
  const { streams, isLoading, error } = useLiveStreams({
    filters: { limit: 10 }, // Only need the most recent streams
    enabled,
    refetchInterval: enabled ? 2000 : undefined, // Poll every 2 seconds when enabled
  });

  // Find the most recently active stream
  const latestStream = streams.length > 0 
    ? streams.reduce((latest, current) => 
        new Date(current.last_seen_at) > new Date(latest.last_seen_at) ? current : latest
      )
    : null;

  return {
    latestStream,
    isLoading,
    error,
  };
}