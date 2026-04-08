import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

/** Exact k-mer set Jaccard similarity */
export const kmerJaccard: Experiment = {
  name: "K-mer Jaccard (k=21)",
  description: "Exact set intersection of canonical 21-mers",
  maxReadsPerSample: 100_000,

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    const setA = new Set<number>();
    for (const read of a.reads) {
      for (let i = 0; i <= read.length - k; i++) setA.add(canonicalHash(read, i, k));
    }
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
    }

    let shared = 0;
    for (const h of setA) { if (setB.has(h)) shared++; }
    const union = setA.size + setB.size - shared;
    const jaccard = union > 0 ? shared / union : 0;

    return {
      score: jaccard,
      detail: `shared=${shared.toLocaleString()} union=${union.toLocaleString()}`,
    };
  },
};
