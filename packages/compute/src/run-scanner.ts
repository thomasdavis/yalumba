/**
 * High-level API for native run scanning.
 */

import type { RunScanResult, RunStatistics, RunScanOptions } from "./types.js";

/** Compute statistics from a run scan result */
export function computeRunStatistics(result: RunScanResult): RunStatistics {
  const { runLengths, totalShared, totalScanned } = result;

  if (runLengths.length === 0) {
    return { mean: 0, p50: 0, p90: 0, p95: 0, max: 0, entropy: 0, count: 0, totalShared: 0, ibdFraction: 0 };
  }

  const sorted = [...runLengths].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  const p50 = sorted[Math.floor(n * 0.5)]!;
  const p90 = sorted[Math.floor(n * 0.9)]!;
  const p95 = sorted[Math.floor(n * 0.95)]!;
  const max = sorted[n - 1]!;

  // Entropy of run-length distribution
  const freqs = new Map<number, number>();
  for (const len of runLengths) {
    freqs.set(len, (freqs.get(len) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freqs.values()) {
    const p = count / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  const ibdFraction = totalScanned > 0 ? totalShared / totalScanned : 0;

  return { mean, p50, p90, p95, max, entropy, count: n, totalShared, ibdFraction };
}

/** Scan reads for rare shared k-mer runs (pure TypeScript implementation) */
export function scanRareRuns(
  reads: readonly string[],
  targetSet: Set<number>,
  rareSet: Set<number> | null,
  k: number = 21,
): RunScanResult {
  const runLengths: number[] = [];
  let totalShared = 0;
  let totalScanned = 0;

  for (const read of reads) {
    let run = 0;
    for (let i = 0; i <= read.length - k; i++) {
      totalScanned++;
      const h = canonicalHashTS(read, i, k);
      const passesFilter = rareSet === null || rareSet.has(h);
      if (passesFilter && targetSet.has(h)) {
        run++;
        totalShared++;
      } else {
        if (run > 0) { runLengths.push(run); run = 0; }
      }
    }
    if (run > 0) runLengths.push(run);
  }

  return { runLengths, numRuns: runLengths.length, totalShared, totalScanned };
}

function canonicalHashTS(seq: string, offset: number, k: number): number {
  let fwd = 0x811c9dc5 | 0;
  for (let i = offset; i < offset + k; i++) {
    fwd ^= seq.charCodeAt(i);
    fwd = Math.imul(fwd, 0x01000193);
  }
  fwd = fwd >>> 0;
  let rev = 0x811c9dc5 | 0;
  for (let i = offset + k - 1; i >= offset; i--) {
    const c = seq.charCodeAt(i);
    const comp = c === 65 ? 84 : c === 84 ? 65 : c === 67 ? 71 : c === 71 ? 67 : c;
    rev ^= comp;
    rev = Math.imul(rev, 0x01000193);
  }
  rev = rev >>> 0;
  return fwd < rev ? fwd : rev;
}
