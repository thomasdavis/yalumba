import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { buildKmerFrequencyMap } from "../hash-utils.js";

/**
 * Symbiogenesis-inspired: k-mer DIVERSITY INDEX comparison.
 *
 * Ecology uses diversity indices to compare communities.
 * We apply the same framework to k-mer populations:
 *
 * - Sørensen index: 2|A∩B| / (|A|+|B|) — like Dice coefficient
 * - Morisita-Horn: abundance-weighted overlap
 *
 * Morisita-Horn is specifically designed for comparing species
 * abundance distributions and is robust to sample size differences.
 */
export const kmerDiversityIndex: Experiment = {
  name: "K-mer Morisita-Horn index",
  description: "Symbiogenesis: ecological Morisita-Horn overlap of k-mer abundance distributions",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const freqs = new Map<string, Map<number, number>>();
    for (const s of samples) {
      freqs.set(s.id, buildKmerFrequencyMap(s.reads, 21));
    }
    return freqs;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const freqs = context as Map<string, Map<number, number>>;
    const fA = freqs.get(a.id)!;
    const fB = freqs.get(b.id)!;

    // Morisita-Horn index
    let sumAB = 0;
    let sumA2 = 0;
    let sumB2 = 0;
    let totalA = 0;
    let totalB = 0;

    for (const [, c] of fA) { totalA += c; sumA2 += c * c; }
    for (const [, c] of fB) { totalB += c; sumB2 += c * c; }

    for (const [kmer, countA] of fA) {
      const countB = fB.get(kmer);
      if (countB !== undefined) {
        sumAB += countA * countB;
      }
    }

    const dA = sumA2 / (totalA * totalA);
    const dB = sumB2 / (totalB * totalB);
    const denom = (dA + dB) * totalA * totalB;
    const mh = denom > 0 ? (2 * sumAB) / denom : 0;

    // Also compute Sørensen for comparison
    let sharedSpecies = 0;
    for (const k of fA.keys()) { if (fB.has(k)) sharedSpecies++; }
    const sorensen = (2 * sharedSpecies) / (fA.size + fB.size);

    return {
      score: mh,
      detail: `MH=${mh.toFixed(6)} Sørensen=${sorensen.toFixed(6)} shared=${sharedSpecies.toLocaleString()}`,
    };
  },
};
