import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

export const rareRunMass: Experiment = {
  name: "Rare-run mass (IBD proxy)",
  version: 1,
  description: "Total rare shared k-mer positions / total rare positions scanned — direct rare-IBD fraction",
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
    const threshold = Math.ceil(samples.length / 2);
    const rareKmers = new Set<number>();
    for (const [kmer, count] of samplePresence) {
      if (count < threshold) rareKmers.add(kmer);
    }
    return { sampleSets, rareKmers };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleSets, rareKmers } = context as { sampleSets: Map<string, Set<number>>; rareKmers: Set<number> };
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    let rareShared = 0;
    let rareTotal = 0;
    for (const read of a.reads) {
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        if (rareKmers.has(h)) {
          rareTotal++;
          if (setB.has(h)) rareShared++;
        }
      }
    }

    const score = rareTotal > 0 ? rareShared / rareTotal : 0;
    return {
      score,
      detail: `IBD_rare=${(score * 100).toFixed(3)}% shared=${rareShared.toLocaleString()} total=${rareTotal.toLocaleString()}`,
    };
  },
};
