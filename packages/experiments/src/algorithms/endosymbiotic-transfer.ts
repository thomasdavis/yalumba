import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const endosymbioticTransfer: Experiment = {
  name: "Endosymbiotic transfer score",
  version: 1,
  description: "Symbiogenesis: fraction of reads fully absorbed into other genome — intact inherited blocks",
  maxReadsPerSample: 100_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
    }
    const baseline = 0.02; // Expected random overlap
    let totalScore = 0;
    let highCoverageReads = 0;
    for (const read of a.reads) {
      if (read.length < k) continue;
      let found = 0;
      const total = read.length - k + 1;
      for (let i = 0; i <= read.length - k; i++) {
        if (setB.has(canonicalHash(read, i, k))) found++;
      }
      const coverage = found / total;
      const excess = Math.max(0, coverage - baseline);
      totalScore += excess * excess; // Quadratic emphasis on high coverage
      if (coverage > 0.5) highCoverageReads++;
    }
    const score = totalScore / a.reads.length;
    return { score, detail: `score=${score.toFixed(6)} highCov=${highCoverageReads.toLocaleString()}/${a.reads.length.toLocaleString()}` };
  },
};
