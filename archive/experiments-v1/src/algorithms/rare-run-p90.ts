import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** P90 of rare k-mer run lengths — combines best filtering with best scoring */
export const rareRunP90: Experiment = {
  name: "Rare-run P90",
  version: 1,
  description: "90th percentile of run lengths using only rare k-mers (<50% samples) — best of both worlds",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
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

    const runs: number[] = [];
    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        if (rareKmers.has(h) && setB.has(h)) {
          run++;
        } else {
          if (run > 0) { runs.push(run); run = 0; }
        }
      }
      if (run > 0) runs.push(run);
    }

    if (runs.length === 0) return { score: 0, detail: "no rare runs" };

    runs.sort((a, b) => a - b);
    const p90 = runs[Math.floor(runs.length * 0.9)]!;
    const p50 = runs[Math.floor(runs.length * 0.5)]!;
    const max = runs[runs.length - 1]!;

    return {
      score: p90,
      detail: `P90=${p90} P50=${p50} max=${max} runs=${runs.length} rareK=${rareKmers.size.toLocaleString()}`,
    };
  },
};
