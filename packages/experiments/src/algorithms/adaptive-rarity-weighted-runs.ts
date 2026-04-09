import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** Runs weighted by continuous IDF — no hard threshold, smooth weighting */
export const adaptiveRarityWeightedRuns: Experiment = {
  name: "Adaptive rarity-weighted runs",
  version: 1,
  description: "Run-length with continuous IDF weighting — log(N/count) per shared k-mer, no hard cutoff",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    const samplePresence = new Map<number, number>();
    const sampleSets = new Map<string, Set<number>>();

    for (const s of samples) {
      const kset = new Set<number>();
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          kset.add(canonicalHash(read, i, k));
        }
      }
      sampleSets.set(s.id, kset);
      for (const h of kset) {
        samplePresence.set(h, (samplePresence.get(h) ?? 0) + 1);
      }
    }

    const n = samples.length;
    const idfWeight = new Map<number, number>();
    for (const [kmer, count] of samplePresence) {
      idfWeight.set(kmer, Math.log2(n / count));
    }

    return { idfWeight, sampleSets };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { idfWeight, sampleSets } = context as {
      idfWeight: Map<number, number>;
      sampleSets: Map<string, Set<number>>;
    };
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    let totalWeightedRun = 0;
    let runCount = 0;
    let currentRunWeight = 0;
    let currentRunLen = 0;

    for (const read of a.reads) {
      currentRunWeight = 0;
      currentRunLen = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        if (setB.has(h)) {
          const w = idfWeight.get(h) ?? 0;
          currentRunWeight += w;
          currentRunLen++;
        } else {
          if (currentRunLen > 0) {
            // Weight run by both length AND average rarity
            totalWeightedRun += currentRunWeight * currentRunLen;
            runCount++;
            currentRunWeight = 0;
            currentRunLen = 0;
          }
        }
      }
      if (currentRunLen > 0) {
        totalWeightedRun += currentRunWeight * currentRunLen;
        runCount++;
      }
    }

    const avgWeightedRun = runCount > 0 ? totalWeightedRun / runCount : 0;
    return {
      score: avgWeightedRun,
      detail: `avgWRun=${avgWeightedRun.toFixed(2)} runs=${runCount.toLocaleString()}`,
    };
  },
};
