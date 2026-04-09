import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const runFragmentation: Experiment = {
  name: "Run fragmentation index",
  version: 1,
  description: "Symbiogenesis: Simpson concentration of run lengths — fewer fragments = more related",
  maxReadsPerSample: 100_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
    }
    let sumRun = 0;
    let sumRunSq = 0;
    let runCount = 0;
    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (setB.has(canonicalHash(read, i, k))) { run++; }
        else { if (run > 0) { sumRun += run; sumRunSq += run * run; runCount++; run = 0; } }
      }
      if (run > 0) { sumRun += run; sumRunSq += run * run; runCount++; }
    }
    const totalSq = sumRun * sumRun;
    const score = totalSq > 0 ? sumRunSq / totalSq : 0;
    return { score, detail: `simpson=${score.toFixed(6)} runs=${runCount} sumRun=${sumRun}` };
  },
};
