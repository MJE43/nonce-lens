import { describe, it, expect, beforeEach } from 'vitest';
import { WelfordCalculator } from '../../lib/analytics/WelfordCalculator';

describe('WelfordCalculator', () => {
  let calculator: WelfordCalculator;

  beforeEach(() => {
    calculator = new WelfordCalculator();
  });

  it('should initialize with zero values', () => {
    const stats = calculator.stats;
    expect(stats.count).toBe(0);
    expect(stats.mean).toBe(0);
    expect(stats.variance).toBe(0);
    expect(stats.stddev).toBe(0);
  });

  it('should handle single value correctly', () => {
    calculator.update(5);
    const stats = calculator.stats;
    
    expect(stats.count).toBe(1);
    expect(stats.mean).toBe(5);
    expect(stats.variance).toBe(0);
    expect(stats.stddev).toBe(0);
  });

  it('should calculate mean correctly for multiple values', () => {
    const values = [1, 2, 3, 4, 5];
    values.forEach(val => calculator.update(val));
    
    const stats = calculator.stats;
    expect(stats.count).toBe(5);
    expect(stats.mean).toBe(3); // (1+2+3+4+5)/5 = 3
  });

  it('should calculate standard deviation correctly', () => {
    // Using values with known standard deviation
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    values.forEach(val => calculator.update(val));
    
    const stats = calculator.stats;
    expect(stats.count).toBe(8);
    expect(stats.mean).toBe(5); // 40/8 = 5
    expect(stats.stddev).toBeCloseTo(2.138, 2); // Actual stddev ≈ 2.138
  });

  it('should reset correctly', () => {
    calculator.update(10);
    calculator.update(20);
    calculator.reset();
    
    const stats = calculator.stats;
    expect(stats.count).toBe(0);
    expect(stats.mean).toBe(0);
    expect(stats.variance).toBe(0);
    expect(stats.stddev).toBe(0);
  });

  it('should provide individual getters', () => {
    calculator.update(10);
    calculator.update(20);
    
    expect(calculator.count).toBe(2);
    expect(calculator.currentMean).toBe(15);
    expect(calculator.currentStddev).toBeCloseTo(7.07, 2);
  });
});