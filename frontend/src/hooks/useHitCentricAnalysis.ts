import { useQuery } from '@tanstack/react-query';
import {
  liveStreamsApi,
  type HitRecord,
  type BucketStats,
  type RangeStats,
  type HitQueryFilters,
  type HitStatsFilters,
  type BatchHitFilters,
  type HitQueryResponse,
  type HitStatsResponse,
  type GlobalHitStatsResponse,
  type BatchHitQueryResponse,
} from '@/lib/api';

export interface UseHitsOptions {
  streamId: string;
  bucket: number;
  range?: [number, number]; // [after_nonce, before_nonce]
  limit?: number;
  order?: 'nonce_asc' | 'nonce_desc';
  includeDistance?: boolean;
  enabled?: boolean;
}

export interface UseHitsResult {
  hits: HitRecord[];
  prevNonceBeforeRange: number | null;
  totalInRange: number;
  hasMore: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Hook for fetching hits for a specific multiplier bucket with React Query integration
 * and range-based caching. Configured with 5-minute stale time for hits.
 */
export function useHits(options: UseHitsOptions): UseHitsResult {
  const {
    streamId,
    bucket,
    range,
    limit = 500,
    order = 'nonce_asc',
    includeDistance = true,
    enabled = true,
  } = options;

  const queryParams: HitQueryFilters = {
    bucket,
    limit,
    order,
    include_distance: includeDistance,
    ...(range && {
      after_nonce: range[0],
      before_nonce: range[1],
    }),
  };

  const query = useQuery({
    queryKey: ['hits', streamId, queryParams],
    queryFn: async (): Promise<HitQueryResponse> => {
      const response = await liveStreamsApi.getHits(streamId, queryParams);
      return response.data;
    },
    enabled: enabled && !!streamId && typeof bucket === 'number',
    staleTime: 5 * 60 * 1000, // 5 minutes - hits data is relatively stable
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors, but not for 4xx errors
      if (failureCount >= 3) return false;
      const status = (error as any)?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    hits: query.data?.hits || [],
    prevNonceBeforeRange: query.data?.prev_nonce_before_range || null,
    totalInRange: query.data?.total_in_range || 0,
    hasMore: query.data?.has_more || false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export interface UseHitStatsOptions {
  streamId: string;
  bucket: number;
  ranges?: string[]; // Array of range strings like ["0-10000", "10000-20000"]
  enabled?: boolean;
}

export interface UseHitStatsResult {
  statsByRange: RangeStats[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Hook for fetching hit statistics for specific ranges.
 * Configured with 2-minute stale time for stats.
 */
export function useHitStats(options: UseHitStatsOptions): UseHitStatsResult {
  const { streamId, bucket, ranges, enabled = true } = options;

  const queryParams: HitStatsFilters = {
    bucket,
    ...(ranges && ranges.length > 0 && {
      ranges: ranges.join(','),
    }),
  };

  const query = useQuery({
    queryKey: ['hitStats', streamId, queryParams],
    queryFn: async (): Promise<HitStatsResponse> => {
      const response = await liveStreamsApi.getHitStats(streamId, queryParams);
      return response.data;
    },
    enabled: enabled && !!streamId && typeof bucket === 'number',
    staleTime: 2 * 60 * 1000, // 2 minutes - stats change more frequently
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false;
      const status = (error as any)?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    statsByRange: query.data?.stats_by_range || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export interface UseGlobalHitStatsOptions {
  streamId: string;
  bucket: number;
  enabled?: boolean;
}

export interface UseGlobalHitStatsResult {
  globalStats: BucketStats | null;
  theoreticalEta: number | null;
  confidenceInterval: [number, number] | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Hook for fetching global hit statistics across the entire seed history.
 * Configured with 2-minute stale time for stats.
 */
export function useGlobalHitStats(options: UseGlobalHitStatsOptions): UseGlobalHitStatsResult {
  const { streamId, bucket, enabled = true } = options;

  const query = useQuery({
    queryKey: ['globalHitStats', streamId, bucket],
    queryFn: async (): Promise<GlobalHitStatsResponse> => {
      const response = await liveStreamsApi.getGlobalHitStats(streamId, { bucket });
      return response.data;
    },
    enabled: enabled && !!streamId && typeof bucket === 'number',
    staleTime: 2 * 60 * 1000, // 2 minutes - global stats change less frequently
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (global stats are expensive)
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false;
      const status = (error as any)?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    globalStats: query.data?.global_stats || null,
    theoreticalEta: query.data?.theoretical_eta || null,
    confidenceInterval: query.data?.confidence_interval || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export interface UseHitsBatchOptions {
  streamId: string;
  buckets: number[]; // Array of bucket values
  range?: [number, number]; // [after_nonce, before_nonce]
  limitPerBucket?: number;
  enabled?: boolean;
}

export interface UseHitsBatchResult {
  hitsByBucket: Record<string, HitRecord[]>;
  statsByBucket: Record<string, BucketStats>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Hook for fetching hits for multiple buckets in a single request.
 * Useful for multi-bucket analysis scenarios.
 * Configured with 5-minute stale time for hits.
 */
export function useHitsBatch(options: UseHitsBatchOptions): UseHitsBatchResult {
  const {
    streamId,
    buckets,
    range,
    limitPerBucket = 500,
    enabled = true,
  } = options;

  const queryParams: BatchHitFilters = {
    buckets: buckets.map(b => b.toString()).join(','),
    limit_per_bucket: limitPerBucket,
    ...(range && {
      after_nonce: range[0],
      before_nonce: range[1],
    }),
  };

  const query = useQuery({
    queryKey: ['hitsBatch', streamId, queryParams],
    queryFn: async (): Promise<BatchHitQueryResponse> => {
      const response = await liveStreamsApi.getBatchHits(streamId, queryParams);
      return response.data;
    },
    enabled: enabled && !!streamId && buckets.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - batch hits data is relatively stable
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false;
      const status = (error as any)?.apiError?.status;
      return !status || status >= 500;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    hitsByBucket: query.data?.hits_by_bucket || {},
    statsByBucket: query.data?.stats_by_bucket || {},
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

// Utility hook for range-based caching management
export interface UseCacheManagementOptions {
  streamId: string;
  maxCachedRanges?: number;
}

/**
 * Utility hook for managing hit-centric query cache.
 * Helps with LRU eviction of old ranges to prevent memory bloat.
 */
export function useCacheManagement(options: UseCacheManagementOptions) {
  const { streamId, maxCachedRanges = 6 } = options;
  
  // This would be implemented with React Query's cache management
  // For now, we rely on React Query's built-in gcTime settings
  // Future enhancement could implement custom LRU logic here
  
  return {
    clearCache: () => {
      // Implementation would clear specific cache entries
      console.log(`Cache management for stream ${streamId} - max ranges: ${maxCachedRanges}`);
    },
  };
}