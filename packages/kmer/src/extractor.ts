import type { Kmer, KmerIndexOptions } from "./types.js";
import { RollingHash } from "./rolling-hash.js";

const DEFAULT_K = 21;

/** Extracts k-mers from DNA sequences using a sliding window */
export class KmerExtractor {
  private readonly k: number;
  private readonly canonical: boolean;
  private readonly hasher: RollingHash;

  constructor(options: KmerIndexOptions = {}) {
    this.k = options.k ?? DEFAULT_K;
    this.canonical = options.canonical ?? false;
    this.hasher = new RollingHash(this.k);
  }

  /** Extract all k-mers from a sequence */
  extract(sequence: string): Kmer[] {
    if (sequence.length < this.k) return [];

    const kmers: Kmer[] = [];
    const count = sequence.length - this.k + 1;

    for (let i = 0; i < count; i++) {
      const kmerSeq = sequence.slice(i, i + this.k);
      const finalSeq = this.canonical ? this.canonicalize(kmerSeq) : kmerSeq;
      const hash = this.hasher.hash(finalSeq);
      kmers.push({ sequence: finalSeq, position: i, hash });
    }

    return kmers;
  }

  /** Extract k-mers as an iterator for memory efficiency */
  *iterate(sequence: string): Generator<Kmer> {
    if (sequence.length < this.k) return;

    const count = sequence.length - this.k + 1;
    for (let i = 0; i < count; i++) {
      const kmerSeq = sequence.slice(i, i + this.k);
      const finalSeq = this.canonical ? this.canonicalize(kmerSeq) : kmerSeq;
      const hash = this.hasher.hash(finalSeq);
      yield { sequence: finalSeq, position: i, hash };
    }
  }

  /** Return the lexicographically smaller of a k-mer and its reverse complement */
  private canonicalize(kmer: string): string {
    const rc = this.reverseComplement(kmer);
    return kmer < rc ? kmer : rc;
  }

  private reverseComplement(seq: string): string {
    const result: string[] = new Array(seq.length);
    for (let i = 0; i < seq.length; i++) {
      result[seq.length - 1 - i] = complementBase(seq[i]!);
    }
    return result.join("");
  }
}

function complementBase(base: string): string {
  switch (base) {
    case "A": case "a": return "T";
    case "T": case "t": return "A";
    case "C": case "c": return "G";
    case "G": case "g": return "C";
    default: return "N";
  }
}
