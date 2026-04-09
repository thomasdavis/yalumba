/**
 * Detect module boundaries within reads.
 *
 * A boundary is where the local motif composition shifts —
 * indicating a transition between inherited genomic modules.
 * These boundaries are the "symbiogenesis scars" where
 * different inherited systems meet.
 */

import { extractMotifsWithPositions } from "./motif-extractor.js";

/**
 * Detect compositional boundaries in a read.
 * Returns positions where the local motif entropy shifts significantly.
 */
export function detectBoundaries(
  read: string,
  motifK: number = 15,
  windowSize: number = 20,
): number[] {
  const motifs = extractMotifsWithPositions(read, motifK);
  if (motifs.length < windowSize * 2) return [];

  const boundaries: number[] = [];

  // Sliding window entropy comparison
  for (let i = windowSize; i < motifs.length - windowSize; i++) {
    const leftWindow = motifs.slice(i - windowSize, i);
    const rightWindow = motifs.slice(i, i + windowSize);

    const leftEntropy = windowEntropy(leftWindow.map((m) => m.hash));
    const rightEntropy = windowEntropy(rightWindow.map((m) => m.hash));
    const entropyShift = Math.abs(leftEntropy - rightEntropy);

    // Also check composition overlap
    const leftSet = new Set(leftWindow.map((m) => m.hash));
    const rightSet = new Set(rightWindow.map((m) => m.hash));
    let overlap = 0;
    for (const h of leftSet) { if (rightSet.has(h)) overlap++; }
    const jaccard = overlap / (leftSet.size + rightSet.size - overlap);

    // Boundary = high entropy shift AND low composition overlap
    if (entropyShift > 0.5 && jaccard < 0.3) {
      boundaries.push(motifs[i]!.position);
    }
  }

  // Deduplicate nearby boundaries (within 10bp)
  const deduped: number[] = [];
  for (const pos of boundaries) {
    if (deduped.length === 0 || pos - deduped[deduped.length - 1]! > 10) {
      deduped.push(pos);
    }
  }

  return deduped;
}

/**
 * Build a boundary fingerprint for a sample.
 * Returns a histogram of inter-boundary distances.
 */
export function buildBoundaryProfile(
  reads: readonly string[],
  motifK: number = 15,
): number[] {
  const distances: number[] = [];

  for (const read of reads) {
    const bounds = detectBoundaries(read, motifK);
    for (let i = 1; i < bounds.length; i++) {
      distances.push(bounds[i]! - bounds[i - 1]!);
    }
  }

  // Build histogram (buckets of 10bp)
  const maxDist = 200;
  const bucketSize = 10;
  const histogram = new Array(maxDist / bucketSize).fill(0);

  for (const d of distances) {
    const bucket = Math.min(Math.floor(d / bucketSize), histogram.length - 1);
    histogram[bucket]++;
  }

  return histogram;
}

function windowEntropy(hashes: number[]): number {
  const counts = new Map<number, number>();
  for (const h of hashes) {
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / hashes.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}
