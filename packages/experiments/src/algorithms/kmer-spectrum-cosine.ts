import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { buildKmerFrequencyMap } from "../hash-utils.js";
import { InformationTheory } from "@yalumba/math";

/** Cosine similarity of k-mer frequency vectors */
export const kmerSpectrumCosine: Experiment = {
  name: "K-mer spectrum cosine (k=21)",
  description: "Cosine similarity of k-mer count vectors — robust to outliers unlike Pearson",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const freqs = new Map<string, Map<number, number>>();
    for (const s of samples) {
      freqs.set(s.id, buildKmerFrequencyMap(s.reads, 21));
    }
    return freqs;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const freqs = context as Map<string, Map<number, number>>;
    const cosine = InformationTheory.cosineSimilarityFromMaps(freqs.get(a.id)!, freqs.get(b.id)!);
    return { score: cosine, detail: `cosine=${cosine.toFixed(6)}` };
  },
};
