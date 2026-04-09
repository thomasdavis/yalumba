/** Result of a run scan operation */
export interface RunScanResult {
  /** Individual run lengths */
  readonly runLengths: readonly number[];
  /** Number of runs detected */
  readonly numRuns: number;
  /** Total shared k-mer positions */
  readonly totalShared: number;
  /** Total positions scanned */
  readonly totalScanned: number;
}

/** Statistics computed from run scan results */
export interface RunStatistics {
  readonly mean: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly max: number;
  readonly entropy: number;
  readonly count: number;
  readonly totalShared: number;
  readonly ibdFraction: number;
}

/** Options for k-mer set building */
export interface KmerSetOptions {
  readonly k?: number;
  readonly filterLowComplexity?: boolean;
}

/** Options for run scanning */
export interface RunScanOptions {
  readonly k?: number;
  readonly filterLowComplexity?: boolean;
  readonly rareFilter?: NativeKmerSet;
}

/** Opaque handle to a native k-mer set */
export interface NativeKmerSet {
  readonly _ptr: number;
  readonly count: number;
  free(): void;
}

/** Opaque handle to a native run result */
export interface NativeRunResult {
  readonly _ptr: number;
  free(): void;
}
