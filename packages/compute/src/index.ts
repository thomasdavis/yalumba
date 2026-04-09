export type {
  RunScanResult,
  RunStatistics,
  KmerSetOptions,
  RunScanOptions,
  NativeKmerSet,
  NativeRunResult,
} from "./types.js";

export { buildKmerSet } from "./kmer-set.js";
export { computeRunStatistics, scanRareRuns } from "./run-scanner.js";
export { isNativeAvailable } from "./bindings.js";
