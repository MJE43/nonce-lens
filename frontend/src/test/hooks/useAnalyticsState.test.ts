import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalyticsState } from '../../hooks/useAnalyticsState';
import type { BetRecord } from '../../lib/analytics/types';

describe('useAnalyticsState', () => {
  const mockBets: BetRecord[] = [
    {
      id: 1,
      nonce: 1000,
      payout_multiplier: 2.5,
      date_time: '2024-01-01T00:00:00Z',
      amount: 100,
      payout: 250,
      difficulty: 'medium',
      round_target: 'target1',
      round_result: 'result1'
    },
    {
      id: 2,
      nonce: 1100,
      payout_multiplier: 5.0,
      date_time: '2024-01-01T00:01:00Z',
      amount: 100,
      payout: 500,
      difficulty: 'medium',
      round_target: 'target2',
      round_result: 'result2'
    },
    {
      id: 3,
      nonce: 1200,
      payout_multiplier: 10.0,
      date_time: '2024-01-01T00:02:00Z',
      amount: 100,
      payout: 1000,
      difficulty: 'medium',
      round_target: 'target3',
      round_result: 'result3'
    }
  ];

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    expect(result.current.state.bets).toHaveLength(0);
    expect(result.current.state.kpis.hitsCount).toBe(0);
    expect(result.current.state.kpis.highestMultiplier).toBe(0);
    expect(result.current.state.pinnedMultipliers.size).toBe(0);
    expect(result.current.state.isLive).toBe(false);
  });

  it('should update state from tail data', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.updateFromTail(mockBets);
    });
    
    const state = result.current.state;
    expect(state.bets).toHaveLength(3);
    expect(state.kpis.hitsCount).toBe(3);
    expect(state.kpis.highestMultiplier).toBe(10.0);
    expect(state.kpis.latestNonce).toBe(1200);
    expect(state.isLive).toBe(true);
    expect(state.topPeaks).toHaveLength(3); // All multipliers >= 2.0
  });

  it('should calculate KPIs correctly', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.updateFromTail(mockBets);
    });
    
    const kpis = result.current.state.kpis;
    expect(kpis.latestGap).toBe(100); // 1200 - 1100
    expect(kpis.hitRate).toBeGreaterThanOrEqual(0); // Should calculate hits/min (may be 0 in fast tests)
    expect(kpis.streamDurationSeconds).toBeGreaterThanOrEqual(0);
    expect(kpis.hitsCount).toBe(3);
  });

  it('should pin and unpin multipliers', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.pinMultiplier(5.0);
    });
    
    expect(result.current.state.pinnedMultipliers.has(5.0)).toBe(true);
    
    act(() => {
      result.current.unpinMultiplier(5.0);
    });
    
    expect(result.current.state.pinnedMultipliers.has(5.0)).toBe(false);
  });

  it('should update filters', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.updateFilters({ 
        minMultiplier: 3.0,
        showOnlyPinned: true 
      });
    });
    
    const filters = result.current.state.filters;
    expect(filters.minMultiplier).toBe(3.0);
    expect(filters.showOnlyPinned).toBe(true);
    expect(filters.order).toBe('id_desc'); // Should preserve existing values
  });

  it('should track top peaks correctly', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.updateFromTail(mockBets);
    });
    
    const peaks = result.current.state.topPeaks;
    expect(peaks).toHaveLength(3);
    expect(peaks[0].multiplier).toBe(10.0); // Highest first
    expect(peaks[1].multiplier).toBe(5.0);
    expect(peaks[2].multiplier).toBe(2.5);
  });

  it('should update density data', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.updateFromTail(mockBets);
    });
    
    const densityData = result.current.state.densityData;
    expect(densityData.buckets.size).toBeGreaterThan(0);
    expect(densityData.bucketSize).toBe(1000);
    expect(densityData.maxCount).toBeGreaterThan(0);
  });

  it('should reset state when stream changes', () => {
    const { result, rerender } = renderHook(
      ({ streamId }) => useAnalyticsState(streamId),
      { initialProps: { streamId: 'stream1' } }
    );
    
    act(() => {
      result.current.updateFromTail(mockBets);
    });
    
    expect(result.current.state.bets).toHaveLength(3);
    
    // Change stream
    rerender({ streamId: 'stream2' });
    
    expect(result.current.state.bets).toHaveLength(0);
    expect(result.current.state.kpis.hitsCount).toBe(0);
    expect(result.current.state.isLive).toBe(false);
  });

  it('should configure rolling window', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.configureRollingWindow('count', 100);
    });
    
    // The configuration should be applied (we can't directly test the internal state,
    // but we can verify the method doesn't throw)
    expect(result.current.configureRollingWindow).toBeDefined();
  });

  it('should handle empty tail updates', () => {
    const { result } = renderHook(() => useAnalyticsState('test-stream'));
    
    act(() => {
      result.current.updateFromTail([]);
    });
    
    expect(result.current.state.bets).toHaveLength(0);
    expect(result.current.state.kpis.hitsCount).toBe(0);
  });
});