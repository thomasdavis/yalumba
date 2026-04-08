import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const kmerSynteny: Experiment = {
  name: "K-mer synteny correlation",
  version: 1,
  description: "Symbiogenesis: positional order of shared k-mers preserved between matched reads",
  maxReadsPerSample: 100_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    // Index B's reads by first k-mer for matching
    const index = new Map<number, number[]>();
    for (let ri = 0; ri < b.reads.length; ri++) {
      const read = b.reads[ri]!;
      if (read.length < k + 10) continue;
      const anchor = canonicalHash(read, 5, k);
      const existing = index.get(anchor);
      if (existing) { if (existing.length < 3) existing.push(ri); }
      else { index.set(anchor, [ri]); }
    }

    let totalCorr = 0;
    let pairCount = 0;

    for (const readA of a.reads) {
      if (readA.length < k + 10) continue;
      const anchor = canonicalHash(readA, 5, k);
      const hits = index.get(anchor);
      if (!hits) continue;

      for (const ri of hits) {
        const readB = b.reads[ri]!;
        // Find shared k-mer positions in both reads
        const posA: number[] = [];
        const posB: number[] = [];
        for (let i = 0; i <= Math.min(readA.length, readB.length) - k; i++) {
          const hA = canonicalHash(readA, i, k);
          const hB = canonicalHash(readB, i, k);
          if (hA === hB) { posA.push(i); posB.push(i); }
        }
        if (posA.length < 3) continue;
        // Spearman rank correlation (positions are already ranks since same read)
        let d2sum = 0;
        for (let i = 0; i < posA.length; i++) {
          const d = posA[i]! - posB[i]!;
          d2sum += d * d;
        }
        const n = posA.length;
        const corr = 1 - (6 * d2sum) / (n * (n * n - 1));
        totalCorr += corr;
        pairCount++;
      }
    }

    const score = pairCount > 0 ? totalCorr / pairCount : 0;
    return { score, detail: `avgCorr=${score.toFixed(6)} pairs=${pairCount.toLocaleString()}` };
  },
};
