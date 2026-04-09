import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** Compare repeat module copy-number-like abundance profiles */
export const moduleCopyNumber: Experiment = {
  name: "Module copy-number spectrum",
  version: 1,
  description: "SV ecology: cosine similarity of k-mer recurrence depth profiles — copy number proxy",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    // Build frequency-of-frequency (copy number spectrum) for each sample
    const spectra = new Map<string, Map<number, number>>();

    for (const s of samples) {
      const freq = new Map<number, number>();
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          freq.set(h, (freq.get(h) ?? 0) + 1);
        }
      }
      // Frequency of frequencies: how many k-mers appear 1x, 2x, 3x...
      const fof = new Map<number, number>();
      for (const count of freq.values()) {
        const bucket = Math.min(count, 50); // Cap at 50
        fof.set(bucket, (fof.get(bucket) ?? 0) + 1);
      }
      spectra.set(s.id, fof);
    }

    return spectra;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const spectra = context as Map<string, Map<number, number>>;
    const spA = spectra.get(a.id)!;
    const spB = spectra.get(b.id)!;

    // Cosine similarity of frequency-of-frequency spectra
    let dot = 0, normA = 0, normB = 0;
    const allBuckets = new Set([...spA.keys(), ...spB.keys()]);
    for (const bucket of allBuckets) {
      const va = spA.get(bucket) ?? 0;
      const vb = spB.get(bucket) ?? 0;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const cosine = denom > 0 ? dot / denom : 0;

    return {
      score: cosine,
      detail: `cosine=${cosine.toFixed(6)} bucketsA=${spA.size} bucketsB=${spB.size}`,
    };
  },
};
