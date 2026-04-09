import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/** Count reads appearing identically in both samples */
export const sharedUniqueReads: Experiment = {
  name: "Shared unique reads",
  version: 1,
  description: "Full 148bp exact read matching — Jaccard of unique read sets",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const setA = new Set(a.reads);
    const setB = new Set(b.reads);
    let shared = 0;
    for (const r of setA) { if (setB.has(r)) shared++; }
    const union = setA.size + setB.size - shared;
    const jaccard = union > 0 ? shared / union : 0;

    return {
      score: jaccard,
      detail: `shared=${shared.toLocaleString()} A=${setA.size.toLocaleString()} B=${setB.size.toLocaleString()}`,
    };
  },
};
