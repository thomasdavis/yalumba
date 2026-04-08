import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { buildKmerFrequencyMap } from "../hash-utils.js";
import { InformationTheory } from "@yalumba/math";

/** Compare Shannon entropy of k-mer spectra — related samples have more similar entropy */
export const kmerEntropy: Experiment = {
  name: "K-mer entropy similarity (k=21)",
  description: "1 - |entropy(A) - entropy(B)| / max_entropy — similar entropy = related",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const entropies = new Map<string, number>();
    for (const s of samples) {
      const freq = buildKmerFrequencyMap(s.reads, 21);
      const counts = [...freq.values()];
      entropies.set(s.id, InformationTheory.entropyFromCounts(counts));
    }
    return entropies;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const entropies = context as Map<string, number>;
    const eA = entropies.get(a.id)!;
    const eB = entropies.get(b.id)!;
    const diff = Math.abs(eA - eB);
    const maxE = Math.max(eA, eB);
    const score = maxE > 0 ? 1 - diff / maxE : 1;

    return {
      score,
      detail: `H(A)=${eA.toFixed(4)} H(B)=${eB.toFixed(4)} diff=${diff.toFixed(4)}`,
    };
  },
};
