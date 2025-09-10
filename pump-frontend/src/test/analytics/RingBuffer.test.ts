import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from '../../lib/analytics/RingBuffer';

describe('RingBuffer', () => {
  let buffer: RingBuffer<number>;

  beforeEach(() => {
    buffer = new RingBuffer<number>(3);
  });

  it('should initialize empty', () => {
    expect(buffer.length).toBe(0);
    expect(buffer.maxCapacity).toBe(3);
    expect(buffer.isEmpty).toBe(true);
    expect(buffer.isFull).toBe(false);
    expect(buffer.toArray()).toEqual([]);
  });

  it('should add items correctly', () => {
    buffer.push(1);
    expect(buffer.length).toBe(1);
    expect(buffer.isEmpty).toBe(false);
    expect(buffer.toArray()).toEqual([1]);
    expect(buffer.peek()).toBe(1);
  });

  it('should maintain order when not full', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    
    expect(buffer.length).toBe(3);
    expect(buffer.isFull).toBe(true);
    expect(buffer.toArray()).toEqual([1, 2, 3]);
    expect(buffer.peek()).toBe(3);
  });

  it('should overwrite oldest when full', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4); // Should overwrite 1
    
    expect(buffer.length).toBe(3);
    expect(buffer.toArray()).toEqual([2, 3, 4]);
    expect(buffer.peek()).toBe(4);
  });

  it('should continue overwriting in circular fashion', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);
    buffer.push(5);
    buffer.push(6);
    
    expect(buffer.length).toBe(3);
    expect(buffer.toArray()).toEqual([4, 5, 6]);
    expect(buffer.peek()).toBe(6);
  });

  it('should get items by index correctly', () => {
    buffer.push(10);
    buffer.push(20);
    buffer.push(30);
    
    expect(buffer.get(0)).toBe(10); // Oldest
    expect(buffer.get(1)).toBe(20);
    expect(buffer.get(2)).toBe(30); // Newest
    expect(buffer.get(3)).toBeUndefined(); // Out of bounds
    expect(buffer.get(-1)).toBeUndefined(); // Out of bounds
  });

  it('should get items by index after wraparound', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4); // Overwrites 1
    
    expect(buffer.get(0)).toBe(2); // Now oldest
    expect(buffer.get(1)).toBe(3);
    expect(buffer.get(2)).toBe(4); // Newest
  });

  it('should clear correctly', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.clear();
    
    expect(buffer.length).toBe(0);
    expect(buffer.isEmpty).toBe(true);
    expect(buffer.isFull).toBe(false);
    expect(buffer.toArray()).toEqual([]);
    expect(buffer.peek()).toBeUndefined();
  });

  it('should calculate stats for numeric values', () => {
    buffer.push(10);
    buffer.push(20);
    buffer.push(30);
    
    const stats = buffer.getStats();
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(10);
    expect(stats!.max).toBe(30);
    expect(stats!.mean).toBe(20);
    expect(stats!.count).toBe(3);
  });

  it('should return null stats when empty', () => {
    const stats = buffer.getStats();
    expect(stats).toBeNull();
  });

  it('should work with different data types', () => {
    const stringBuffer = new RingBuffer<string>(2);
    stringBuffer.push('hello');
    stringBuffer.push('world');
    stringBuffer.push('test');
    
    expect(stringBuffer.toArray()).toEqual(['world', 'test']);
    expect(stringBuffer.peek()).toBe('test');
  });
});