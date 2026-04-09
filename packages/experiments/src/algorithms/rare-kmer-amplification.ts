import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** TF-IDF style: rare k-mers are more informative for relatedness */
export const rareKmerAmplification: Experiment = {
  name: "Rare k-mer amplification (TF-IDF)",
  version: 1,
  description: "Weight shared k-mers by inverse population frequency — rare variants carry more signal",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    // Count how many samples each k-mer appears in
    const sampleCount = new Map<number, number>();
    const sampleSets = new Map<string, Set<number>>();

    for (const s of samples) {
      const kmerSet = new Set<number>();
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          kmerSet.add(canonicalHash(read, i, k));
        }
      }
      sampleSets.set(s.id, kmerSet);
      for (const h of kmerSet) {
        sampleCount.set(h, (sampleCount.get(h) ?? 0) + 1);
      }
    }

    const numSamples = samples.length;
    // IDF weight: log(N / df) where df = number of samples containing this k-mer
    const idfWeights = new Map<number, number>();
    for (const [kmer, count] of sampleCount) {
      idfWeights.set(kmer, Math.log(numSamples / count));
    }

    return { sampleSets, idfWeights };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleSets, idfWeights } = context as {
      sampleSets: Map<string, Set<number>>;
      idfWeights: Map<number, number>;
    };
    const setA = sampleSets.get(a.id)!;
    const setB = sampleSets.get(b.id)!;

    let weightedShared = 0;
    let totalWeight = 0;
    let rareShared = 0;

    for (const h of setA) {
      const w = idfWeights.get(h) ?? 0;
      totalWeight += w;
      if (setB.has(h)) {
        weightedShared += w;
        if (w > 0.1) rareShared++;
      }
    }

    const score = totalWeight > 0 ? weightedShared / totalWeight : 0;
    return {
      score,
      detail: `wShared=${weightedShared.toFixed(1)} total=${totalWeight.toFixed(1)} rare=${rareShared.toLocaleString()}`,
    };
  },
};
