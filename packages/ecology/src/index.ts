// Types
export type {
  DenseMatrix,
  EigenDecomposition,
  InteractionGraph,
  NodeHeatSignature,
  HeatKernelTrace,
  EcologicalRole,
  ModuleRole,
  RoleSpectrum,
  EcosystemSignature,
  EcosystemComparison,
} from "./types.js";

// Graph construction (v2 — co-occurrence based, dense)
export { buildInteractionGraph } from "./motif-graph.js";

// Module embeddings
export { computeModuleEmbeddings, crossSampleSimilarity, EMBEDDING_DIM } from "./module-embedding.js";

// Spectral analysis
export { normalizedLaplacian, eigenDecomposition } from "./laplacian.js";
export { computeHeatKernel, normalizedTraces, logTraces } from "./heat-kernel.js";

// Richer spectral invariants
export { eigenvalueDensity, eigenvectorLocalization, spectralCurvature, diffusionDistribution } from "./spectral-invariants.js";

// Coverage deconfounding
export { spectralResidual, deconfoundedSpectralEntropy } from "./null-model.js";

// Ecological structure
export { assignRoles, computeRoleSpectrum } from "./role-assignment.js";

// Ecosystem signature
export { buildEcosystemSignature } from "./ecosystem-signature.js";

// Comparison
export { compareEcosystems, distanceToSimilarity } from "./compare.js";

// v3: Cross-sample pair transport
export { buildNodeFeatures, NODE_FEATURE_DIM } from "./node-features.js";
export type { NodeFeatureSet } from "./node-features.js";
export { pairTransport } from "./pair-transport.js";
export type { PairTransportScore } from "./pair-transport.js";

// v4: Symbiogenetic coherence fields
export { extractPatches, PATCH_DIM } from "./patch-tensor.js";
export type { EcologicalPatch, SamplePatches } from "./patch-tensor.js";
export { solveCoherenceField } from "./coherence-field.js";
export type { CoherenceFieldResult } from "./coherence-field.js";

// v5: Multi-scale symbiogenetic field curvature
export { extractMultiScalePatches, solveMultiScaleField } from "./multiscale-field.js";
export type { MultiScalePatches, MultiScaleFieldResult } from "./multiscale-field.js";
