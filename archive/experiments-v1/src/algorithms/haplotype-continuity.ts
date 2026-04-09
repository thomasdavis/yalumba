import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** Run-length of rare shared k-mers — haplotype blocks produce rare k-mer clusters */
export const haplotypeContinuity: Experiment = {
  name: "Haplotype continuity (rare runs)",
  version: 1,
  description: "Symbiogenesis: run-length of k-mers found in <50% of samples — rare variant clustering",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    // Count how many samples each k-mer appears in
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

    // Rare = found in fewer than half the samples
    const threshold = Math.ceil(samples.length / 2);
    const rareKmers = new Set<number>();
    for (const [kmer, count] of samplePresence) {
      if (count < threshold) rareKmers.add(kmer);
    }

    return { sampleSets, rareKmers };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleSets, rareKmers } = context as {
      sampleSets: Map<string, Set<number>>;
      rareKmers: Set<number>;
    };
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    let totalRunLen = 0;
    let runCount = 0;
    let maxRun = 0;

    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        // Only count k-mers that are RARE in the population AND shared with B
        if (rareKmers.has(h) && setB.has(h)) {
          run++;
        } else {
          if (run > 0) {
            totalRunLen += run;
            runCount++;
            if (run > maxRun) maxRun = run;
            run = 0;
          }
        }
      }
      if (run > 0) {
        totalRunLen += run;
        runCount++;
        if (run > maxRun) maxRun = run;
      }
    }

    const avgRun = runCount > 0 ? totalRunLen / runCount : 0;
    return {
      score: avgRun,
      detail: `avgRareRun=${avgRun.toFixed(2)} max=${maxRun} runs=${runCount.toLocaleString()} rareKmers=${rareKmers.size.toLocaleString()}`,
    };
  },
};
