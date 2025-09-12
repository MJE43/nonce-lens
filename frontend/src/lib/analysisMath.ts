/**
 * Shared analysis engine for hit-centric analysis pipeline
 * Provides consistent calculations between different UI components
 * Used in Analysis Mode for deep history analysis with min-multiplier filtering
 */

export type Bet = {
  id: number | string;
  nonce: number;
  payout_multiplier?: number | null;
  round_result?: number | null;
};

export interface HitRecord {
  id: number;
  nonce: number;
  bucket: number;
  distance_prev: number | null;
  date_time: string | null;
}

export interface BucketStats {
  count: number;
  median: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  method: 'exact' | 'approximate';
}

/**
 * Normalize multiplier to 2 decimal places to avoid float precision issues
 * e.g., 400.02 vs 400.0200000003 will be treated as the same bucket
 * Requirement 7.2: Consistently use Math.round(multiplier * 100) / 100 everywhere
 */
export function bucketMultiplier(multiplier: number): number {
  return Math.round(multiplier * 100) / 100;
}

/**
 * Internal helper for backward compatibility
 */
const bucket = (m?: number | null) =>
  m == null || Number.isNaN(m) ? null : bucketMultiplier(m);

/**
 * Compute distances for same-multiplier hits in chronological order (nonce ASC)
 * Returns a map of bet ID to distance from previous hit of same multiplier
 */
export function computeDistancesNonceAsc(bets: Bet[]) {
  const asc = [...bets].sort((a, b) => a.nonce - b.nonce);
  const lastNonceByBucket = new Map<number, number>();
  const distanceById = new Map<Bet["id"], number | null>();

  for (const b of asc) {
    const m = bucket(b.round_result ?? b.payout_multiplier);
    if (m == null) {
      distanceById.set(b.id, null);
      continue;
    }
    const prev = lastNonceByBucket.get(m);
    distanceById.set(b.id, prev == null ? null : b.nonce - prev);
    lastNonceByBucket.set(m, b.nonce);
  }
  return distanceById;
}

/**
 * Calculate median of an array of integers
 * For ≤10k values, this is fast and simple
 */
export function medianInt(values: number[]): number | null {
  if (values.length === 0) return null;
  const arr = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

/**
 * Get distances for a specific multiplier bucket
 * Used for focused multiplier analysis
 */
export function getDistancesForMultiplier(
  bets: Bet[],
  distanceById: Map<Bet["id"], number | null>,
  targetMultiplier: number
): number[] {
  const targetBucket = Math.round(targetMultiplier * 100) / 100;
  const distances: number[] = [];

  for (const bet of bets) {
    const betBucket = bucket(bet.round_result ?? bet.payout_multiplier);
    if (betBucket === targetBucket) {
      const distance = distanceById.get(bet.id);
      if (typeof distance === "number") {
        distances.push(distance);
      }
    }
  }

  return distances;
}

/**
 * Get multiplier statistics for a focused multiplier
 */
export function getMultiplierStats(
  bets: Bet[],
  distanceById: Map<Bet["id"], number | null>,
  targetMultiplier: number
) {
  const distances = getDistancesForMultiplier(
    bets,
    distanceById,
    targetMultiplier
  );

  if (distances.length === 0) {
    return {
      count: 0,
      median: null,
      min: null,
      max: null,
      mean: null,
    };
  }

  const sorted = [...distances].sort((a, b) => a - b);
  const sum = distances.reduce((a, b) => a + b, 0);

  return {
    count: distances.length,
    median: medianInt(distances),
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    mean: Math.round(sum / distances.length),
  };
}

/**
 * Calculate bucket statistics for hit records with distances
 * Requirement 7.1: Single analysisMath.ts engine for all calculations
 */
export function calculateBucketStats(
  hits: HitRecord[],
  distanceById: Map<number, number | null>
): BucketStats {
  const distances: number[] = [];
  
  for (const hit of hits) {
    const distance = distanceById.get(hit.id);
    if (typeof distance === 'number') {
      distances.push(distance);
    }
  }

  if (distances.length === 0) {
    return {
      count: 0,
      median: null,
      mean: null,
      min: null,
      max: null,
      method: 'exact'
    };
  }

  const sorted = [...distances].sort((a, b) => a - b);
  const sum = distances.reduce((a, b) => a + b, 0);

  return {
    count: distances.length,
    median: medianInt(distances),
    mean: Math.round(sum / distances.length),
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    method: 'exact'
  };
}

/**
 * Filter hits by nonce range
 * Requirement 7.1: Single analysisMath.ts engine for all calculations
 */
export function filterHitsByRange(
  hits: HitRecord[],
  range: [number, number]
): HitRecord[] {
  const [start, end] = range;
  return hits.filter(hit => hit.nonce >= start && hit.nonce <= end);
}

/**
 * Validate distance calculation consistency
 * Requirement 15.1: Verify correct distances across range boundaries
 */
export function validateDistanceConsistency(
  hits: HitRecord[],
  distanceById: Map<number, number | null>
): boolean {
  // Sort hits by nonce to validate chronological order
  const sortedHits = [...hits].sort((a, b) => a.nonce - b.nonce);
  
  // Group by bucket for validation
  const hitsByBucket = new Map<number, HitRecord[]>();
  for (const hit of sortedHits) {
    const bucket = bucketMultiplier(hit.bucket);
    if (!hitsByBucket.has(bucket)) {
      hitsByBucket.set(bucket, []);
    }
    hitsByBucket.get(bucket)!.push(hit);
  }

  // Validate distances within each bucket
  for (const [bucket, bucketHits] of hitsByBucket) {
    for (let i = 0; i < bucketHits.length; i++) {
      const hit = bucketHits[i];
      const expectedDistance = i === 0 ? null : hit.nonce - bucketHits[i - 1].nonce;
      const actualDistance = distanceById.get(hit.id);
      
      if (expectedDistance !== actualDistance) {
        console.warn(`Distance mismatch for hit ${hit.id}: expected ${expectedDistance}, got ${actualDistance}`);
        return false;
      }
    }
  }

  return true;
}

/**
 * Compute distances for HitRecord array (overload for hit-centric analysis)
 * Requirement 7.1: Single analysisMath.ts engine for all calculations
 */
export function computeDistancesForHits(hits: HitRecord[]): Map<number, number | null> {
  const asc = [...hits].sort((a, b) => a.nonce - b.nonce);
  const lastNonceByBucket = new Map<number, number>();
  const distanceById = new Map<number, number | null>();

  for (const hit of asc) {
    const bucket = bucketMultiplier(hit.bucket);
    const prev = lastNonceByBucket.get(bucket);
    distanceById.set(hit.id, prev == null ? null : hit.nonce - prev);
    lastNonceByBucket.set(bucket, hit.nonce);
  }
  
  return distanceById;
}
