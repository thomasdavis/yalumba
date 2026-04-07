/**
 * Reusable buffer pool to reduce GC pressure when processing large files.
 * Pre-allocates buffers and recycles them.
 */
export class BufferPool {
  private readonly bufferSize: number;
  private readonly pool: Uint8Array[] = [];
  private readonly maxPoolSize: number;

  constructor(bufferSize: number, maxPoolSize: number = 32) {
    this.bufferSize = bufferSize;
    this.maxPoolSize = maxPoolSize;
  }

  /** Acquire a buffer from the pool (or allocate a new one) */
  acquire(): Uint8Array {
    return this.pool.pop() ?? new Uint8Array(this.bufferSize);
  }

  /** Return a buffer to the pool for reuse */
  release(buffer: Uint8Array): void {
    if (buffer.length === this.bufferSize && this.pool.length < this.maxPoolSize) {
      buffer.fill(0);
      this.pool.push(buffer);
    }
  }

  /** Number of buffers currently in the pool */
  get available(): number {
    return this.pool.length;
  }

  /** Clear all pooled buffers */
  drain(): void {
    this.pool.length = 0;
  }
}
