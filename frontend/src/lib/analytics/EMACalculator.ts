/**
 * Exponential Moving Average (EMA) calculator for real-time statistics.
 * Uses alpha parameter for configurable time window sensitivity.
 *
 * Requirements: 1.5
 */

export class EMACalculator {
  private ema: number = 0;
  private alpha: number;
  private initialized: boolean = false;

  /**
   * Create EMA calculator with specified window
   * @param windowSeconds Time window for the EMA (default 30 seconds)
   */
  constructor(windowSeconds: number = 30) {
    // Alpha = 2 / (1 + N) where N is the number of periods
    this.alpha = 2 / (1 + windowSeconds);
  }

  /**
   * Update the EMA with a new value
   * @param value New value to incorporate
   * @returns Current EMA value
   */
  update(value: number): number {
    if (!this.initialized) {
      this.ema = value;
      this.initialized = true;
    } else {
      this.ema = this.alpha * value + (1 - this.alpha) * this.ema;
    }
    return this.ema;
  }

  /**
   * Get current EMA value
   */
  get value(): number {
    return this.ema;
  }

  /**
   * Check if EMA has been initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the alpha parameter
   */
  get alphaValue(): number {
    return this.alpha;
  }

  /**
   * Reset the calculator
   */
  reset(): void {
    this.ema = 0;
    this.initialized = false;
  }

  /**
   * Update the window size and reset
   */
  updateWindow(windowSeconds: number): void {
    this.alpha = 2 / (1 + windowSeconds);
    this.reset();
  }
}
