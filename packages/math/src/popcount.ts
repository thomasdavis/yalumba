/**
 * Population count (Hamming weight) utilities for packed data.
 * Operates on typed arrays for bulk operations.
 */
export class PopCount {
  /** Count set bits in a Uint32Array */
  static count32(data: Uint32Array): number {
    let total = 0;
    for (let i = 0; i < data.length; i++) {
      total += popcount32(data[i]!);
    }
    return total;
  }

  /** Count differing bits between two Uint32Arrays (Hamming distance) */
  static hammingDistance(a: Uint32Array, b: Uint32Array): number {
    const len = Math.min(a.length, b.length);
    let distance = 0;
    for (let i = 0; i < len; i++) {
      distance += popcount32(a[i]! ^ b[i]!);
    }
    return distance;
  }

  /** Count matching bits between two Uint32Arrays */
  static matchingBits(a: Uint32Array, b: Uint32Array): number {
    const len = Math.min(a.length, b.length);
    let count = 0;
    for (let i = 0; i < len; i++) {
      count += popcount32(~(a[i]! ^ b[i]!));
    }
    return count;
  }
}

function popcount32(x: number): number {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >> 24;
}
