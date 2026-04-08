import type { Experiment } from "../types.js";

// Ported from v1/v2 benchmarks
export { anchorOverlap } from "./anchor-overlap.js";
export { normalizedAnchorOverlap } from "./normalized-anchor-overlap.js";
export { seedExtendOverlapRate } from "./seed-extend-overlap-rate.js";
export { overlapCountRatio } from "./overlap-count-ratio.js";
export { sharedUniqueReads } from "./shared-unique-reads.js";
export { kmerJaccard } from "./kmer-jaccard.js";
export { minhashSketch } from "./minhash-sketch.js";
export { containmentIndex } from "./containment-index.js";
export { multiAnchorOverlap } from "./multi-anchor-overlap.js";

// New algorithms
export { jsDivergence } from "./js-divergence.js";
export { kmerSpectrumCosine } from "./kmer-spectrum-cosine.js";
export { compressionDistance } from "./compression-distance.js";
export { kmerEntropy } from "./kmer-entropy.js";
export { hmmIbd } from "./hmm-ibd.js";
export { kmerGraphSimilarity } from "./kmer-graph-similarity.js";
export { mutualInformationAlg } from "./mutual-information.js";

import { anchorOverlap } from "./anchor-overlap.js";
import { normalizedAnchorOverlap } from "./normalized-anchor-overlap.js";
import { seedExtendOverlapRate } from "./seed-extend-overlap-rate.js";
import { overlapCountRatio } from "./overlap-count-ratio.js";
import { sharedUniqueReads } from "./shared-unique-reads.js";
import { kmerJaccard } from "./kmer-jaccard.js";
import { minhashSketch } from "./minhash-sketch.js";
import { containmentIndex } from "./containment-index.js";
import { multiAnchorOverlap } from "./multi-anchor-overlap.js";
import { jsDivergence } from "./js-divergence.js";
import { kmerSpectrumCosine } from "./kmer-spectrum-cosine.js";
import { compressionDistance } from "./compression-distance.js";
import { kmerEntropy } from "./kmer-entropy.js";
import { hmmIbd } from "./hmm-ibd.js";
import { kmerGraphSimilarity } from "./kmer-graph-similarity.js";
import { mutualInformationAlg } from "./mutual-information.js";

/** All available experiments, ordered by expected signal strength */
export const ALL_EXPERIMENTS: Experiment[] = [
  // Best performers (detect both parent-child pairs)
  normalizedAnchorOverlap,
  seedExtendOverlapRate,
  overlapCountRatio,

  // Good performers (detect father-son reliably)
  anchorOverlap,
  multiAnchorOverlap,
  sharedUniqueReads,
  minhashSketch,
  containmentIndex,
  kmerJaccard,

  // New algorithms
  jsDivergence,
  kmerSpectrumCosine,
  compressionDistance,
  kmerEntropy,
  hmmIbd,
  kmerGraphSimilarity,
  mutualInformationAlg,
];
