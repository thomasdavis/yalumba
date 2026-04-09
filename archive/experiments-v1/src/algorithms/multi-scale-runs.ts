import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const multiScaleRuns: Experiment = {
  name: "Multi-scale run spectrum",
  version: 1,
  description: "Symbiogenesis: weighted avg run length at k=15,21,27,31 — multi-resolution IBD detection",
  maxReadsPerSample: 50_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const kValues = [15, 21, 27, 31];
    const weights = [1, 2, 3, 4]; // Higher k = more weight
    let weightedSum = 0;
    let totalWeight = 0;
    const details: string[] = [];

    for (let ki = 0; ki < kValues.length; ki++) {
      const k = kValues[ki]!;
      const w = weights[ki]!;

      const setB = new Set<number>();
      for (const read of b.reads) {
        for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
      }

      let totalRunLen = 0;
      let runCount = 0;
      for (const read of a.reads) {
        let run = 0;
        for (let i = 0; i <= read.length - k; i++) {
          if (setB.has(canonicalHash(read, i, k))) { run++; }
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
