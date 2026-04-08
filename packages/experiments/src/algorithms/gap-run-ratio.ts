import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const gapRunRatio: Experiment = {
  name: "Gap-run ratio (IBD fraction)",
  version: 1,
  description: "Symbiogenesis: fraction of positions in shared runs — direct IBD estimator from raw reads",
  maxReadsPerSample: 100_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
    }
    let runBases = 0;
    let gapBases = 0;
    let runCount = 0;
    for (const read of a.reads) {
      let run = 0;
      let gap = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (setB.has(canonicalHash(read, i, k))) {
          if (gap > 0) { gapBases += gap; gap = 0; }
          run++;
        } else {
          if (run > 0) { runBases += run; runCount++; run = 0; }
          gap++;
        }
      }
      if (run > 0) { runBases += run; runCount++; }
      if (gap > 0) { gapBases += gap; }
    }
    const total = runBases + gapBases;
    const score = total > 0 ? runBases / total : 0;
    return { score, detail: `IBD=${(score*100).toFixed(3)}% run=${runBases.toLocaleString()} gap=${gapBases.toLocaleString()} segs=${runCount.toLocaleString()}` };
  },
};
