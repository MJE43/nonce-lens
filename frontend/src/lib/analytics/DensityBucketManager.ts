/**
 * Manages hit density visualization across nonce buckets.
 * Provides efficient incremental updates for sparkline visualization.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

export interface DensityData {
  buckets: Map<number, number>;
  bucketSize: number;
  maxCount: number;
  currentBucket: number;
}

export class DensityBucketManager {
  private buckets: Map<number, number> = new Map();
  private bucketSize: number;
  private maxCount: number = 0;

  constructor(bucketSize: number = 1000) {
    if (bucketSize <= 0) {
      throw new Error('Bucket size must be positive');
    }
    this.bucketSize = bucketSize;
  }

  /**
   * Increment the bucket for a given nonce
   */
  incrementBucket(nonce: number): void {
    const bucketId = Math.floor(nonce / this.bucketSize);
    const currentCount = this.buckets.get(bucketId) || 0;
    const newCount = currentCount + 1;

    this.buckets.set(bucketId, newCount);

    // Update max count
    if (newCount > this.maxCount) {
      this.maxCount = newCount;
    }
  }

  /**
   * Get density data for visualization
   */
  getDensityData(): DensityData {
    return {
      buckets: new Map(this.buckets),
      bucketSize: this.bucketSize,
      maxCount: this.maxCount,
      currentBucket: this.getCurrentBucket()
    };
  }

  /**
   * Get current active bucket (highest bucket ID)
   */
  getCurrentBucket(): number {
    if (this.buckets.size === 0) return 0;
    return Math.max(...Array.from(this.buckets.keys()));
  }

  /**
   * Get count for a specific bucket
   */
  getBucketCount(bucketId: number): number {
    return this.buckets.get(bucketId) || 0;
  }

  /**
   * Get all bucket IDs
   */
  getBucketIds(): number[] {
    return Array.from(this.buckets.keys()).sort((a, b) => a - b);
  }

  /**
   * Get bucket range (min and max nonce values)
   */
  getBucketRange(bucketId: number): { start: number; end: number } {
    return {
      start: bucketId * this.bucketSize,
      end: (bucketId + 1) * this.bucketSize - 1
    };
  }

  /**
   * Get statistics about the density distribution
   */
  getStats(): {
    totalBuckets: number;
    totalHits: number;
    maxCount: number;
    averageHitsPerBucket: number;
    nonEmptyBuckets: number;
  } {
    const totalHits = Array.from(this.buckets.values()).reduce((sum, count) => sum + count, 0);
    const nonEmptyBuckets = this.buckets.size;

    return {
      totalBuckets: this.buckets.size,
      totalHits,
      maxCount: this.maxCount,
      averageHitsPerBucket: nonEmptyBuckets > 0 ? totalHits / nonEmptyBuckets : 0,
      nonEmptyBuckets
    };
  }

  /**
   * Get normalized density data for sparkline (0-1 scale)
   */
  getNormalizedDensity(): Array<{ bucketId: number; normalizedCount: number }> {
    if (this.maxCount === 0) return [];

    return Array.from(this.buckets.entries()).map(([bucketId, count]) => ({
      bucketId,
      normalizedCount: count / this.maxCount
    }));
  }

  /**
   * Clear all buckets
   */
  reset(): void {
    this.buckets.clear();
    this.maxCount = 0;
  }

  /**
   * Update bucket size and reset
   */
  updateBucketSize(newBucketSize: number): void {
    if (newBucketSize <= 0) {
      throw new Error('Bucket size must be positive');
    }
    this.bucketSize = newBucketSize;
    this.reset();
  }

  /**
   * Get bucket size
   */
  get currentBucketSize(): number {
    return this.bucketSize;
  }

  /**
   * Get max count across all buckets
   */
  get currentMaxCount(): number {
    return this.maxCount;
  }
}
