import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

export const layerIsolation: Experiment = {
  name: "Layer isolation (L3 only)",
  version: 1,
  description: "3-layer model: filter conserved (all samples) + population (>50%) → score only familial layer",
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
      for (const h of kset) samplePresence.set(h, (samplePresence.get(h) ?? 0) + 1);
    }

    const n = samples.length;
    // Layer 1: in ALL samples (conserved) — ignore these
    // Layer 2: in >50% but not all (population) — ignore these
    // Layer 3: in <=50% of samples (familial/rare) — score these
    const layer3 = new Set<number>();
    const threshold = Math.ceil(n / 2);
    for (const [kmer, count] of samplePresence) {
      if (count <= threshold) layer3.add(kmer);
    }

    // Also compute per-pair Layer 3 run-length P90
    return { sampleSets, layer3 };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleSets, layer3 } = context as {
      sampleSets: Map<string, Set<number>>; layer3: Set<number>;
    };
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    // Compute P90 of Layer 3 run lengths
    const runs: number[] = [];
    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        if (layer3.has(h) && setB.has(h)) { run++; }
        else { if (run > 0) { runs.push(run); run = 0; } }
      }
      if (run > 0) runs.push(run);
    }

    if (runs.length === 0) return { score: 0, detail: "no L3 runs" };
    runs.sort((a, b) => a - b);
    const p90 = runs[Math.floor(runs.length * 0.9)]!;
    const mean = runs.reduce((s, r) => s + r, 0) / runs.length;

    return {
      score: p90,
      detail: `L3_P90=${p90} mean=${mean.toFixed(2)} runs=${runs.length} L3_kmers=${layer3.size.toLocaleString()}`,
    };
  },
};
