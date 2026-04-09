import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

export const bootstrapRareRuns: Experiment = {
  name: "Bootstrap rare-run P90",
  version: 1,
  description: "Resample rarity classification 10x, compute rare-run P90 each time, report median — robust to small N",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    // Build per-sample k-mer sets
    const sampleSets = new Map<string, Set<number>>();
    const allKmers = new Map<number, Set<string>>();

    for (const s of samples) {
      const kset = new Set<number>();
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          kset.add(h);
          if (!allKmers.has(h)) allKmers.set(h, new Set());
          allKmers.get(h)!.add(s.id);
        }
      }
      sampleSets.set(s.id, kset);
    }

    // Generate 10 bootstrap rare sets by leaving one sample out each time
    const ids = samples.map(s => s.id);
    const bootstrapRareSets: Set<number>[] = [];

    for (let b = 0; b < 10; b++) {
      const excludeIdx = b % ids.length;
      const subsetSize = ids.length - 1;
      const threshold = Math.ceil(subsetSize / 2);
      const rareSet = new Set<number>();

      for (const [kmer, presenceSet] of allKmers) {
        let countInSubset = 0;
        for (let i = 0; i < ids.length; i++) {
          if (i === excludeIdx) continue;
          if (presenceSet.has(ids[i]!)) countInSubset++;
        }
        if (countInSubset < threshold) rareSet.add(kmer);
      }
      bootstrapRareSets.push(rareSet);
    }

    return { sampleSets, bootstrapRareSets };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleSets, bootstrapRareSets } = context as {
      sampleSets: Map<string, Set<number>>; bootstrapRareSets: Set<number>[];
    };
    const k = 21;
    const setB = sampleSets.get(b.id)!;
    const p90s: number[] = [];

    for (const rareSet of bootstrapRareSets) {
      const runs: number[] = [];
      for (const read of a.reads) {
        let run = 0;
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          const h = canonicalHash(read, i, k);
          if (rareSet.has(h) && setB.has(h)) { run++; }
          else { if (run > 0) { runs.push(run); run = 0; } }
        }
        if (run > 0) runs.push(run);
      }
      if (runs.length > 0) {
        runs.sort((a, b) => a - b);
        p90s.push(runs[Math.floor(runs.length * 0.9)]!);
      } else {
        p90s.push(0);
      }
    }

    // Median of bootstrap P90s
    p90s.sort((a, b) => a - b);
    const median = p90s[Math.floor(p90s.length / 2)]!;
    const min = p90s[0]!;
    const max = p90s[p90s.length - 1]!;

    return {
      score: median,
      detail: `median_P90=${median} range=[${min},${max}] bootstraps=${p90s.length}`,
    };
  },
};
