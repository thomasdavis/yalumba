/** Preprocessed data for a single sample */
export interface SampleData {
  readonly id: string;
  readonly role: string;
  readonly reads: readonly string[];
}

/** What each experiment returns for a single pair comparison */
export interface ExperimentScore {
  /** Primary score — higher means MORE related */
  readonly score: number;
  /** Human-readable detail string for reporting */
  readonly detail: string;
}

/** Core trait all algorithms implement */
export interface Experiment {
  /** Unique identifier */
  readonly name: string;
  /** Version — bump to invalidate cache and force re-run */
  readonly version: number;
  /** Short description */
  readonly description: string;
  /** Max reads needed per sample (runner subsamples to this) */
  readonly maxReadsPerSample?: number;

  /**
   * Optional one-time preprocessing across all samples.
   * Returns opaque context passed to compare().
   */
  prepare?(samples: readonly SampleData[]): unknown;

  /** Compare two samples. Higher score = more related. */
  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore;
}

/** Definition of a sample to load */
export interface SampleDef {
  readonly id: string;
  readonly role: string;
  readonly file: string;
}

/** Definition of a pair to compare */
export interface PairDef {
  readonly a: string;
  readonly b: string;
  readonly label: string;
  readonly related: boolean;
}

/** A complete dataset definition */
export interface DatasetDef {
  /** Unique slug for this dataset (used in cache keys) */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Directory containing FASTQ files */
  readonly dataDir: string;
  /** Samples to load */
  readonly samples: readonly SampleDef[];
  /** Pairs to compare */
  readonly pairs: readonly PairDef[];
  /** Max reads to load per sample */
  readonly maxReads: number;
}

/** Result for a single pair from one algorithm */
export interface PairResult {
  readonly pair: string;
  readonly label: string;
  readonly related: boolean;
  readonly score: number;
  readonly detail: string;
  readonly timeMs: number;
}

/** Complete result for one algorithm across all pairs */
export interface AlgorithmResult {
  readonly name: string;
  readonly version: number;
  readonly dataset: string;
  readonly description: string;
  readonly pairs: readonly PairResult[];
  readonly totalTimeMs: number;
  readonly prepTimeMs: number;
  readonly separation: number;
  readonly correct: boolean;
  readonly motherSonGap: number;
  readonly detectsMother: boolean;
}

/** Cache file structure */
export interface ResultCache {
  readonly results: Record<string, AlgorithmResult>;
}
