/**
 * Fixed-bin histogram for approximating quantiles incrementally.
 * Uses 64 bins for efficient memory usage while maintaining reasonable accuracy.
 *
 * Requirements: 9.2
 */

export class HistogramQuantileEstimator {
  private bins: number[] = new Array(64).fill(0);
  private binWidth: number;
  private minValue: number;
  private maxValue: number;
  private totalCount: number = 0;

  constructor(minValue: number, maxValue: number) {
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.binWidth = (maxValue - minValue) / 64;
  }

  /**
   * Add a value to the histogram
   */
  update(value: number): void {
    // Clamp value to range
    const clampedValue = Math.max(this.minValue, Math.min(this.maxValue, value));

    // Calculate bin index
    const binIndex = Math.min(63, Math.floor((clampedValue - this.minValue) / this.binWidth));

    this.bins[binIndex]++;
    this.totalCount++;
  }

  /**
   * Get approximate quantile (0 to 1)
   */
  getQuantile(q: number): number {
    if (this.totalCount === 0) {
      return this.minValue;
    }

    const targetCount = this.totalCount * q;
    let cumulativeCount = 0;

    for (let i = 0; i < this.bins.length; i++) {
      cumulativeCount += this.bins[i];
      if (cumulativeCount >= targetCount) {
        // Return midpoint of bin
        return this.minValue + (i + 0.5) * this.binWidth;
      }
    }

    return this.maxValue;
  }

  /**
   * Get P90 approximation
   */
  get p90(): number {
    return this.getQuantile(0.90);
  }

  /**
   * Get P99 approximation
   */
  get p99(): number {
    return this.getQuantile(0.99);
  }

  /**
   * Get total count of values added
   */
  get count(): number {
    return this.totalCount;
  }

  /**
   * Reset the histogram
   */
  reset(): void {
    this.bins.fill(0);
    this.totalCount = 0;
  }

  /**
   * Update the range and reset
   */
  updateRange(minValue: number, maxValue: number): void {
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.binWidth = (maxValue - minValue) / 64;
    this.reset();
  }

  /**
   * Get histogram data for visualization
   */
  getBins(): { binStart: number; binEnd: number; count: number }[] {
    return this.bins.map((count, index) => ({
      binStart: this.minValue + index * this.binWidth,
      binEnd: this.minValue + (index + 1) * this.binWidth,
      count
    }));
  }
}
