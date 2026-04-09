import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** P90 of runs in structurally volatile regions — repeat-rich regions carry ancestry signal */
export const structuralRunP90: Experiment = {
  name: "Structural run P90",
  version: 1,
  description: "SV ecology: P90 of shared runs restricted to structurally volatile k-mers (high local recurrence)",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    // Build per-sample k-mer frequency maps to find "structural" k-mers
    // A k-mer is structural if its count is > 3x the median count
    const sampleSets = new Map<string, Set<number>>();
    const globalFreq = new Map<number, number>();

    for (const s of samples) {
      const freq = new Map<number, number>();
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          freq.set(h, (freq.get(h) ?? 0) + 1);
          globalFreq.set(h, (globalFreq.get(h) ?? 0) + 1);
        }
      }
      sampleSets.set(s.id, new Set(freq.keys()));
    }

    // Find structurally volatile k-mers: those with count > median * 3
    const counts = [...globalFreq.values()].sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)] ?? 1;
    const threshold = median * 3;

    const structuralKmers = new Set<number>();
    for (const [kmer, count] of globalFreq) {
      if (count > threshold) structuralKmers.add(kmer);
    }

    return { sampleSets, structuralKmers };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleSets, structuralKmers } = context as {
      sampleSets: Map<string, Set<number>>;
      structuralKmers: Set<number>;
    };
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    const runs: number[] = [];
    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        // Only count structural k-mers that are shared
        if (structuralKmers.has(h) && setB.has(h)) {
          run++;
        } else {
          if (run > 0) { runs.push(run); run = 0; }
        }
      }
      if (run > 0) runs.push(run);
    }

    if (runs.length === 0) return { score: 0, detail: "no structural runs" };
    runs.sort((a, b) => a - b);
    const p90 = runs[Math.floor(runs.length * 0.9)]!;
    const p50 = runs[Math.floor(runs.length * 0.5)]!;

    return {
      score: p90,
      detail: `P90=${p90} P50=${p50} runs=${runs.length} structK=${structuralKmers.size.toLocaleString()}`,
    };
  },
};
