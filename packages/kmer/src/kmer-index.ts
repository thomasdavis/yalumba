import type { KmerFrequency, KmerIndexOptions } from "./types.js";
import { KmerExtractor } from "./extractor.js";

/**
 * In-memory k-mer index mapping hash values to positions.
 * Supports building from multiple sequences and querying shared k-mers.
 */
export class KmerIndex {
  private readonly extractor: KmerExtractor;
  private readonly index = new Map<bigint, number[]>();
  private sequenceCount = 0;

  constructor(options: KmerIndexOptions = {}) {
    this.extractor = new KmerExtractor(options);
  }

  /** Add a sequence to the index, returning its sequence ID */
  add(sequence: string): number {
    const id = this.sequenceCount++;
    for (const kmer of this.extractor.iterate(sequence)) {
      const existing = this.index.get(kmer.hash);
      if (existing) {
        existing.push(id);
      } else {
        this.index.set(kmer.hash, [id]);
      }
    }
    return id;
  }

  /** Get all positions for a given k-mer hash */
  lookup(hash: bigint): readonly number[] {
    return this.index.get(hash) ?? [];
  }

  /** Get the total number of distinct k-mers in the index */
  get size(): number {
    return this.index.size;
  }

  /** Count k-mers shared between two sequences */
  sharedKmerCount(seqA: string, seqB: string): number {
    const setA = new Set<bigint>();
    for (const kmer of this.extractor.iterate(seqA)) {
      setA.add(kmer.hash);
    }

    let shared = 0;
    for (const kmer of this.extractor.iterate(seqB)) {
      if (setA.has(kmer.hash)) {
        shared++;
        setA.delete(kmer.hash);
      }
    }

    return shared;
  }

  /** Compute k-mer frequency spectrum */
  frequencies(): KmerFrequency[] {
    const freqs: KmerFrequency[] = [];
    for (const [, positions] of this.index) {
      freqs.push({ sequence: "", count: positions.length });
    }
    return freqs.sort((a, b) => b.count - a.count);
  }
}
