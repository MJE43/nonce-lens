/**
 * Fixed-size ring buffer for efficient gap tracking.
 * Maintains the last K values without dynamic memory allocation.
 *
 * Requirements: 9.3
 */

export class RingBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private size: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Ring buffer capacity must be positive');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item to the buffer
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  /**
   * Get all items in insertion order (oldest to newest)
   */
  toArray(): T[] {
    if (this.size === 0) return [];

    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head - this.size + i + this.capacity) % this.capacity;
      result.push(this.buffer[index]);
    }
    return result;
  }

  /**
   * Get the most recent item
   */
  getLatest(): T | undefined {
    if (this.size === 0) return undefined;
    const latestIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIndex];
  }

  /**
   * Get the oldest item
   */
  getOldest(): T | undefined {
    if (this.size === 0) return undefined;
    const oldestIndex = (this.head - this.size + this.capacity) % this.capacity;
    return this.buffer[oldestIndex];
  }

  /**
   * Get item at specific index (0 = oldest, length-1 = newest)
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.size) return undefined;
    const bufferIndex = (this.head - this.size + index + this.capacity) % this.capacity;
    return this.buffer[bufferIndex];
  }

  /**
   * Get current number of items in buffer
   */
  get length(): number {
    return this.size;
  }

  /**
   * Get maximum capacity
   */
  get maxCapacity(): number {
    return this.capacity;
  }

  /**
   * Check if buffer is full
   */
  get isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  get isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Clear all items from buffer
   */
  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  /**
   * Convert to JSON-serializable array
   */
  toJSON(): T[] {
    return this.toArray();
  }
}
