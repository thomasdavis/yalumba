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

/** Build a k-mer frequency map from reads */
export function buildKmerFrequencyMap(
  reads: readonly string[],
  k: number,
): Map<number, number> {
  const freq = new Map<number, number>();
  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      const h = canonicalHash(read, i, k);
      freq.set(h, (freq.get(h) ?? 0) + 1);
    }
  }
  return freq;
}
