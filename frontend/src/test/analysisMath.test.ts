/**
 * Comprehensive unit tests for the shared analysis engine
 * Requirements 15.1, 15.2, 15.3: Verify distance calculations, bucketing, and statistics accuracy
 */

import { describe, test, expect } from 'vitest';
import {
  bucketMultiplier,
  computeDistancesNonceAsc,
  computeDistancesForHits,
  calculateBucketStats,
  filterHitsByRange,
  validateDistanceConsistency,
  medianInt,
  getDistancesForMultiplier,
  getMultiplierStats,
  type Bet,
  type HitRecord,
  type BucketStats
} from '../lib/analysisMath';

describe('bucketMultiplier', () => {
  test('normalizes multipliers to 2 decimal places', () => {
    expect(bucketMultiplier(11200.0000001)).toBe(11200.00);
    expect(bucketMultiplier(11200.999)).toBe(11201.00);
    expect(bucketMultiplier(400.02)).toBe(400.02);
    expect(bucketMultiplier(400.0200000003)).toBe(400.02);
  });

  test('handles edge cases', () => {
    expect(bucketMultiplier(0)).toBe(0);
    expect(bucketMultiplier(0.001)).toBe(0.00);
    expect(bucketMultiplier(0.005)).toBe(0.01);
    expect(bucketMultiplier(999999.999)).toBe(1000000.00);
  });

  test('requirement 15.2: ensures 11200.00 and 11200.0000001 map to same bucket', () => {
    const bucket1 = bucketMultiplier(11200.00);
    const bucket2 = bucketMultiplier(11200.0000001);
    expect(bucket1).toBe(bucket2);
    expect(bucket1).toBe(11200.00);
  });
});

describe('computeDistancesNonceAsc', () => {
  test('computes distances correctly for same multiplier hits', () => {
    const bets: Bet[] = [
      { id: 1, nonce: 100, round_result: 400.00 },
      { id: 2, nonce: 150, round_result: 200.00 },
      { id: 3, nonce: 200, round_result: 400.00 },
      { id: 4, nonce: 250, round_result: 400.00 },
    ];

    const distances = computeDistancesNonceAsc(bets);

    expect(distances.get(1)).toBe(null); // First occurrence
    expect(distances.get(2)).toBe(null); // Different multiplier
    expect(distances.get(3)).toBe(100); // 200 - 100
    expect(distances.get(4)).toBe(50);  // 250 - 200
  });

  test('handles unsorted input correctly', () => {
    const bets: Bet[] = [
      { id: 3, nonce: 200, round_result: 400.00 },
      { id: 1, nonce: 100, round_result: 400.00 },
      { id: 4, nonce: 250, round_result: 400.00 },
    ];

    const distances = computeDistancesNonceAsc(bets);

    expect(distances.get(1)).toBe(null); // First occurrence (nonce 100)
    expect(distances.get(3)).toBe(100); // 200 - 100
    expect(distances.get(4)).toBe(50);  // 250 - 200
  });

  test('handles null and undefined multipliers', () => {
    const bets: Bet[] = [
      { id: 1, nonce: 100, round_result: null },
      { id: 2, nonce: 150, round_result: undefined },
      { id: 3, nonce: 200, round_result: 400.00 },
    ];

    const distances = computeDistancesNonceAsc(bets);

    expect(distances.get(1)).toBe(null);
    expect(distances.get(2)).toBe(null);
    expect(distances.get(3)).toBe(null); // First valid occurrence
  });

  test('requirement 15.1: verifies correct distances across range boundaries', () => {
    // Simulate hits across different ranges
    const bets: Bet[] = [
      { id: 1, nonce: 9950, round_result: 11200.00 },  // End of first range
      { id: 2, nonce: 10050, round_result: 11200.00 }, // Start of second range
      { id: 3, nonce: 15000, round_result: 11200.00 }, // Middle of second range
    ];

    const distances = computeDistancesNonceAsc(bets);

    expect(distances.get(1)).toBe(null); // First occurrence
    expect(distances.get(2)).toBe(100);  // 10050 - 9950 (crosses range boundary)
    expect(distances.get(3)).toBe(4950); // 15000 - 10050
  });
});

describe('computeDistancesForHits', () => {
  test('computes distances for HitRecord array', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 3, nonce: 300, bucket: 48800.00, distance_prev: null, date_time: null },
    ];

    const distances = computeDistancesForHits(hits);

    expect(distances.get(1)).toBe(null); // First 11200.00
    expect(distances.get(2)).toBe(100);  // 200 - 100
    expect(distances.get(3)).toBe(null); // First 48800.00
  });

  test('handles bucket normalization', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.0000001, distance_prev: null, date_time: null },
      { id: 2, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    const distances = computeDistancesForHits(hits);

    expect(distances.get(1)).toBe(null); // First occurrence
    expect(distances.get(2)).toBe(100);  // Should recognize as same bucket
  });
});

describe('calculateBucketStats', () => {
  test('calculates accurate statistics', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 3, nonce: 350, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 4, nonce: 500, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    const distanceById = new Map<number, number | null>([
      [1, null],
      [2, 100],
      [3, 150],
      [4, 150],
    ]);

    const stats = calculateBucketStats(hits, distanceById);

    expect(stats.count).toBe(3); // Excluding null distance
    expect(stats.median).toBe(150); // Median of [100, 150, 150]
    expect(stats.mean).toBe(133); // Math.round((100 + 150 + 150) / 3)
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(150);
    expect(stats.method).toBe('exact');
  });

  test('handles empty data', () => {
    const stats = calculateBucketStats([], new Map());

    expect(stats.count).toBe(0);
    expect(stats.median).toBe(null);
    expect(stats.mean).toBe(null);
    expect(stats.min).toBe(null);
    expect(stats.max).toBe(null);
    expect(stats.method).toBe('exact');
  });

  test('handles all null distances', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    const distanceById = new Map<number, number | null>([[1, null]]);
    const stats = calculateBucketStats(hits, distanceById);

    expect(stats.count).toBe(0);
    expect(stats.median).toBe(null);
  });

  test('requirement 15.3: verifies median/mean accuracy against known datasets', () => {
    // Known dataset: distances [50, 100, 150, 200, 250]
    const hits: HitRecord[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      nonce: (i + 1) * 50,
      bucket: 11200.00,
      distance_prev: null,
      date_time: null,
    }));

    const distanceById = new Map<number, number | null>([
      [1, null],
      [2, 50],
      [3, 100],
      [4, 150],
      [5, 200],
    ]);

    const stats = calculateBucketStats(hits, distanceById);

    expect(stats.count).toBe(4);
    expect(stats.median).toBe(125); // Median of [50, 100, 150, 200]
    expect(stats.mean).toBe(125);   // (50 + 100 + 150 + 200) / 4
    expect(stats.min).toBe(50);
    expect(stats.max).toBe(200);
  });
});

describe('filterHitsByRange', () => {
  test('filters hits by nonce range correctly', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 50, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 150, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 3, nonce: 250, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 4, nonce: 350, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    const filtered = filterHitsByRange(hits, [100, 300]);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe(2);
    expect(filtered[1].id).toBe(3);
  });

  test('includes boundary values', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 3, nonce: 300, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    const filtered = filterHitsByRange(hits, [100, 300]);

    expect(filtered).toHaveLength(3);
    expect(filtered.map(h => h.nonce)).toEqual([100, 200, 300]);
  });
});

describe('validateDistanceConsistency', () => {
  test('validates correct distance calculations', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 3, nonce: 350, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    const distanceById = new Map<number, number | null>([
      [1, null],
      [2, 100],
      [3, 150],
    ]);

    expect(validateDistanceConsistency(hits, distanceById)).toBe(true);
  });

  test('detects incorrect distance calculations', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
    ];

    const distanceById = new Map<number, number | null>([
      [1, null],
      [2, 50], // Incorrect: should be 100
    ]);

    expect(validateDistanceConsistency(hits, distanceById)).toBe(false);
  });

  test('handles multiple buckets correctly', () => {
    const hits: HitRecord[] = [
      { id: 1, nonce: 100, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 2, nonce: 150, bucket: 48800.00, distance_prev: null, date_time: null },
      { id: 3, nonce: 200, bucket: 11200.00, distance_prev: null, date_time: null },
      { id: 4, nonce: 250, bucket: 48800.00, distance_prev: null, date_time: null },
    ];

    const distanceById = new Map<number, number | null>([
      [1, null], // First 11200.00
      [2, null], // First 48800.00
      [3, 100],  // 200 - 100 for 11200.00
      [4, 100],  // 250 - 150 for 48800.00
    ]);

    expect(validateDistanceConsistency(hits, distanceById)).toBe(true);
  });
});

describe('medianInt', () => {
  test('calculates median for odd-length arrays', () => {
    expect(medianInt([1, 2, 3])).toBe(2);
    expect(medianInt([5, 1, 3, 9, 7])).toBe(5);
  });

  test('calculates median for even-length arrays', () => {
    expect(medianInt([1, 2, 3, 4])).toBe(3); // Math.round((2 + 3) / 2)
    expect(medianInt([10, 20, 30, 40])).toBe(25);
  });

  test('handles edge cases', () => {
    expect(medianInt([])).toBe(null);
    expect(medianInt([42])).toBe(42);
  });

  test('handles unsorted input', () => {
    expect(medianInt([3, 1, 2])).toBe(2);
    expect(medianInt([40, 10, 30, 20])).toBe(25);
  });
});

describe('getDistancesForMultiplier', () => {
  test('extracts distances for specific multiplier', () => {
    const bets: Bet[] = [
      { id: 1, nonce: 100, round_result: 11200.00 },
      { id: 2, nonce: 150, round_result: 400.00 },
      { id: 3, nonce: 200, round_result: 11200.00 },
    ];

    const distanceById = new Map<Bet["id"], number | null>([
      [1, null],
      [2, null],
      [3, 100],
    ]);

    const distances = getDistancesForMultiplier(bets, distanceById, 11200.00);

    expect(distances).toEqual([100]); // Only non-null distance for 11200.00
  });

  test('handles bucket normalization', () => {
    const bets: Bet[] = [
      { id: 1, nonce: 100, round_result: 11200.0000001 },
      { id: 2, nonce: 200, round_result: 11200.00 },
    ];

    const distanceById = new Map<Bet["id"], number | null>([
      [1, null],
      [2, 100],
    ]);

    const distances = getDistancesForMultiplier(bets, distanceById, 11200.00);

    expect(distances).toEqual([100]);
  });
});

describe('getMultiplierStats', () => {
  test('calculates statistics for specific multiplier', () => {
    const bets: Bet[] = [
      { id: 1, nonce: 100, round_result: 11200.00 },
      { id: 2, nonce: 200, round_result: 11200.00 },
      { id: 3, nonce: 350, round_result: 11200.00 },
      { id: 4, nonce: 500, round_result: 400.00 }, // Different multiplier
    ];

    const distanceById = new Map<Bet["id"], number | null>([
      [1, null],
      [2, 100],
      [3, 150],
      [4, null],
    ]);

    const stats = getMultiplierStats(bets, distanceById, 11200.00);

    expect(stats.count).toBe(2);
    expect(stats.median).toBe(125); // Median of [100, 150]
    expect(stats.mean).toBe(125);   // (100 + 150) / 2
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(150);
  });

  test('handles no hits for multiplier', () => {
    const bets: Bet[] = [
      { id: 1, nonce: 100, round_result: 400.00 },
    ];

    const distanceById = new Map<Bet["id"], number | null>([
      [1, null],
    ]);

    const stats = getMultiplierStats(bets, distanceById, 11200.00);

    expect(stats.count).toBe(0);
    expect(stats.median).toBe(null);
    expect(stats.mean).toBe(null);
    expect(stats.min).toBe(null);
    expect(stats.max).toBe(null);
  });
});

describe('integration tests', () => {
  test('requirement 7.5: identical statistics across different calculation paths', () => {
    // Test that getMultiplierStats and calculateBucketStats produce identical results
    const bets: Bet[] = [
      { id: 1, nonce: 100, round_result: 11200.00 },
      { id: 2, nonce: 200, round_result: 11200.00 },
      { id: 3, nonce: 350, round_result: 11200.00 },
    ];

    const distanceById = computeDistancesNonceAsc(bets);
    
    // Method 1: Using getMultiplierStats
    const stats1 = getMultiplierStats(bets, distanceById, 11200.00);
    
    // Method 2: Using calculateBucketStats with HitRecord conversion
    const hits: HitRecord[] = bets
      .filter(b => bucketMultiplier(b.round_result ?? 0) === 11200.00)
      .map(b => ({
        id: b.id as number,
        nonce: b.nonce,
        bucket: 11200.00,
        distance_prev: null,
        date_time: null,
      }));
    
    const hitDistanceById = new Map<number, number | null>();
    for (const hit of hits) {
      hitDistanceById.set(hit.id, distanceById.get(hit.id) ?? null);
    }
    
    const stats2 = calculateBucketStats(hits, hitDistanceById);
    
    // Both methods should produce identical results
    expect(stats1.count).toBe(stats2.count);
    expect(stats1.median).toBe(stats2.median);
    expect(stats1.mean).toBe(stats2.mean);
    expect(stats1.min).toBe(stats2.min);
    expect(stats1.max).toBe(stats2.max);
  });

  test('requirement 15.5: performance test for large datasets', () => {
    // Generate a large dataset (simulating 70k nonces)
    const largeHits: HitRecord[] = [];
    for (let i = 0; i < 1000; i++) {
      largeHits.push({
        id: i,
        nonce: i * 70, // Spread across 70k nonces
        bucket: 11200.00,
        distance_prev: null,
        date_time: null,
      });
    }

    const startTime = performance.now();
    
    // Test distance computation
    const distances = computeDistancesForHits(largeHits);
    
    // Test statistics calculation
    const stats = calculateBucketStats(largeHits, distances);
    
    // Test validation
    const isValid = validateDistanceConsistency(largeHits, distances);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (< 100ms for 1k hits)
    expect(duration).toBeLessThan(100);
    expect(stats.count).toBe(999); // All but first hit should have distances
    expect(isValid).toBe(true);
  });
});