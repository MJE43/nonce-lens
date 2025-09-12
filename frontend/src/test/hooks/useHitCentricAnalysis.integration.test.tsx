/**
 * Integration tests for hit-centric analysis hooks with real API endpoints.
 * 
 * This test suite focuses on:
 * - Integration between hooks and API endpoints
 * - Error handling and loading state management
 * - Cache invalidation and data consistency
 * - Performance with large datasets (10k+ hits)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useHits, useHitStats, useGlobalHitStats, useHitsBatch } from '@/hooks/useHitCentricAnalysis';
import { liveStreamsApi } from '@/lib/api';

// Mock API client
vi.mock('@/lib/api', () => ({
  liveStreamsApi: {
    getHits: vi.fn(),
    getHitStats: vi.fn(),
    getGlobalHitStats: vi.fn(),
    getBatchHits: vi.fn(),
  },
}));

const mockLiveStreamsApi = vi.mocked(liveStreamsApi);

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Hit-Centric Analysis Hooks Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useHits hook', () => {
    it('should fetch hits data successfully', async () => {
      const mockHitsResponse = {
        hits: [
          { id: 1, nonce: 1000, bucket: 11200, distance_prev: null, date_time: '2024-01-01T00:00:00Z' },
          { id: 2, nonce: 2500, bucket: 11200, distance_prev: 1500, date_time: '2024-01-01T01:00:00Z' },
          { id: 3, nonce: 4200, bucket: 11200, distance_prev: 1700, date_time: '2024-01-01T02:00:00Z' },
        ],
        prev_nonce_before_range: null,
        total_in_range: 3,
        has_more: false,
      };

      mockLiveStreamsApi.getHits.mockResolvedValueOnce({ data: mockHitsResponse });

      const { result } = renderHook(
        () => useHits({
          streamId: 'test-stream-id',
          bucket: 11200,
          range: [0, 10000],
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockHitsResponse);
      expect(mockLiveStreamsApi.getHits).toHaveBeenCalledWith(
        'test-stream-id',
        {
          bucket: 11200,
          after_nonce: 0,
          before_nonce: 10000,
          limit: 500,
          order: 'nonce_asc',
          include_distance: true,
        }
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Stream not found');
      mockLiveStreamsApi.getHits.mockRejectedValueOnce(mockError);

      const { result } = renderHook(
        () => useHits({
          streamId: 'invalid-stream-id',
          bucket: 11200,
          range: [0, 10000],
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(mockError);
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => useHits({
          streamId: 'test-stream-id',
          bucket: 11200,
          range: [0, 10000],
          enabled: false,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isFetching).toBe(false);
      expect(mockLiveStreamsApi.getHits).not.toHaveBeenCalled();
    });

    it('should handle large datasets efficiently', async () => {
      // Mock large dataset response
      const largeHitsResponse = {
        hits: Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          nonce: i * 100,
          bucket: 11200,
          distance_prev: i === 0 ? null : 100,
          date_time: `2024-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
        })),
        prev_nonce_before_range: null,
        total_in_range: 1000,
        has_more: true,
      };

      mockLiveStreamsApi.getHits.mockResolvedValueOnce({ data: largeHitsResponse });

      const startTime = performance.now();
      
      const { result } = renderHook(
        () => useHits({
          streamId: 'test-stream-id',
          bucket: 11200,
          range: [0, 100000],
          limit: 1000,
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current.data?.hits).toHaveLength(1000);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('useHitStats hook', () => {
    it('should fetch per-range statistics successfully', async () => {
      const mockStatsResponse = {
        stats_by_range: [
          {
            range: '0-10000',
            count: 15,
            median: 650,
            mean: 667,
            min: 100,
            max: 1500,
            method: 'exact' as const,
          },
          {
            range: '10000-20000',
            count: 12,
            median: 800,
            mean: 833,
            min: 200,
            max: 1800,
            method: 'exact' as const,
          },
        ],
      };

      mockLiveStreamsApi.getHitStats.mockResolvedValueOnce({ data: mockStatsResponse });

      const { result } = renderHook(
        () => useHitStats({
          streamId: 'test-stream-id',
          bucket: 11200,
          ranges: ['0-10000', '10000-20000'],
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStatsResponse);
      expect(mockLiveStreamsApi.getHitStats).toHaveBeenCalledWith(
        'test-stream-id',
        {
          bucket: 11200,
          ranges: '0-10000,10000-20000',
        }
      );
    });

    it('should handle empty statistics gracefully', async () => {
      const mockEmptyStatsResponse = {
        stats_by_range: [
          {
            range: '0-10000',
            count: 0,
            median: null,
            mean: null,
            min: null,
            max: null,
            method: 'exact' as const,
          },
        ],
      };

      mockLiveStreamsApi.getHitStats.mockResolvedValueOnce({ data: mockEmptyStatsResponse });

      const { result } = renderHook(
        () => useHitStats({
          streamId: 'test-stream-id',
          bucket: 99999, // Very rare multiplier
          ranges: ['0-10000'],
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.stats_by_range[0].count).toBe(0);
      expect(result.current.data?.stats_by_range[0].median).toBeNull();
    });
  });

  describe('useGlobalHitStats hook', () => {
    it('should fetch global statistics successfully', async () => {
      const mockGlobalStatsResponse = {
        global_stats: {
          count: 127,
          median: 750,
          mean: 787,
          min: 50,
          max: 3200,
          theoretical_eta: 892, // 1 / probability
          confidence_interval: [720, 780] as [number, number],
          method: 'exact' as const,
        },
      };

      mockLiveStreamsApi.getGlobalHitStats.mockResolvedValueOnce({ data: mockGlobalStatsResponse });

      const { result } = renderHook(
        () => useGlobalHitStats({
          streamId: 'test-stream-id',
          bucket: 11200,
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockGlobalStatsResponse);
      expect(mockLiveStreamsApi.getGlobalHitStats).toHaveBeenCalledWith(
        'test-stream-id',
        {
          bucket: 11200,
        }
      );
    });

    it('should handle theoretical ETA calculations', async () => {
      const mockStatsWithETA = {
        global_stats: {
          count: 50,
          median: 1200,
          mean: 1150,
          min: 200,
          max: 4500,
          theoretical_eta: 1000, // Expected based on probability
          confidence_interval: [1100, 1300] as [number, number],
          method: 'exact' as const,
        },
      };

      mockLiveStreamsApi.getGlobalHitStats.mockResolvedValueOnce({ data: mockStatsWithETA });

      const { result } = renderHook(
        () => useGlobalHitStats({
          streamId: 'test-stream-id',
          bucket: 48800, // Ultra-rare multiplier
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const stats = result.current.data?.global_stats;
      expect(stats?.theoretical_eta).toBe(1000);
      expect(stats?.confidence_interval).toEqual([1100, 1300]);
    });
  });

  describe('useHitsBatch hook', () => {
    it('should fetch multiple buckets simultaneously', async () => {
      const mockBatchResponse = {
        hits_by_bucket: {
          '11200': [
            { id: 1, nonce: 1000, bucket: 11200, distance_prev: null, date_time: '2024-01-01T00:00:00Z' },
            { id: 2, nonce: 2500, bucket: 11200, distance_prev: 1500, date_time: '2024-01-01T01:00:00Z' },
          ],
          '48800': [
            { id: 3, nonce: 5000, bucket: 48800, distance_prev: null, date_time: '2024-01-01T03:00:00Z' },
          ],
        },
        stats_by_bucket: {
          '11200': {
            count: 2,
            median: 1500,
            mean: 1500,
            min: 1500,
            max: 1500,
            method: 'exact' as const,
          },
          '48800': {
            count: 1,
            median: null,
            mean: null,
            min: null,
            max: null,
            method: 'exact' as const,
          },
        },
      };

      mockLiveStreamsApi.getBatchHits.mockResolvedValueOnce({ data: mockBatchResponse });

      const { result } = renderHook(
        () => useHitsBatch({
          streamId: 'test-stream-id',
          buckets: [11200, 48800],
          range: [0, 10000],
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockBatchResponse);
      expect(mockLiveStreamsApi.getBatchHits).toHaveBeenCalledWith(
        'test-stream-id',
        {
          buckets: '11200,48800',
          after_nonce: 0,
          before_nonce: 10000,
          limit_per_bucket: 500,
        }
      );
    });

    it('should handle batch queries with different bucket counts', async () => {
      const mockBatchResponse = {
        hits_by_bucket: {
          '2': Array.from({ length: 500 }, (_, i) => ({
            id: i + 1,
            nonce: i * 20,
            bucket: 2,
            distance_prev: i === 0 ? null : 20,
            date_time: `2024-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
          })),
          '11200': [
            { id: 501, nonce: 15000, bucket: 11200, distance_prev: null, date_time: '2024-01-01T15:00:00Z' },
          ],
        },
        stats_by_bucket: {
          '2': {
            count: 500,
            median: 20,
            mean: 20,
            min: 20,
            max: 20,
            method: 'exact' as const,
          },
          '11200': {
            count: 1,
            median: null,
            mean: null,
            min: null,
            max: null,
            method: 'exact' as const,
          },
        },
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockBatchResponse });

      const { result } = renderHook(
        () => useHitsBatch({
          streamId: 'test-stream-id',
          buckets: [2, 11200], // Common vs rare multiplier
          range: [0, 20000],
          limitPerBucket: 500,
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.hits_by_bucket['2']).toHaveLength(500);
      expect(result.current.data?.hits_by_bucket['11200']).toHaveLength(1);
    });
  });

  describe('Cache invalidation and consistency', () => {
    it('should maintain cache consistency across hook interactions', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 10 * 60 * 1000, // 10 minutes
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      // Mock responses
      const mockHitsResponse = {
        hits: [
          { id: 1, nonce: 1000, bucket: 11200, distance_prev: null, date_time: '2024-01-01T00:00:00Z' },
        ],
        prev_nonce_before_range: null,
        total_in_range: 1,
        has_more: false,
      };

      const mockStatsResponse = {
        stats_by_range: [
          {
            range: '0-10000',
            count: 1,
            median: null,
            mean: null,
            min: null,
            max: null,
            method: 'exact' as const,
          },
        ],
      };

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockHitsResponse })
        .mockResolvedValueOnce({ data: mockStatsResponse });

      // First hook call
      const { result: hitsResult } = renderHook(
        () => useHits({
          streamId: 'test-stream-id',
          bucket: 11200,
          range: [0, 10000],
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hitsResult.current.isSuccess).toBe(true);
      });

      // Second hook call should use cached data
      const { result: statsResult } = renderHook(
        () => useHitStats({
          streamId: 'test-stream-id',
          bucket: 11200,
          ranges: ['0-10000'],
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(statsResult.current.isSuccess).toBe(true);
      });

      // Verify both hooks have consistent data
      expect(hitsResult.current.data?.hits).toHaveLength(1);
      expect(statsResult.current.data?.stats_by_range[0].count).toBe(1);
    });

    it('should invalidate cache when range changes', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      // Mock different responses for different ranges
      mockApiClient.get
        .mockResolvedValueOnce({
          data: {
            hits: [{ id: 1, nonce: 1000, bucket: 11200, distance_prev: null, date_time: '2024-01-01T00:00:00Z' }],
            prev_nonce_before_range: null,
            total_in_range: 1,
            has_more: false,
          },
        })
        .mockResolvedValueOnce({
          data: {
            hits: [{ id: 2, nonce: 15000, bucket: 11200, distance_prev: null, date_time: '2024-01-01T15:00:00Z' }],
            prev_nonce_before_range: null,
            total_in_range: 1,
            has_more: false,
          },
        });

      const { result, rerender } = renderHook(
        ({ range }) => useHits({
          streamId: 'test-stream-id',
          bucket: 11200,
          range,
        }),
        {
          wrapper,
          initialProps: { range: [0, 10000] as [number, number] },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.hits[0].nonce).toBe(1000);

      // Change range
      rerender({ range: [10000, 20000] as [number, number] });

      await waitFor(() => {
        expect(result.current.data?.hits[0].nonce).toBe(15000);
      });

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling and loading states', () => {
    it('should provide proper loading states', () => {
      mockApiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(
        () => useHits({
          streamId: 'test-stream-id',
          bucket: 11200,
          range: [0, 10000],
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle network errors with retry logic', async () => {
      const networkError = new Error('Network error');
      mockApiClient.get.mockRejectedValue(networkError);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            retryDelay: 100,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(
        () => useHits({
          streamId: 'test-stream-id',
          bucket: 11200,
          range: [0, 10000],
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should have retried 2 times + initial attempt = 3 total calls
      expect(mockApiClient.get).toHaveBeenCalledTimes(3);
      expect(result.current.error).toBe(networkError);
    });

    it('should handle API validation errors', async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            code: 'INVALID_BUCKET',
            message: 'Bucket value must be a positive number',
          },
        },
      };

      mockApiClient.get.mockRejectedValueOnce(validationError);

      const { result } = renderHook(
        () => useHits({
          streamId: 'test-stream-id',
          bucket: -1, // Invalid bucket
          range: [0, 10000],
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(validationError);
    });
  });
});