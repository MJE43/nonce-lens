/**
 * Welford's online algorithm for calculating mean and variance incrementally.
 * This is numerically stable and memory efficient.
 *
 * Requirements: 9.1
 */

export interface WelfordStats {
  count: number;
  mean: number;
  variance: number;
  stddev: number;
}

export class WelfordCalculator {
  private n = 0;
  private mean = 0;
  private m2 = 0;

  /**
   * Add a new value to the calculation
   */
  update(value: number): void {
    this.n += 1;
    const delta = value - this.mean;
    this.mean += delta / this.n;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  /**
   * Get current statistics
   */
  get stats(): WelfordStats {
    return {
      count: this.n,
      mean: this.mean,
      variance: this.n > 1 ? this.m2 / (this.n - 1) : 0,
      stddev: this.n > 1 ? Math.sqrt(this.m2 / (this.n - 1)) : 0
    };
  }

  /**
   * Get current count
   */
  get count(): number {
    return this.n;
  }

  /**
   * Get current mean
   */
  get currentMean(): number {
    return this.mean;
  }

  /**
   * Get current variance
   */
  get variance(): number {
    return this.n > 1 ? this.m2 / (this.n - 1) : 0;
  }

  /**
   * Get current standard deviation
   */
  get stddev(): number {
    return this.n > 1 ? Math.sqrt(this.m2 / (this.n - 1)) : 0;
  }

  /**
   * Reset the calculator
   */
  reset(): void {
    this.n = 0;
    this.mean = 0;
    this.m2 = 0;
  }
}
