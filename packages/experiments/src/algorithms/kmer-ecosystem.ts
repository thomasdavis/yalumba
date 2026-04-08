import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

/**
 * Symbiogenesis-inspired: treat genome as an ECOSYSTEM of k-mer "species".
 *
 * Ecological metrics:
 * - Species richness: number of distinct k-mers
 * - Shannon diversity: entropy of k-mer abundance
 * - Simpson's diversity: probability two random k-mers are different
 * - Evenness: how uniformly k-mers are distributed
 *
 * Related individuals share more similar ecosystem structure because
 * they inherited the same genomic "habitat" from common ancestors.
 * Compare ecosystem profiles using Bray-Curtis dissimilarity.
 */
export const kmerEcosystem: Experiment = {
  name: "K-mer ecosystem (Bray-Curtis)",
  description: "Symbiogenesis: genome as ecosystem — Bray-Curtis dissimilarity of k-mer abundance profiles",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const profiles = new Map<string, EcosystemProfile>();
    for (const s of samples) {
      profiles.set(s.id, buildProfile(s.reads, 21));
    }
    return profiles;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const profiles = context as Map<string, EcosystemProfile>;
    const pA = profiles.get(a.id)!;
    const pB = profiles.get(b.id)!;

    // Bray-Curtis dissimilarity: 1 - 2*shared_abundance / total_abundance
    let sharedAbundance = 0;
    for (const [kmer, countA] of pA.frequencies) {
      const countB = pB.frequencies.get(kmer);
      if (countB !== undefined) {
        sharedAbundance += Math.min(countA, countB);
      }
    }
    const brayCurtis = 1 - (2 * sharedAbundance) / (pA.totalCount + pB.totalCount);
    const similarity = 1 - brayCurtis;

    // Also compare diversity indices
    const diversityDiff = Math.abs(pA.shannonDiversity - pB.shannonDiversity);
    const evennessDiff = Math.abs(pA.evenness - pB.evenness);

    return {
      score: similarity,
      detail: `BC=${brayCurtis.toFixed(6)} divDiff=${diversityDiff.toFixed(4)} evenDiff=${evennessDiff.toFixed(4)} richA=${pA.richness} richB=${pB.richness}`,
    };
  },
};

interface EcosystemProfile {
  frequencies: Map<number, number>;
  richness: number;
  shannonDiversity: number;
  simpsonDiversity: number;
  evenness: number;
  totalCount: number;
}

function buildProfile(reads: readonly string[], k: number): EcosystemProfile {
  const freq = new Map<number, number>();
  let total = 0;
  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      const h = canonicalHash(read, i, k);
      freq.set(h, (freq.get(h) ?? 0) + 1);
      total++;
    }
  }

  const richness = freq.size;
  let shannon = 0;
  let simpson = 0;
  for (const count of freq.values()) {
    const p = count / total;
    if (p > 0) shannon -= p * Math.log2(p);
    simpson += p * p;
  }
  simpson = 1 - simpson;
  const maxEntropy = Math.log2(richness);
  const evenness = maxEntropy > 0 ? shannon / maxEntropy : 0;

  return { frequencies: freq, richness, shannonDiversity: shannon, simpsonDiversity: simpson, evenness, totalCount: total };
}
