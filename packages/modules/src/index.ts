// Types
export type {
  MotifHash,
  Module,
  ModuleGraph,
  ModuleEdge,
  ModuleBoundary,
  Coalition,
  SampleModuleProfile,
  ModuleExtractionOptions,
} from "./types.js";

// Extraction
export { extractMotifs, extractMotifsWithPositions } from "./motif-extractor.js";
export { buildModules } from "./module-builder.js";
export { buildModuleGraph } from "./module-graph.js";
export { detectBoundaries, buildBoundaryProfile } from "./boundary-detector.js";
export { findCoalitions } from "./coalition-finder.js";
