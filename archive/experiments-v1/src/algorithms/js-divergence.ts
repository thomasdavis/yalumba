import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { buildKmerFrequencyMap } from "../hash-utils.js";
import { InformationTheory } from "@yalumba/math";

/** Jensen-Shannon divergence of k-mer frequency distributions */
export const jsDivergence: Experiment = {
  name: "Jensen-Shannon divergence (k=21)",
  version: 1,
  description: "Symmetric KL divergence of k-mer frequency distributions — lower JSD = more similar",
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
    const freqA = freqs.get(a.id)!;
    const freqB = freqs.get(b.id)!;

    const jsd = InformationTheory.jsDivergenceFromMaps(freqA, freqB);
    // Invert: lower divergence = more related → higher score
    const score = 1 - jsd;

    return {
      score,
      detail: `JSD=${jsd.toFixed(6)} (1-JSD=${score.toFixed(6)})`,
    };
  },
};
