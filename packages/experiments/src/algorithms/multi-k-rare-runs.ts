import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

export const multiKRareRuns: Experiment = {
  name: "Multi-k rare runs",
  version: 1,
  description: "Rare run-length at k=15,21,27 with per-k rarity filtering — multi-resolution rare IBD",
  maxReadsPerSample: 50_000,

  prepare(samples) {
    const kValues = [15, 21, 27];
    const perK = new Map<number, { sampleSets: Map<string, Set<number>>; rareKmers: Set<number> }>();

    for (const k of kValues) {
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
        for (const h of kset) samplePresence.set(h, (samplePresence.get(h) ?? 0) + 1);
      }
      const threshold = Math.ceil(samples.length / 2);
      const rareKmers = new Set<number>();
      for (const [kmer, count] of samplePresence) {
        if (count < threshold) rareKmers.add(kmer);
      }
      perK.set(k, { sampleSets, rareKmers });
    }
    return perK;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const perK = context as Map<number, { sampleSets: Map<string, Set<number>>; rareKmers: Set<number> }>;
    const kValues = [15, 21, 27];
    const weights = [1, 2, 3];
    let weightedSum = 0;
    let totalWeight = 0;
    const details: string[] = [];

    for (let ki = 0; ki < kValues.length; ki++) {
      const k = kValues[ki]!;
      const w = weights[ki]!;
      const { sampleSets, rareKmers } = perK.get(k)!;
      const setB = sampleSets.get(b.id)!;

      let totalRunLen = 0;
      let runCount = 0;
      for (const read of a.reads) {
        let run = 0;
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          if (rareKmers.has(h) && setB.has(h)) { run++; }
          else { if (run > 0) { totalRunLen += run; runCount++; run = 0; } }
        }
        if (run > 0) { totalRunLen += run; runCount++; }
      }
      const avg = runCount > 0 ? totalRunLen / runCount : 0;
      weightedSum += avg * w;
      totalWeight += w;
      details.push(`k${k}=${avg.toFixed(2)}`);
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return { score, detail: `${details.join(" ")} weighted=${score.toFixed(4)}` };
  },
};
