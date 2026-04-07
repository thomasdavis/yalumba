/** Result of a similarity comparison */
export interface SimilarityResult {
  /** Similarity score in [0, 1] */
  readonly score: number;
  /** Number of shared elements */
  readonly shared: number;
  /** Total union size */
  readonly union: number;
}

/** Result of a sequence alignment */
export interface AlignmentResult {
  /** Aligned version of sequence A (with gaps as '-') */
  readonly alignedA: string;
  /** Aligned version of sequence B (with gaps as '-') */
  readonly alignedB: string;
  /** Alignment score */
  readonly score: number;
  /** Number of matches */
  readonly matches: number;
  /** Number of mismatches */
  readonly mismatches: number;
  /** Number of gaps */
  readonly gaps: number;
}

/** Scoring parameters for alignment */
export interface ScoringMatrix {
  readonly match: number;
  readonly mismatch: number;
  readonly gap: number;
}
