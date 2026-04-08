import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

/**
 * Symbiogenesis-inspired: RECOMBINATION DISTANCE.
 *
 * Estimate the minimum number of recombination events needed
 * to explain the pattern of shared vs non-shared k-mers.
 *
 * Related individuals share LONG BLOCKS of consecutive k-mers
 * (inherited haplotype segments). Unrelated individuals share
 * scattered random k-mers with frequent transitions.
 *
 * We measure: average length of consecutive shared k-mer runs
 * in reads. Longer runs = fewer recombination breakpoints =
 * more closely related.
 */
export const recombinationDistance: Experiment = {
  name: "Recombination distance",
  description: "Symbiogenesis: avg length of consecutive shared k-mer runs — fewer breakpoints = more related",
  maxReadsPerSample: 100_000,

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    // Build k-mer set from B
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) {
        setB.add(canonicalHash(read, i, k));
      }
    }

    // For each read in A, find runs of consecutive k-mers shared with B
    let totalRunLength = 0;
    let runCount = 0;
    let maxRun = 0;

    for (const read of a.reads) {
      if (read.length < k) continue;
      let currentRun = 0;

      for (let i = 0; i <= read.length - k; i++) {
        const h = canonicalHash(read, i, k);
        if (setB.has(h)) {
          currentRun++;
        } else {
          if (currentRun > 0) {
            totalRunLength += currentRun;
            runCount++;
            if (currentRun > maxRun) maxRun = currentRun;
            currentRun = 0;
          }
        }
      }
      if (currentRun > 0) {
        totalRunLength += currentRun;
        runCount++;
        if (currentRun > maxRun) maxRun = currentRun;
      }
    }

    const avgRunLength = runCount > 0 ? totalRunLength / runCount : 0;

    return {
      score: avgRunLength,
      detail: `avgRun=${avgRunLength.toFixed(2)} maxRun=${maxRun} runs=${runCount.toLocaleString()} totalShared=${totalRunLength.toLocaleString()}`,
    };
  },
};
