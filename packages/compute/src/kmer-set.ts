/**
 * High-level API for native k-mer set operations.
 * Falls back to TypeScript if native library not available.
 */

import type { NativeKmerSet, KmerSetOptions } from "./types.js";
import { isNativeAvailable, getNativeLib } from "./bindings.js";

const DEFAULT_K = 21;

/** Build a k-mer set from an array of read strings */
export function buildKmerSet(
  reads: readonly string[],
  options: KmerSetOptions = {},
): NativeKmerSet {
  const k = options.k ?? DEFAULT_K;
  const filter = options.filterLowComplexity ?? true;

  // TODO: native FFI path for bulk reads requires pointer array marshaling
  // which differs across Bun versions. Using optimized TypeScript for now.
  // The native library is used for run scanning via file-based I/O.
  return buildFallback(reads, k, filter);
}

function buildFallback(reads: readonly string[], k: number, filter: boolean): NativeKmerSet {
  // TypeScript fallback using the same hash function
  const set = new Set<number>();

  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      if (filter && isLowComplexityTS(read, i, k)) continue;
      set.add(canonicalHashTS(read, i, k));
    }
  }

  return {
    _ptr: 0,
    count: set.size,
    free() { /* no-op for JS set */ },
  };
}

// TypeScript hash fallbacks (matching the C implementation)
function fnv1aTS(str: string, offset: number, len: number): number {
  let h = 0x811c9dc5 | 0;
  for (let i = offset; i < offset + len; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function canonicalHashTS(seq: string, offset: number, k: number): number {
  const fwd = fnv1aTS(seq, offset, k);
  let h = 0x811c9dc5 | 0;
  for (let i = offset + k - 1; i >= offset; i--) {
    const c = seq.charCodeAt(i);
    const comp = c === 65 ? 84 : c === 84 ? 65 : c === 67 ? 71 : c === 71 ? 67 : c;
    h ^= comp;
    h = Math.imul(h, 0x01000193);
  }
  return fwd < (h >>> 0) ? fwd : h >>> 0;
}

function isLowComplexityTS(seq: string, offset: number, k: number): boolean {
  const counts = [0, 0, 0, 0];
  for (let i = offset; i < offset + k; i++) {
    const c = seq.charCodeAt(i);
    if (c === 65) counts[0]++;
    else if (c === 67) counts[1]++;
    else if (c === 71) counts[2]++;
    else if (c === 84) counts[3]++;
  }
  if (Math.max(...counts) > k * 0.8) return true;
  let di = 0;
  for (let i = offset + 2; i < offset + k; i++) {
    if (seq.charCodeAt(i) === seq.charCodeAt(i - 2)) di++;
  }
  return di > (k - 2) * 0.6;
}
