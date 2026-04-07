/** A single k-mer with its position */
export interface Kmer {
  /** The k-mer sequence string */
  readonly sequence: string;
  /** Position in the source read */
  readonly position: number;
  /** Hash value of this k-mer */
  readonly hash: bigint;
}

/** K-mer with its occurrence count */
export interface KmerFrequency {
  readonly sequence: string;
  readonly count: number;
}

/** Options for building a k-mer index */
export interface KmerIndexOptions {
  /** Size of k-mers (default: 21) */
  readonly k?: number;
  /** Whether to also index reverse complements */
  readonly canonical?: boolean;
}
