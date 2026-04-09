import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

export const runEntropy: Experiment = {
  name: "Run entropy (negative)",
  version: 1,
  description: "Negative Shannon entropy of rare run-length distribution — concentrated runs = more related",
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

    // Collect rare run lengths
    const runLengthCounts = new Map<number, number>();
    let totalRuns = 0;
    for (const read of a.reads) {
      let run = 0;
      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        if (rareKmers.has(h) && setB.has(h)) { run++; }
        else {
          if (run > 0) {
            runLengthCounts.set(run, (runLengthCounts.get(run) ?? 0) + 1);
            totalRuns++;
            run = 0;
          }
        }
      }
      if (run > 0) { runLengthCounts.set(run, (runLengthCounts.get(run) ?? 0) + 1); totalRuns++; }
    }

    if (totalRuns === 0) return { score: 0, detail: "no runs" };

    // Shannon entropy of run-length distribution
    let entropy = 0;
    for (const count of runLengthCounts.values()) {
      const p = count / totalRuns;
      if (p > 0) entropy -= p * Math.log2(p);
    }

    // Negative entropy: lower entropy (more concentrated) = more related
    const score = -entropy;
    return { score, detail: `entropy=${entropy.toFixed(4)} runs=${totalRuns} distinct_lengths=${runLengthCounts.size}` };
  },
};
