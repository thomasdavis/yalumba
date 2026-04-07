/** Type of variant */
export type VariantType = "snp" | "insertion" | "deletion" | "mnp";

/** A single variant relative to a reference */
export interface Variant {
  /** Position in the reference (0-based) */
  readonly position: number;
  /** Reference allele */
  readonly ref: string;
  /** Alternate allele */
  readonly alt: string;
  /** Variant type */
  readonly type: VariantType;
  /** Quality score (if available) */
  readonly quality: number;
}

/** Genotype at a variant site */
export interface Genotype {
  /** Allele indices (e.g., [0, 1] for het) */
  readonly alleles: readonly number[];
  /** Whether this is homozygous reference */
  readonly isHomRef: boolean;
  /** Whether this is heterozygous */
  readonly isHet: boolean;
  /** Whether this is homozygous alternate */
  readonly isHomAlt: boolean;
}
