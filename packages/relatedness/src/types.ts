/** A shared genomic segment between two individuals */
export interface SharedSegment {
  /** Start position in the reference coordinate system */
  readonly start: number;
  /** End position (exclusive) */
  readonly end: number;
  /** Length in base pairs */
  readonly lengthBp: number;
  /** Estimated length in centimorgans */
  readonly lengthCm: number;
  /** Confidence score [0, 1] */
  readonly confidence: number;
}

/** Overall relatedness result between two genomes */
export interface RelatednessResult {
  /** Shared segments detected */
  readonly segments: readonly SharedSegment[];
  /** Total shared length in base pairs */
  readonly totalSharedBp: number;
  /** Total shared length in centimorgans */
  readonly totalSharedCm: number;
  /** Estimated kinship coefficient */
  readonly kinshipCoefficient: number;
  /** Predicted relationship category */
  readonly relationship: RelationshipCategory;
}

/** Broad relationship categories based on shared DNA */
export type RelationshipCategory =
  | "identical"
  | "parent-child"
  | "full-sibling"
  | "half-sibling"
  | "first-cousin"
  | "second-cousin"
  | "distant"
  | "unrelated";
