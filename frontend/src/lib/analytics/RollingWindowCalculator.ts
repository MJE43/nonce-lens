/**
 * Rolling window calculator for time-based or count-based statistics.
 * Maintains separate calculations from all-time statistics for regime shift detection.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

export interface RollingStats {
  mean: number;
  max: number;
  hitRate: number; // hits/min
  count: number;
  deviationFromAllTime: number; // z-score
}

export class RollingWindowCalculator {
  private window: Array<{value: number, timestamp: Date}> = [];
  private windowType: 'time' | 'count';
  private windowSize: number;

  constructor(windowType: 'time' | 'count', windowSize: number) {
    this.windowType = windowType;
    this.windowSize = windowSize;
  }

  /**
   * Add a new value to the rolling window
   */
  update(value: number, timestamp: Date = new Date()): void {
    this.window.push({value, timestamp});
    this.pruneWindow(timestamp);
  }

  /**
   * Prune the window based on type and size
   */
  private pruneWindow(currentTime: Date): void {
    if (this.windowType === 'time') {
      // Time-based window: remove items older than windowSize seconds
      const cutoffTime = new Date(currentTime.getTime() - this.windowSize * 1000);
      this.window = this.window.filter(item => item.timestamp >= cutoffTime);
    } else {
      // Count-based window: keep only the last windowSize items
      if (this.window.length > this.windowSize) {
        this.window = this.window.slice(-this.windowSize);
      }
    }
  }

  /**
   * Get current rolling statistics
   */
  getStats(): {mean: number, max: number, count: number} {
    if (this.window.length === 0) {
      return {mean: 0, max: 0, count: 0};
    }

    const values = this.window.map(item => item.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const max = Math.max(...values);

    return {mean, max, count: values.length};
  }

  /**
   * Get hit rate for the rolling window (hits/min)
   */
  getHitRate(): number {
    if (this.window.length === 0) return 0;

    if (this.windowType === 'time') {
      // For time-based windows, hit rate is count / window_duration_minutes
      const windowDurationSeconds = this.windowSize;
      return (this.window.length * 60) / windowDurationSeconds;
    } else {
      // For count-based windows, calculate based on time span of actual data
      if (this.window.length < 2) return 0;

      const oldestTime = this.window[0].timestamp;
      const newestTime = this.window[this.window.length - 1].timestamp;
      const durationSeconds = (newestTime.getTime() - oldestTime.getTime()) / 1000;

      if (durationSeconds <= 0) return 0;
      return (this.window.length * 60) / durationSeconds;
    }
  }

  /**
   * Calculate deviation from all-time statistics
   */
  calculateDeviation(allTimeMean: number, allTimeStddev: number): number {
    const rollingStats = this.getStats();

    if (allTimeStddev <= 0 || rollingStats.count === 0) {
      return 0;
    }

    return (rollingStats.mean - allTimeMean) / allTimeStddev;
  }

  /**
   * Get complete rolling statistics including hit rate and deviation
   */
  getCompleteStats(allTimeMean: number = 0, allTimeStddev: number = 0): RollingStats {
    const basicStats = this.getStats();
    const hitRate = this.getHitRate();
    const deviationFromAllTime = this.calculateDeviation(allTimeMean, allTimeStddev);

    return {
      mean: basicStats.mean,
      max: basicStats.max,
      count: basicStats.count,
      hitRate,
      deviationFromAllTime
    };
  }

  /**
   * Check if rolling statistics show significant deviation
   */
  hasSignificantDeviation(allTimeMean: number, allTimeStddev: number, threshold: number = 2): boolean {
    const deviation = Math.abs(this.calculateDeviation(allTimeMean, allTimeStddev));
    return deviation >= threshold;
  }

  /**
   * Get window configuration
   */
  getConfig(): {type: 'time' | 'count', size: number} {
    return {
      type: this.windowType,
      size: this.windowSize
    };
  }

  /**
   * Update window configuration
   */
  updateConfig(windowType: 'time' | 'count', windowSize: number): void {
    this.windowType = windowType;
    this.windowSize = windowSize;
    // Re-prune with new settings
    if (this.window.length > 0) {
      const latestTime = this.window[this.window.length - 1].timestamp;
      this.pruneWindow(latestTime);
    }
  }

  /**
   * Reset the calculator
   */
  reset(): void {
    this.window = [];
  }

  /**
   * Get raw window data for debugging
   */
  getRawData(): Array<{value: number, timestamp: Date}> {
    return [...this.window];
  }

  /**
   * Get window duration in seconds (for time-based windows or actual data span)
   */
  getWindowDurationSeconds(): number {
    if (this.window.length === 0) return 0;

    if (this.windowType === 'time') {
      return this.windowSize;
    } else {
      // For count-based, return actual time span
      if (this.window.length < 2) return 0;
      const oldestTime = this.window[0].timestamp;
      const newestTime = this.window[this.window.length - 1].timestamp;
      return (newestTime.getTime() - oldestTime.getTime()) / 1000;
    }
  }
}
