import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** Run-length scoring weighted by k-mer information content */
export const informationWeightedRuns: Experiment = {
  name: "Information-weighted runs",
  version: 1,
  description: "Symbiogenesis: run-length but weighted by k-mer rarity — informative modules score higher",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    // Count k-mer frequency across ALL samples combined (population frequency)
    const popFreq = new Map<number, number>();
    let totalKmers = 0;

    for (const s of samples) {
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          popFreq.set(h, (popFreq.get(h) ?? 0) + 1);
          totalKmers++;
        }
      }
    }

    // Information weight = -log2(frequency)
    const infoWeight = new Map<number, number>();
    for (const [kmer, count] of popFreq) {
      const freq = count / totalKmers;
      infoWeight.set(kmer, -Math.log2(freq));
    }

    // Build per-sample k-mer sets
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
    }

    return { infoWeight, sampleSets };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { infoWeight, sampleSets } = context as {
      infoWeight: Map<number, number>;
      sampleSets: Map<string, Set<number>>;
    };
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    let totalWeightedRun = 0;
    let runCount = 0;
    let currentRunWeight = 0;

    for (const read of a.reads) {
      currentRunWeight = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        if (setB.has(h)) {
          const w = infoWeight.get(h) ?? 0;
          currentRunWeight += w;
        } else {
          if (currentRunWeight > 0) {
            totalWeightedRun += currentRunWeight;
            runCount++;
            currentRunWeight = 0;
          }
        }
      }
      if (currentRunWeight > 0) {
        totalWeightedRun += currentRunWeight;
        runCount++;
      }
    }

    const avgWeightedRun = runCount > 0 ? totalWeightedRun / runCount : 0;
    return {
      score: avgWeightedRun,
      detail: `avgWRun=${avgWeightedRun.toFixed(2)} runs=${runCount.toLocaleString()} totalW=${totalWeightedRun.toFixed(0)}`,
    };
  },
};
