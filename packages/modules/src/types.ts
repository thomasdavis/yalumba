/**
 * Core types for the module system.
 * A Module is NOT a single k-mer — it is a structured group of
 * co-occurring motifs that behave as an inheritance unit.
 */

/** A motif is the atomic element — a short sequence signature (hash) */
export type MotifHash = number;

/**
 * A Module: a cluster of motifs that repeatedly co-occur.
 * The fundamental unit of the symbiogenesis framework.
 */
export interface Module {
  /** Unique identifier for this module */
  readonly id: number;
  /** Member motif hashes */
  readonly members: readonly MotifHash[];
  /** Number of reads this module was observed in */
  readonly support: number;
  /** Internal cohesion: how consistently members co-occur (0-1) */
  readonly cohesion: number;
  /** Average span in base pairs */
  readonly spanBp: number;
}

/**
 * A ModuleGraph: relationships between modules in a genome.
 * Nodes = modules, edges = co-occurrence/adjacency patterns.
 */
export interface ModuleGraph {
  /** All modules discovered in this sample */
  readonly modules: readonly Module[];
  /** Adjacency edges: module pairs that appear in sequence */
  readonly edges: readonly ModuleEdge[];
  /** Total reads analyzed */
  readonly readCount: number;
}

/** An edge connecting two modules in the graph */
export interface ModuleEdge {
  /** Source module ID */
  readonly from: number;
  /** Target module ID */
  readonly to: number;
  /** How many times this adjacency was observed */
  readonly weight: number;
  /** Average gap between the modules in base pairs */
  readonly avgGapBp: number;
}

/** A boundary: a transition point between modules within a read */
export interface ModuleBoundary {
  /** Position in the read where the transition occurs */
  readonly position: number;
  /** Module ID before the boundary */
  readonly moduleBefore: number;
  /** Module ID after the boundary */
  readonly moduleAfter: number;
  /** Entropy change at this boundary */
  readonly entropyShift: number;
}

/** A coalition: a specific combination of modules inherited together */
export interface Coalition {
  /** Module IDs in this coalition */
  readonly moduleIds: readonly number[];
  /** Hash fingerprint of the coalition */
  readonly fingerprint: number;
  /** How often this exact coalition appears across reads */
  readonly frequency: number;
  /** Whether the coalition is always intact (vs fragmented) */
  readonly integrityRate: number;
}

/** Result of module extraction for one sample */
export interface SampleModuleProfile {
  readonly sampleId: string;
  readonly graph: ModuleGraph;
  readonly coalitions: readonly Coalition[];
  readonly boundaryProfile: readonly number[];
}

/** Options for module extraction */
export interface ModuleExtractionOptions {
  /** K-mer size for motif detection (default: 15 — shorter than alignment k) */
  readonly motifK?: number;
  /** Window size for co-occurrence detection (default: 50bp) */
  readonly windowSize?: number;
  /** Minimum support (reads) for a module to be kept (default: 3) */
  readonly minSupport?: number;
  /** Minimum cohesion for a module (default: 0.3) */
  readonly minCohesion?: number;
}
