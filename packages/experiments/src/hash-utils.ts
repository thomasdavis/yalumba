// Re-export compute package utilities for algorithms that want them
export { computeRunStatistics, scanRareRuns } from "@yalumba/compute";
export type { RunScanResult, RunStatistics } from "@yalumba/compute";

/** Fast FNV-1a hash for k-mer strings — returns 32-bit unsigned integer */
export function fastHash(str: string, offset: number, len: number): number {
  let h = 0x811c9dc5 | 0;
  for (let i = offset; i < offset + len; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Canonical k-mer hash: min(forward_hash, reverse_complement_hash) */
export function canonicalHash(seq: string, offset: number, k: number): number {
  const fwd = fastHash(seq, offset, k);
  let h = 0x811c9dc5 | 0;
  for (let i = offset + k - 1; i >= offset; i--) {
    const c = seq.charCodeAt(i);
    const comp = c === 65 ? 84 : c === 84 ? 65 : c === 67 ? 71 : c === 71 ? 67 : c;
    h ^= comp;
    h = Math.imul(h, 0x01000193);
  }
  const rev = h >>> 0;
  return fwd < rev ? fwd : rev;
}

/**
 * Check if a k-mer is low-complexity (repetitive).
 * Detects homopolymers (AAAA), dinucleotide repeats (ATAT), etc.
 */
export function isLowComplexity(seq: string, offset: number, k: number): boolean {
  // Check: dominated by a single base (>80%)
  const counts = [0, 0, 0, 0]; // A, C, G, T
  for (let i = offset; i < offset + k; i++) {
    const c = seq.charCodeAt(i);
    if (c === 65) counts[0]++;
    else if (c === 67) counts[1]++;
    else if (c === 71) counts[2]++;
    else if (c === 84) counts[3]++;
  }
  const max = Math.max(counts[0]!, counts[1]!, counts[2]!, counts[3]!);
  if (max > k * 0.8) return true;

  // Check: dinucleotide repeat (>60% of positions follow a 2-base pattern)
  let diRepeat = 0;
  for (let i = offset + 2; i < offset + k; i++) {
    if (seq.charCodeAt(i) === seq.charCodeAt(i - 2)) diRepeat++;
  }
  if (diRepeat > (k - 2) * 0.6) return true;

  return false;
}

/** Build a k-mer frequency map from reads (filters low-complexity by default) */
export function buildKmerFrequencyMap(
  reads: readonly string[],
  k: number,
  filterLowComplexity: boolean = true,
): Map<number, number> {
  const freq = new Map<number, number>();
  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      if (filterLowComplexity && isLowComplexity(read, i, k)) continue;
      const h = canonicalHash(read, i, k);
      freq.set(h, (freq.get(h) ?? 0) + 1);
    }
  }
  return freq;
}

/** Build a k-mer set from reads (filters low-complexity) */
export function buildKmerSet(
  reads: readonly string[],
  k: number,
  filterLowComplexity: boolean = true,
): Set<number> {
  const kmers = new Set<number>();
  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      if (filterLowComplexity && isLowComplexity(read, i, k)) continue;
      kmers.add(canonicalHash(read, i, k));
    }
  }
  return kmers;
}
