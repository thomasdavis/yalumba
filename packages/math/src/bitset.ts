/**
 * Compact bitset backed by Uint32Array.
 * Useful for tracking base positions, N-masks, match vectors, etc.
 */
export class BitSet {
  private readonly data: Uint32Array;
  readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.data = new Uint32Array(Math.ceil(size / 32));
  }

  /** Set a bit at the given position */
  set(pos: number): void {
    const word = pos >>> 5;
    const bit = pos & 31;
    this.data[word]! |= 1 << bit;
  }

  /** Clear a bit at the given position */
  clear(pos: number): void {
    const word = pos >>> 5;
    const bit = pos & 31;
    this.data[word]! &= ~(1 << bit);
  }

  /** Test whether a bit is set */
  get(pos: number): boolean {
    const word = pos >>> 5;
    const bit = pos & 31;
    return (this.data[word]! & (1 << bit)) !== 0;
  }

  /** Count the number of set bits */
  popcount(): number {
    let count = 0;
    for (let i = 0; i < this.data.length; i++) {
      count += popcount32(this.data[i]!);
    }
    return count;
  }

  /** Compute AND of this bitset with another */
  and(other: BitSet): BitSet {
    const result = new BitSet(Math.min(this.size, other.size));
    const len = Math.min(this.data.length, other.data.length);
    for (let i = 0; i < len; i++) {
      result.data[i] = this.data[i]! & other.data[i]!;
    }
    return result;
  }

  /** Compute OR of this bitset with another */
  or(other: BitSet): BitSet {
    const result = new BitSet(Math.max(this.size, other.size));
    for (let i = 0; i < this.data.length; i++) {
      result.data[i] = this.data[i]!;
    }
    for (let i = 0; i < other.data.length; i++) {
      result.data[i]! |= other.data[i]!;
    }
    return result;
  }

  /** Compute XOR of this bitset with another */
  xor(other: BitSet): BitSet {
    const result = new BitSet(Math.max(this.size, other.size));
    const len = Math.max(this.data.length, other.data.length);
    for (let i = 0; i < len; i++) {
      result.data[i] = (this.data[i] ?? 0) ^ (other.data[i] ?? 0);
    }
    return result;
  }

  /** Get the raw backing buffer */
  buffer(): Uint32Array {
    return this.data;
  }
}

/** Hamming weight of a 32-bit integer */
function popcount32(x: number): number {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >> 24;
}
