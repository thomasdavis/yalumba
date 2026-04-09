import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const runLengthDistribution: Experiment = {
  name: "Run length P90",
  version: 1,
  description: "Symbiogenesis: 90th percentile of shared k-mer run lengths — tail captures IBD segments",
  maxReadsPerSample: 100_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
    }
    const runs: number[] = [];
    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (setB.has(canonicalHash(read, i, k))) { run++; }
        else { if (run > 0) { runs.push(run); run = 0; } }
      }
      if (run > 0) runs.push(run);
    }
    if (runs.length === 0) return { score: 0, detail: "no runs" };
    runs.sort((a, b) => a - b);
    const p90 = runs[Math.floor(runs.length * 0.9)]!;
    const p50 = runs[Math.floor(runs.length * 0.5)]!;
    const max = runs[runs.length - 1]!;
    return { score: p90, detail: `P90=${p90} P50=${p50} max=${max} runs=${runs.length}` };
  },
};
