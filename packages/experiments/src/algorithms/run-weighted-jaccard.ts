import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const runWeightedJaccard: Experiment = {
  name: "Run-weighted Jaccard",
  version: 1,
  description: "Symbiogenesis: weight shared k-mers by run context — sum(run²) / total k-mers",
  maxReadsPerSample: 100_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
    }
    let sumRunSquared = 0;
    let totalKmers = 0;
    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        totalKmers++;
        if (setB.has(canonicalHash(read, i, k))) { run++; }
        else { sumRunSquared += run * run; run = 0; }
      }
      sumRunSquared += run * run;
    }
    const score = totalKmers > 0 ? sumRunSquared / totalKmers : 0;
    return { score, detail: `sumRun²=${sumRunSquared.toLocaleString()} total=${totalKmers.toLocaleString()}` };
  },
};
