/**
 * Enriched per-node feature vectors for cross-sample matching.
 *
 * Combines intrinsic module properties (support, cohesion, motif
 * diversity) with spectral properties (HKS at multiple timescales,
 * spectral position, clustering coefficient, role).
 *
 * These features define what it means for two modules in different
 * samples to be "ecologically equivalent" — same structural role,
 * same diffusion profile, same neighborhood character — even with
 * zero k-mer overlap.
 *
 * All features are rank-normalized within each sample to remove
 * absolute scale (coverage deconfounding at the feature level).
 */

import type { Module } from "@yalumba/modules";
import type {
  InteractionGraph,
  EigenDecomposition,
  HeatKernelTrace,
  ModuleRole,
} from "./types.js";

/**
 * Number of HKS timescales to include.
 * Using 5 of the 10 (skipping alternates) to keep dimensionality manageable.
 */
const HKS_INDICES = [0, 2, 4, 6, 8] as const; // t = 0.1, 0.5, 2.0, 10.0, 50.0

/** Number of spectral position dimensions */
const SPECTRAL_DIMS = 4;

/** Total feature dimension: 5 intrinsic + 5 HKS + 4 spectral + 1 clustering + 5 role = 20 */
export const NODE_FEATURE_DIM = 20;

/** Per-sample prepared node features for cross-sample matching */
export interface NodeFeatureSet {
  /** Sample ID */
  readonly sampleId: string;
  /** Number of nodes */
  readonly n: number;
  /** n × NODE_FEATURE_DIM matrix (row-major), rank-normalized */
  readonly features: Float64Array;
  /** Adjacency matrix reference (for topology preservation) */
  readonly adjacency: Float64Array;
}

/**
 * Build enriched per-node feature vectors for one sample.
 *
 * Requires the full ecosystem analysis to have been run first
 * (eigendecomposition, heat kernel, role assignment).
 */
export function buildNodeFeatures(
  sampleId: string,
  modules: readonly Module[],
  graph: InteractionGraph,
  eigen: EigenDecomposition,
  heatTrace: HeatKernelTrace,
  roles: readonly ModuleRole[],
): NodeFeatureSet {
  const n = graph.n;
  if (n === 0) {
    return { sampleId, n: 0, features: new Float64Array(0), adjacency: new Float64Array(0) };
  }

  const dim = NODE_FEATURE_DIM;
  const features = new Float64Array(n * dim);
  const A = graph.adjacency.data;

  for (let i = 0; i < n; i++) {
    const mod = modules[i];
    const role = roles[i];
    let col = 0;
    const row = i * dim;

    // ── Intrinsic features (5) ──

    // 0: log support (rank-normalized later)
    features[row + col++] = Math.log1p(mod ? mod.support : 0);

    // 1: cohesion
    features[row + col++] = mod ? mod.cohesion : 0;

    // 2: log motif count
    features[row + col++] = Math.log1p(mod ? mod.members.length : 0);

    // 3: weighted degree
    let degree = 0;
    for (let j = 0; j < n; j++) degree += A[i * n + j]!;
    features[row + col++] = degree;

    // 4: clustering coefficient
    features[row + col++] = clusteringCoefficient(i, n, A);

    // ── HKS features (5 timescales) ──
    const nodeSig = heatTrace.nodeSignatures[i];
    for (const ti of HKS_INDICES) {
      features[row + col++] = nodeSig ? (nodeSig[ti] ?? 0) : 0;
    }

    // ── Spectral position (4 eigenvectors) ──
    for (let k = 0; k < SPECTRAL_DIMS; k++) {
      const eigIdx = Math.min(k + 1, n - 1); // skip trivial eigenvector 0
      features[row + col++] = eigen.vectors.data[i * n + eigIdx]!;
    }

    // ── Role one-hot (5) ──
    const roleVec = roleToOneHot(role ? role.role : "satellite");
    for (let k = 0; k < 5; k++) {
      features[row + col++] = roleVec[k]!;
    }
  }

  // Rank-normalize each feature column within this sample
  rankNormalize(features, n, dim);

  return {
    sampleId,
    n,
    features,
    adjacency: graph.adjacency.data,
  };
}

/**
 * Clustering coefficient for node i:
 * fraction of node i's neighbor pairs that are also connected.
 */
function clusteringCoefficient(
  i: number,
  n: number,
  A: Float64Array,
): number {
  // Find neighbors
  const neighbors: number[] = [];
  for (let j = 0; j < n; j++) {
    if (j !== i && A[i * n + j]! > 1e-12) neighbors.push(j);
  }
  const k = neighbors.length;
  if (k < 2) return 0;

  // Count edges among neighbors
  let triangles = 0;
  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      if (A[neighbors[a]! * n + neighbors[b]!]! > 1e-12) triangles++;
    }
  }

  return (2 * triangles) / (k * (k - 1));
}

/** Convert role string to 5D one-hot */
function roleToOneHot(role: string): number[] {
  const vec = [0, 0, 0, 0, 0];
  switch (role) {
    case "core":      vec[0] = 1; break;
    case "satellite": vec[1] = 1; break;
    case "bridge":    vec[2] = 1; break;
    case "scaffold":  vec[3] = 1; break;
    case "boundary":  vec[4] = 1; break;
  }
  return vec;
}

/**
 * Rank-normalize each column to [0, 1].
 * Rank normalization is robust to outliers and removes absolute scale.
 * Tied values receive the mean rank.
 */
function rankNormalize(
  data: Float64Array,
  rows: number,
  cols: number,
): void {
  for (let c = 0; c < cols; c++) {
    // Extract column values with original indices
    const indexed: { val: number; idx: number }[] = [];
    for (let r = 0; r < rows; r++) {
      indexed.push({ val: data[r * cols + c]!, idx: r });
    }
    indexed.sort((a, b) => a.val - b.val);

    // Assign ranks (0 to rows-1), averaging ties
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && Math.abs(indexed[j]!.val - indexed[i]!.val) < 1e-15) j++;
      const avgRank = (i + j - 1) / 2;
      for (let k = i; k < j; k++) {
        data[indexed[k]!.idx * cols + c] = rows > 1 ? avgRank / (rows - 1) : 0.5;
      }
      i = j;
    }
  }
}
