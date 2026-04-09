import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { buildKmerFrequencyMap } from "../hash-utils.js";

/** Bray-Curtis similarity minus population average — isolates pair-specific signal */
export const differentialEcosystem: Experiment = {
  name: "Differential ecosystem",
  version: 1,
  description: "Bray-Curtis similarity minus population baseline — residual captures pair-specific IBD",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    const freqs = new Map<string, Map<number, number>>();
    for (const s of samples) {
      freqs.set(s.id, buildKmerFrequencyMap(s.reads, k));
    }

    // Compute average pairwise Bray-Curtis as population baseline
    const ids = samples.map(s => s.id);
    let totalBC = 0;
    let pairCount = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        totalBC += brayCurtis(freqs.get(ids[i]!)!, freqs.get(ids[j]!)!);
        pairCount++;
      }
    }
    const baseline = pairCount > 0 ? totalBC / pairCount : 0;

    return { freqs, baseline };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { freqs, baseline } = context as {
      freqs: Map<string, Map<number, number>>;
      baseline: number;
    };
    const raw = brayCurtis(freqs.get(a.id)!, freqs.get(b.id)!);
    const differential = raw - baseline;

    return {
      score: differential,
      detail: `raw=${raw.toFixed(6)} baseline=${baseline.toFixed(6)} diff=${differential.toFixed(6)}`,
    };
  },
};

function brayCurtis(fA: Map<number, number>, fB: Map<number, number>): number {
  let totalA = 0, totalB = 0, sharedMin = 0;
  for (const c of fA.values()) totalA += c;
  for (const c of fB.values()) totalB += c;
  for (const [kmer, countA] of fA) {
    const countB = fB.get(kmer);
    if (countB !== undefined) sharedMin += Math.min(countA, countB);
  }
  const denom = totalA + totalB;
  return denom > 0 ? (2 * sharedMin) / denom : 0;
}
