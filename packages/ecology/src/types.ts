/**
 * Types for the ecology package.
 *
 * The primary object is NOT a k-mer, module, or score.
 * It is a multi-scale spectral representation of the genomic
 * ecosystem — the symbiogenetic field.
 *
 * Comparison happens on dynamics, topology, and role structure,
 * never on exact token identity.
 */

// ── Dense matrix (row-major Float64Array) ──

/** Dense matrix stored as row-major Float64Array */
export interface DenseMatrix {
  /** Row-major data: element (i,j) = data[i * cols + j] */
  readonly data: Float64Array;
  readonly rows: number;
  readonly cols: number;
}

// ── Eigendecomposition ──

/** Result of eigendecomposition of a symmetric matrix */
export interface EigenDecomposition {
  /** Eigenvalues in ascending order */
  readonly values: Float64Array;
  /** Eigenvectors as columns: vector k is at column k */
  readonly vectors: DenseMatrix;
}

// ── Module interaction graph ──

/** Weighted undirected graph over modules */
export interface InteractionGraph {
  /** Number of nodes (modules) */
  readonly n: number;
  /** Module IDs in index order: nodeId[i] = original module.id */
  readonly nodeIds: readonly number[];
  /** Module support values in index order */
  readonly supports: Float64Array;
  /** Symmetric weighted adjacency matrix (n × n) */
  readonly adjacency: DenseMatrix;
  /** Total reads analyzed */
  readonly readCount: number;
}

// ── Heat kernel ──

/** Heat kernel signature for a single node at multiple timescales */
export interface NodeHeatSignature {
  /** Heat kernel diagonal values at each timescale: hks[t][node] */
  readonly values: Float64Array;
}

/** Graph-level heat kernel trace at multiple timescales */
export interface HeatKernelTrace {
  /** Timescale parameters used */
  readonly timescales: readonly number[];
  /** trace(exp(-t*L)) at each timescale */
  readonly traces: Float64Array;
  /** Per-node heat kernel signatures: hks[node] = values at all timescales */
  readonly nodeSignatures: readonly Float64Array[];
}

// ── Ecological roles ──

/** The ecological role a module plays in the genomic ecosystem */
export type EcologicalRole =
  | "core"       // High centrality, high stability — foundational
  | "satellite"  // Low degree, attached to cores — peripheral
  | "bridge"     // Connects otherwise disconnected clusters
  | "scaffold"   // High betweenness, moderate degree — structural
  | "boundary";  // At the edge of spectral clusters — transitional

/** Role assignment for a single module */
export interface ModuleRole {
  readonly moduleId: number;
  readonly nodeIndex: number;
  readonly role: EcologicalRole;
  /** Confidence in role assignment (0-1) */
  readonly confidence: number;
  /** Spectral coordinates (first k eigenvectors) */
  readonly spectralPosition: Float64Array;
}

/** Distribution of roles across the ecosystem */
export interface RoleSpectrum {
  readonly core: number;
  readonly satellite: number;
  readonly bridge: number;
  readonly scaffold: number;
  readonly boundary: number;
  /** Normalized distribution (sums to 1) */
  readonly distribution: Float64Array;
}

// ── Ecosystem signature ──

/**
 * The symbiogenetic field for a single sample.
 * Multi-scale, topology-first, identity-free.
 */
export interface EcosystemSignature {
  /** Sample identifier */
  readonly sampleId: string;
  /** Number of modules in the ecosystem */
  readonly moduleCount: number;
  /** Number of edges in the interaction graph */
  readonly edgeCount: number;

  /** Eigenvalues of the normalized Laplacian */
  readonly spectrum: Float64Array;
  /** Heat kernel trace at multiple timescales */
  readonly heatTrace: HeatKernelTrace;
  /** Ecological role assignments for each module */
  readonly roles: readonly ModuleRole[];
  /** Aggregated role distribution */
  readonly roleSpectrum: RoleSpectrum;

  /** Spectral gap: λ₂ - λ₁ (algebraic connectivity) */
  readonly spectralGap: number;
  /** Spectral entropy: -Σ λ̃ᵢ log(λ̃ᵢ) over normalized eigenvalues */
  readonly spectralEntropy: number;
  /** Graph energy: Σ |λᵢ - mean(λ)| */
  readonly graphEnergy: number;

  // ── v2 additions ──

  /** Eigenvalue density profile (KDE over [0,2]) */
  readonly eigenvalueDensity: Float64Array;
  /** Eigenvector localization: mean IPR */
  readonly meanLocalization: number;
  /** Eigenvector localization: IPR std (mix of localized + delocalized) */
  readonly localizationSpread: number;
  /** Spectral residual after null model deconfounding */
  readonly spectralResidual: Float64Array;
  /** Coverage-deconfounded spectral entropy */
  readonly deconfoundedEntropy: number;
  /** Module feature embeddings (n × EMBEDDING_DIM, row-major) */
  readonly embeddings: Float64Array;
  /** Diffusion distance distribution statistics at key timescales */
  readonly diffusionMeans: Float64Array;
  readonly diffusionVariances: Float64Array;
}

// ── Comparison result ──

/** Detailed ecosystem comparison between two samples */
export interface EcosystemComparison {
  /** Overall similarity (0 = identical ecosystems, higher = more different) */
  readonly distance: number;
  /** Heat trace distance (L2 over log-traces) */
  readonly heatTraceDistance: number;
  /** Role spectrum divergence (Jensen-Shannon) */
  readonly roleSpectrumDivergence: number;
  /** Spectral distance (L2 over eigenvalue sequences) */
  readonly spectralDistance: number;
  /** Spectral gap similarity */
  readonly spectralGapRatio: number;
  /** Graph energy ratio */
  readonly energyRatio: number;
  /** Eigenvalue density distance (L2 between KDE profiles) */
  readonly densityDistance: number;
  /** Localization profile distance */
  readonly localizationDistance: number;
  /** Deconfounded spectral distance (using residuals) */
  readonly deconfoundedDistance: number;
  /** Diffusion distribution distance (across timescales) */
  readonly diffusionDistance: number;
}
