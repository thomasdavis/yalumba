import type { SimilarityResult } from "./types.js";
import { KmerExtractor } from "@yalumba/kmer";

/** Computes Jaccard similarity between sequences using k-mer sets */
export class JaccardSimilarity {
  private readonly extractor: KmerExtractor;

  constructor(k: number = 21) {
    this.extractor = new KmerExtractor({ k, canonical: true });
  }

  /** Compute Jaccard similarity between two sequences */
  compare(seqA: string, seqB: string): SimilarityResult {
    const setA = new Set<bigint>();
    const setB = new Set<bigint>();

    for (const kmer of this.extractor.iterate(seqA)) {
      setA.add(kmer.hash);
    }
    for (const kmer of this.extractor.iterate(seqB)) {
      setB.add(kmer.hash);
    }

    let shared = 0;
    for (const hash of setA) {
      if (setB.has(hash)) shared++;
    }

    const union = setA.size + setB.size - shared;
    return {
      score: union > 0 ? shared / union : 0,
      shared,
      union,
    };
  }
}
