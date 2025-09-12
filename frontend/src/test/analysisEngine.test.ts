/**
 * Tests for the Analysis Engine interface
 * Ensures the interface works correctly and provides consistent access
 */

import { describe, test, expect } from 'vitest';
import { analysisEngine, type AnalysisEngine, type HitRecord } from '../lib/analysisEngine';

describe('AnalysisEngine Interface', () => {
  test('provides all required methods', () => {
    expect(typeof analysisEngine.computeDistancesNonceAsc).toBe('function');
    expect(typeof analysisEngine.bucketMultiplier).toBe('function');
    expect(typeof analysisEngine.calculateBucketStats).toBe('function');
    expect(typeof analysisEngine.filterHitsByRange).toBe('function');
    expect(typeof analysisEngine.validateDistanceConsistency).toBe('function');
  });

  test('interface methods work correctly', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    // Test bucket normalization
    expect(analysisEngine.bucketMultiplier(11200.0000001)).toBe(11200.00);

    // Test distance computation
    const distances = analysisEngine.computeDistancesNonceAsc(hits);
    expect(distances.get(1)).toBe(null);
    expect(distances.get(2)).toBe(100);

    // Test statistics calculation
    const stats = analysisEngine.calculateBucketStats(hits, distances);
    expect(stats.count).toBe(1);
    expect(stats.median).toBe(100);

    // Test range filtering
    const filtered = analysisEngine.filterHitsByRange(hits, [150, 250]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);

    // Test validation
    expect(analysisEngine.validateDistanceConsistency(hits, distances)).toBe(true);
  });
});