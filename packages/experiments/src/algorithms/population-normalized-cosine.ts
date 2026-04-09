import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { buildKmerFrequencyMap } from "../hash-utils.js";

/** Cosine similarity after subtracting population mean frequencies */
export const populationNormalizedCosine: Experiment = {
  name: "Population-normalized cosine",
  version: 1,
  description: "Cosine similarity of mean-centered k-mer frequencies — removes population baseline",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    const freqs = new Map<string, Map<number, number>>();
    for (const s of samples) {
      freqs.set(s.id, buildKmerFrequencyMap(s.reads, k));
    }

    // Compute population mean frequency for each k-mer
    const allKmers = new Set<number>();
    for (const f of freqs.values()) {
      for (const kmer of f.keys()) allKmers.add(kmer);
    }

    const popMean = new Map<number, number>();
    const n = samples.length;
    for (const kmer of allKmers) {
      let sum = 0;
      for (const f of freqs.values()) {
        sum += f.get(kmer) ?? 0;
      }
      popMean.set(kmer, sum / n);
    }

    return { freqs, popMean };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { freqs, popMean } = context as {
      freqs: Map<string, Map<number, number>>;
      popMean: Map<number, number>;
    };
    const fA = freqs.get(a.id)!;
    const fB = freqs.get(b.id)!;

    // Compute mean-centered cosine
    let dot = 0, normA = 0, normB = 0;
    const allKeys = new Set([...fA.keys(), ...fB.keys()]);

    for (const k of allKeys) {
      const mean = popMean.get(k) ?? 0;
      const va = (fA.get(k) ?? 0) - mean;
      const vb = (fB.get(k) ?? 0) - mean;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const cosine = denom > 0 ? dot / denom : 0;

    return {
      score: cosine,
      detail: `centered_cosine=${cosine.toFixed(6)}`,
    };
  },
};
