import { describe, it, expect, beforeEach } from 'vitest';
import { HistogramQuantileEstimator } from '../../lib/analytics/HistogramQuantileEstimator';

describe('HistogramQuantileEstimator', () => {
  let estimator: HistogramQuantileEstimator;

  beforeEach(() => {
    estimator = new HistogramQuantileEstimator(0, 100);
  });

  it('should initialize with zero count', () => {
    expect(estimator.count).toBe(0);
    expect(estimator.p90).toBe(0); // Returns minValue when no data
    expect(estimator.p99).toBe(0);
  });

  it('should handle single value', () => {
    estimator.update(50);
    expect(estimator.count).toBe(1);
    expect(estimator.getQuantile(0.5)).toBeCloseTo(50, -1); // Should be within 1 unit of 50
  });

  it('should approximate quantiles correctly for uniform distribution', () => {
    // Add values uniformly distributed from 0 to 100
    for (let i = 0; i <= 100; i++) {
      estimator.update(i);
    }
    
    expect(estimator.count).toBe(101);
    
    // For uniform distribution, p90 should be around 90
    const p90 = estimator.p90;
    expect(p90).toBeGreaterThan(85);
    expect(p90).toBeLessThan(95);
    
    // p99 should be around 99
    const p99 = estimator.p99;
    expect(p99).toBeGreaterThan(95);
    expect(p99).toBeLessThan(100);
  });

  it('should handle values outside range by clamping', () => {
    estimator.update(-10); // Below min
    estimator.update(150); // Above max
    
    expect(estimator.count).toBe(2);
    
    // Both values should be clamped to range boundaries
    const p50 = estimator.getQuantile(0.5);
    expect(p50).toBeGreaterThanOrEqual(0);
    expect(p50).toBeLessThanOrEqual(100);
  });

  it('should reset correctly', () => {
    estimator.update(50);
    estimator.update(75);
    estimator.reset();
    
    expect(estimator.count).toBe(0);
    expect(estimator.p90).toBe(0);
  });

  it('should adjust range and reset data', () => {
    estimator.update(50);
    expect(estimator.count).toBe(1);
    
    estimator.adjustRange(0, 200);
    expect(estimator.count).toBe(0); // Should reset when range changes significantly
  });

  it('should provide histogram stats', () => {
    estimator.update(25);
    estimator.update(75);
    
    const stats = estimator.getHistogramStats();
    expect(stats.minValue).toBe(0);
    expect(stats.maxValue).toBe(100);
    expect(stats.totalCount).toBe(2);
    expect(stats.bins).toHaveLength(64);
  });

  it('should handle edge case quantiles', () => {
    for (let i = 1; i <= 10; i++) {
      estimator.update(i * 10);
    }
    
    expect(estimator.getQuantile(0)).toBe(0); // Should return minValue
    expect(estimator.getQuantile(1)).toBe(100); // Should return maxValue
    expect(estimator.getQuantile(-0.1)).toBe(0); // Should clamp to 0
    expect(estimator.getQuantile(1.1)).toBe(100); // Should clamp to 1
  });
});