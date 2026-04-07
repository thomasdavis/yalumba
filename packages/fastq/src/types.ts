/** A single FASTQ record parsed from a 4-line block */
export interface FastqRecord {
  /** Sequence identifier (without leading @) */
  readonly id: string;
  /** Raw nucleotide sequence string */
  readonly sequence: string;
  /** Quality string (ASCII-encoded Phred scores) */
  readonly quality: string;
  /** Optional description after the ID on the header line */
  readonly description: string;
}

/** Aggregated statistics from a FASTQ file or stream */
export interface FastqStats {
  /** Total number of records parsed */
  readonly recordCount: number;
  /** Total bases across all reads */
  readonly totalBases: number;
  /** Average read length */
  readonly averageLength: number;
  /** Minimum read length seen */
  readonly minLength: number;
  /** Maximum read length seen */
  readonly maxLength: number;
  /** Mean quality score across all bases */
  readonly meanQuality: number;
  /** GC content as a fraction [0, 1] */
  readonly gcContent: number;
}

/** Options controlling parser behavior */
export interface ParseOptions {
  /** Whether to validate quality string length matches sequence length */
  readonly validateQuality?: boolean;
  /** Whether to validate sequence characters (ACGTN only) */
  readonly validateSequence?: boolean;
  /** Maximum number of records to parse (undefined = all) */
  readonly limit?: number;
}
