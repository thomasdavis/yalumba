import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** Sweep rarity thresholds to find optimal haplotype continuity */
export const rareRunFrequencySweep: Experiment = {
  name: "Rare-run frequency sweep",
  version: 1,
  description: "Haplotype continuity at multiple rarity thresholds (10-90%) — auto-selects best",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    // Count per-sample presence for each k-mer
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

    return { samplePresence, sampleSets, numSamples: samples.length };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { samplePresence, sampleSets, numSamples } = context as {
      samplePresence: Map<number, number>;
      sampleSets: Map<string, Set<number>>;
      numSamples: number;
    };
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    // Try thresholds from 10% to 90%
    const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    let bestScore = 0;
    let bestThreshold = 0.5;
    let bestDetail = "";

    for (const thresh of thresholds) {
      const maxPresence = Math.ceil(numSamples * thresh);
      let totalRunLen = 0;
      let runCount = 0;

      for (const read of a.reads) {
        let run = 0;
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          const presence = samplePresence.get(h) ?? 0;
          if (presence <= maxPresence && setB.has(h)) {
            run++;
          } else {
            if (run > 0) { totalRunLen += run; runCount++; run = 0; }
          }
        }
        if (run > 0) { totalRunLen += run; runCount++; }
      }

      const avgRun = runCount > 0 ? totalRunLen / runCount : 0;
      if (avgRun > bestScore) {
        bestScore = avgRun;
        bestThreshold = thresh;
        bestDetail = `thresh=${(thresh*100).toFixed(0)}% avgRun=${avgRun.toFixed(2)} runs=${runCount}`;
      }
    }

    return { score: bestScore, detail: bestDetail };
  },
};
