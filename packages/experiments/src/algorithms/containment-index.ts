import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

/** Containment index — fraction of A's k-mers found in B (averaged both ways) */
export const containmentIndex: Experiment = {
  name: "Containment index (k=21)",
  description: "Average of A→B and B→A containment of canonical 21-mers",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const sets = new Map<string, Set<number>>();
    for (const sample of samples) {
      const s = new Set<number>();
      for (const read of sample.reads) {
        for (let i = 0; i <= read.length - 21; i++) s.add(canonicalHash(read, i, 21));
      }
      sets.set(sample.id, s);
    }
    return sets;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const sets = context as Map<string, Set<number>>;
    const setA = sets.get(a.id)!;
    const setB = sets.get(b.id)!;

    let shared = 0;
    for (const h of setA) { if (setB.has(h)) shared++; }

    const ab = setA.size > 0 ? shared / setA.size : 0;
    const ba = setB.size > 0 ? shared / setB.size : 0;
    const avg = (ab + ba) / 2;

    return {
      score: avg,
      detail: `A→B=${(ab * 100).toFixed(2)}% B→A=${(ba * 100).toFixed(2)}%`,
    };
  },
};
