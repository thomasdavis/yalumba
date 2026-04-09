/**
 * Types for symbiogenesis-native algorithms.
 *
 * Key constraint: NO singleton k-mer scoring.
 * Every algorithm operates on modules, coalitions, boundaries, or graphs.
 */

/** Input: preprocessed reads for a sample */
export interface SampleReads {
  readonly id: string;
  readonly role: string;
  readonly reads: readonly string[];
}

/** What each algorithm returns for a pair comparison */
export interface ComparisonScore {
  readonly score: number;
  readonly detail: string;
}

/**
 * A symbiogenesis algorithm.
 * Must operate on modules/coalitions/graphs — not raw k-mers.
 */
export interface SymbioAlgorithm {
  readonly name: string;
  readonly version: number;
  readonly description: string;
  readonly family: AlgorithmFamily;
  readonly maxReadsPerSample?: number;

  /** Preprocess all samples (module extraction, graph building) */
  prepare(samples: readonly SampleReads[]): unknown;

  /** Compare two samples using module-level signal */
  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore;
}

/** The five algorithm families */
export type AlgorithmFamily =
  | "module-persistence"
  | "boundary-stability"
  | "coalition-transfer"
  | "ecological-succession"
  | "holobiont-decomposition";

/** Dataset definition */
export interface DatasetDef {
  readonly id: string;
  readonly name: string;
  readonly dataDir: string;
  readonly samples: readonly { id: string; role: string; file: string }[];
  readonly pairs: readonly { a: string; b: string; label: string; related: boolean }[];
  readonly maxReads: number;
}

/** Full result for one algorithm */
export interface AlgorithmResult {
  readonly name: string;
  readonly family: AlgorithmFamily;
  readonly version: number;
  readonly pairs: readonly PairResult[];
  readonly prepTimeMs: number;
  readonly totalCompareMs: number;
  readonly separation: number;
  readonly weakestGap: number;
  readonly detectsAll: boolean;
}

export interface PairResult {
  readonly pair: string;
  readonly label: string;
  readonly related: boolean;
  readonly score: number;
  readonly detail: string;
  readonly timeMs: number;
}
