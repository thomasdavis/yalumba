import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** Cosine similarity restricted to rare k-mers — filters population baseline */
export const rareEcosystemCosine: Experiment = {
  name: "Rare ecosystem cosine",
  version: 1,
  description: "Cosine similarity of k-mer frequencies, restricted to rare k-mers (<50% of samples)",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    const samplePresence = new Map<number, number>();
    const sampleFreqs = new Map<string, Map<number, number>>();

    for (const s of samples) {
      const freq = new Map<number, number>();
      const seen = new Set<number>();
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          freq.set(h, (freq.get(h) ?? 0) + 1);
          if (!seen.has(h)) { seen.add(h); samplePresence.set(h, (samplePresence.get(h) ?? 0) + 1); }
        }
      }
      sampleFreqs.set(s.id, freq);
    }

    const threshold = Math.ceil(samples.length / 2);
    const rareKmers = new Set<number>();
    for (const [kmer, count] of samplePresence) {
      if (count < threshold) rareKmers.add(kmer);
    }

    return { sampleFreqs, rareKmers };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleFreqs, rareKmers } = context as {
      sampleFreqs: Map<string, Map<number, number>>;
      rareKmers: Set<number>;
    };
    const fA = sampleFreqs.get(a.id)!;
    const fB = sampleFreqs.get(b.id)!;

    let dot = 0, normA = 0, normB = 0;
    for (const [kmer, va] of fA) {
      if (!rareKmers.has(kmer)) continue;
      normA += va * va;
      const vb = fB.get(kmer);
      if (vb !== undefined) dot += va * vb;
    }
    for (const [kmer, vb] of fB) {
      if (!rareKmers.has(kmer)) continue;
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const cosine = denom > 0 ? dot / denom : 0;

    return {
      score: cosine,
      detail: `rare_cosine=${cosine.toFixed(6)} rareK=${rareKmers.size.toLocaleString()}`,
    };
  },
};
