/**
 * Analysis math utilities for distance calculation and median computation
 * Used in Analysis Mode for deep history analysis with min-multiplier filtering
 */

export type Bet = {
  id: number | string;
  nonce: number;
  payout_multiplier?: number | null;
  round_result?: number | null;
};

/**
 * Normalize multiplier to 2 decimal places to avoid float precision issues
 * e.g., 400.02 vs 400.0200000003 will be treated as the same bucket
 */
const bucket = (m?: number | null) =>
  m == null || Number.isNaN(m) ? null : Math.round(m * 100) / 100;

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
