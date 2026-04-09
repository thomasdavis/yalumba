import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

export const relatednessEstimator: Experiment = {
  name: "Relatedness estimator (kinship)",
  version: 1,
  description: "Estimates kinship coefficient from rare k-mer IBD fraction — calibrated relatedness score",
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

    // Estimate population baseline: avg rare sharing between ALL pairs
    const ids = samples.map(s => s.id);
    let totalBaseline = 0;
    let pairCount = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const setI = sampleSets.get(ids[i]!)!;
        const setJ = sampleSets.get(ids[j]!)!;
        let shared = 0;
        for (const h of setI) { if (rareKmers.has(h) && setJ.has(h)) shared++; }
        totalBaseline += shared / rareKmers.size;
        pairCount++;
      }
    }
    const baseline = pairCount > 0 ? totalBaseline / pairCount : 0;

    return { sampleSets, rareKmers, baseline };
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const { sampleSets, rareKmers, baseline } = context as {
      sampleSets: Map<string, Set<number>>; rareKmers: Set<number>; baseline: number;
    };
    const setA = sampleSets.get(a.id)!;
    const setB = sampleSets.get(b.id)!;

    // Compute rare k-mer sharing fraction
    let shared = 0;
    for (const h of setA) { if (rareKmers.has(h) && setB.has(h)) shared++; }
    const rawSharing = rareKmers.size > 0 ? shared / rareKmers.size : 0;

    // Excess sharing above population baseline
    const excess = rawSharing - baseline;

    // Map to kinship coefficient (0 = unrelated, 0.25 = parent-child, 0.5 = identical)
    // Parent-child should have ~50% excess rare sharing over baseline
    // Calibrate: max observed excess / 0.25 = scale factor
    const kinship = Math.max(0, excess * 2);

    let relationship = "unrelated";
    if (kinship > 0.20) relationship = "parent-child or sibling";
    else if (kinship > 0.10) relationship = "2nd degree";
    else if (kinship > 0.05) relationship = "3rd degree";
    else if (kinship > 0.01) relationship = "distant";

    return {
      score: kinship,
      detail: `kinship=${kinship.toFixed(4)} raw=${(rawSharing*100).toFixed(3)}% baseline=${(baseline*100).toFixed(3)}% excess=${(excess*100).toFixed(3)}% → ${relationship}`,
    };
  },
};
