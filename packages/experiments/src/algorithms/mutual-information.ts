import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

/**
 * Mutual information between k-mer presence vectors of two samples.
 * Captures non-linear dependencies that Pearson/cosine miss.
 */
export const mutualInformationAlg: Experiment = {
  name: "Mutual information (k=21)",
  description: "MI between k-mer presence/absence in sample pairs — captures non-linear dependencies",
  maxReadsPerSample: 50_000,

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

    // Count joint occurrences
    const allKmers = new Set([...setA, ...setB]);
    let both = 0, onlyA = 0, onlyB = 0, neither = 0;
    const total = allKmers.size;

    for (const h of allKmers) {
      const inA = setA.has(h);
      const inB = setB.has(h);
      if (inA && inB) both++;
      else if (inA) onlyA++;
      else if (inB) onlyB++;
    }
    // "neither" doesn't exist in our enumeration — all k-mers are in at least one set

    // MI from 2×2 contingency table
    const n = total;
    if (n === 0) return { score: 0, detail: "no k-mers" };

    const pAB = both / n;
    const pA_notB = onlyA / n;
    const pNotA_B = onlyB / n;
    const pA = (both + onlyA) / n;
    const pB = (both + onlyB) / n;

    let mi = 0;
    if (pAB > 0 && pA > 0 && pB > 0) mi += pAB * Math.log2(pAB / (pA * pB));
    if (pA_notB > 0 && pA > 0 && (1 - pB) > 0) mi += pA_notB * Math.log2(pA_notB / (pA * (1 - pB)));
    if (pNotA_B > 0 && (1 - pA) > 0 && pB > 0) mi += pNotA_B * Math.log2(pNotA_B / ((1 - pA) * pB));

    return {
      score: mi,
      detail: `MI=${mi.toFixed(6)} both=${both.toLocaleString()} onlyA=${onlyA.toLocaleString()} onlyB=${onlyB.toLocaleString()}`,
    };
  },
};
