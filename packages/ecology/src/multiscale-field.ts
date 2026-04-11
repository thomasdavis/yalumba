/**
 * Multi-Scale Symbiogenetic Field Curvature (MS-SFC) — v5 core.
 *
 * v4 proved that coherence fields break the spouse confound.
 * v5 exploits the key insight: inheritance signal lies not in
 * absolute deformation magnitude, but in CONSISTENCY of deformation
 * across scales.
 *
 * For each pair (A, B):
 *   1. Extract patches at 3 radii (1-hop, 2-hop, 3-hop)
 *   2. Solve coherence field Φ^r at each radius r
 *   3. Measure scale consistency: do the fields agree?
 *   4. Measure curvature flow: do local spectral patterns agree across scales?
 *   5. Measure cooperative entropy: how directed is the field?
 *
 * Relatives → consistent deformation across scales (shared constraints)
 * Unrelated → scale-dependent incoherence (no shared constraints)
 */

import type { InteractionGraph, ModuleRole } from "./types.js";
import { normalizedLaplacian, eigenDecomposition } from "./laplacian.js";

/** Patch radii (hops) */
const SCALES = [1, 2, 3] as const;

/** Max patch nodes per scale */
const MAX_PATCH_NODES = [20, 40, 60] as const;

/** Local spectrum size per patch */
const LOCAL_SPEC = 6;

/** Patch tensor dim: 6 spectrum + 5 role + 2 stats = 13 */
const PDIM = 13;

// ── Types ──

export interface MultiScalePatches {
  readonly sampleId: string;
  readonly n: number;
  /** patches[scale][moduleIndex] = Float64Array of PDIM */
  readonly patchTensors: readonly Float64Array[][];
  readonly adjacency: Float64Array;
  readonly graphN: number;
}

export interface MultiScaleFieldResult {
  readonly score: number;
  /** Consistency of Φ across scales (higher = more consistent) */
  readonly scaleConsistency: number;
  /** Curvature flow consistency (higher = curvature agrees across scales) */
  readonly curvatureConsistency: number;
  /** Cooperative stability (averaged across scales) */
  readonly cooperativeStability: number;
  /** Distortion (averaged across scales, minor regularizer) */
  readonly distortion: number;
  readonly detail: string;
}

// ── Patch extraction ──

/**
 * Extract multi-scale patches for all modules.
 */
export function extractMultiScalePatches(
  sampleId: string,
  graph: InteractionGraph,
  roles: readonly ModuleRole[],
): MultiScalePatches {
  const n = graph.n;
  const A = graph.adjacency.data;

  const patchTensors: Float64Array[][] = [];
  for (let si = 0; si < SCALES.length; si++) {
    patchTensors.push([]);
  }

  for (let center = 0; center < n; center++) {
    // BFS to collect neighbourhoods at each radius
    const byHop: Set<number>[] = [new Set([center])];
    for (let hop = 1; hop <= 3; hop++) {
      const prev = byHop[hop - 1]!;
      const next = new Set<number>(prev);
      for (const node of prev) {
        for (let j = 0; j < n; j++) {
          if (!next.has(j) && A[node * n + j]! > 1e-12) next.add(j);
        }
      }
      byHop.push(next);
    }

    // Extract patch tensor at each scale
    for (let si = 0; si < SCALES.length; si++) {
      const radius = SCALES[si]!;
      const maxNodes = MAX_PATCH_NODES[si]!;
      const members = [...byHop[radius]!];
      const capped = members.length <= maxNodes ? members : members.slice(0, maxNodes);
      const tensor = buildPatchTensor(center, capped, n, A, roles);
      patchTensors[si]!.push(tensor);
    }
  }

  return { sampleId, n, patchTensors, adjacency: graph.adjacency.data, graphN: n };
}

/**
 * Build a single patch tensor from a set of members.
 */
function buildPatchTensor(
  _center: number,
  members: number[],
  graphN: number,
  A: Float64Array,
  roles: readonly ModuleRole[],
): Float64Array {
  const ps = members.length;
  const tensor = new Float64Array(PDIM);

  if (ps < 2) {
    // Degenerate: isolated node
    tensor.fill(0);
    tensor[PDIM - 1] = 0; // density = 0
    return tensor;
  }

  // Local subgraph adjacency
  const localAdj = new Float64Array(ps * ps);
  for (let li = 0; li < ps; li++) {
    for (let lj = 0; lj < ps; lj++) {
      localAdj[li * ps + lj] = A[members[li]! * graphN + members[lj]!]!;
    }
  }

  // Local spectrum (first LOCAL_SPEC non-trivial eigenvalues)
  if (ps >= 3) {
    const L = normalizedLaplacian({ data: localAdj, rows: ps, cols: ps });
    const eigen = eigenDecomposition(L);
    for (let k = 0; k < LOCAL_SPEC; k++) {
      const idx = Math.min(k + 1, eigen.values.length - 1);
      tensor[k] = idx >= 0 ? eigen.values[idx]! : 1.0;
    }
  }

  // Role composition
  const roleCounts = [0, 0, 0, 0, 0];
  for (const mi of members) {
    const role = roles[mi];
    if (!role) continue;
    switch (role.role) {
      case "core": roleCounts[0]!++; break;
      case "satellite": roleCounts[1]!++; break;
      case "bridge": roleCounts[2]!++; break;
      case "scaffold": roleCounts[3]!++; break;
      case "boundary": roleCounts[4]!++; break;
    }
  }
  for (let r = 0; r < 5; r++) {
    tensor[LOCAL_SPEC + r] = roleCounts[r]! / ps;
  }

  // Density
  let edges = 0;
  for (let li = 0; li < ps; li++) {
    for (let lj = li + 1; lj < ps; lj++) {
      if (localAdj[li * ps + lj]! > 1e-12) edges++;
    }
  }
  tensor[LOCAL_SPEC + 5] = (2 * edges) / (ps * (ps - 1));

  // Relative size
  tensor[LOCAL_SPEC + 6] = ps / Math.max(graphN, 1);

  return tensor;
}

// ── Multi-scale coherence field ──

/**
 * Solve multi-scale coherence fields and score.
 */
export function solveMultiScaleField(
  a: MultiScalePatches,
  b: MultiScalePatches,
): MultiScaleFieldResult {
  if (a.n === 0 || b.n === 0) {
    return { score: 0, scaleConsistency: 0, curvatureConsistency: 0,
             cooperativeStability: 0, distortion: 1, detail: "empty" };
  }

  const nA = a.n;
  const nB = b.n;
  const nScales = SCALES.length;

  // ── Solve field at each scale ──
  const fields: Float64Array[] = [];       // Φ^r: nA × PDIM per scale
  const distortions: number[] = [];
  const stabilities: number[] = [];
  const curvatures: number[] = [];

  for (let si = 0; si < nScales; si++) {
    const tensorsA = a.patchTensors[si]!;
    const tensorsB = b.patchTensors[si]!;

    // Kernel matrix
    const K = patchKernel(tensorsA, tensorsB, nA, nB);

    // Solve Φ
    const phi = kernelRegression(K, tensorsB, nA, nB);
    fields.push(phi);

    // Per-scale distortion
    distortions.push(measureDistortionMS(phi, a, b, tensorsB));

    // Per-scale stability
    stabilities.push(measureStabilityMS(phi, a));

    // Per-scale curvature
    curvatures.push(measureCurvatureMS(phi, tensorsA, tensorsB, nA, nB));
  }

  // ── Scale consistency: do the fields agree? ──
  // For each module in A, compare where Φ¹, Φ², Φ³ map it.
  // Low variance = consistent across scales = related.
  let totalVariance = 0;
  for (let i = 0; i < nA; i++) {
    // Centroid of Φ^r(i) across scales
    const centroid = new Float64Array(PDIM);
    for (let si = 0; si < nScales; si++) {
      for (let k = 0; k < PDIM; k++) {
        centroid[k]! += fields[si]![i * PDIM + k]! / nScales;
      }
    }
    // Variance from centroid
    let v = 0;
    for (let si = 0; si < nScales; si++) {
      for (let k = 0; k < PDIM; k++) {
        const diff = fields[si]![i * PDIM + k]! - centroid[k]!;
        v += diff * diff;
      }
    }
    totalVariance += v / (nScales * PDIM);
  }
  const meanVariance = totalVariance / nA;
  // Transform: high consistency = low variance
  const scaleConsistency = Math.exp(-meanVariance * 10);

  // ── Curvature flow consistency ──
  // Do curvature patterns agree across scales?
  let curvatureFlow = 0;
  for (let si = 0; si < nScales - 1; si++) {
    curvatureFlow += Math.abs(curvatures[si]! - curvatures[si + 1]!);
  }
  const curvatureConsistency = Math.exp(-curvatureFlow * 5);

  // ── Average cooperative stability ──
  let avgStability = 0;
  for (const s of stabilities) avgStability += s;
  avgStability /= nScales;

  // ── Average distortion ──
  let avgDistortion = 0;
  for (const d of distortions) avgDistortion += d;
  avgDistortion /= nScales;

  // ── Composite: stability consistency dominates ──
  const score =
    0.45 * scaleConsistency +
    0.25 * curvatureConsistency +
    0.20 * avgStability +
    0.10 * (1 - avgDistortion);

  return {
    score,
    scaleConsistency,
    curvatureConsistency,
    cooperativeStability: avgStability,
    distortion: avgDistortion,
    detail: `SC=${scaleConsistency.toFixed(4)} CC=${curvatureConsistency.toFixed(4)} S=${avgStability.toFixed(4)} D=${avgDistortion.toFixed(4)}`,
  };
}

// ── Internal helpers ──

function patchKernel(
  tensorsA: readonly Float64Array[],
  tensorsB: readonly Float64Array[],
  nA: number,
  nB: number,
): Float64Array {
  const K = new Float64Array(nA * nB);
  const distances: number[] = [];

  for (let i = 0; i < nA; i++) {
    const tA = tensorsA[i]!;
    for (let j = 0; j < nB; j++) {
      const tB = tensorsB[j]!;
      let d2 = 0;
      for (let k = 0; k < PDIM; k++) {
        const diff = tA[k]! - tB[k]!;
        d2 += diff * diff;
      }
      const d = Math.sqrt(d2);
      K[i * nB + j] = d;
      distances.push(d);
    }
  }

  // Median bandwidth
  distances.sort((a, b) => a - b);
  const sigma = Math.max(distances[Math.floor(distances.length / 2)] ?? 1, 0.01);

  for (let idx = 0; idx < nA * nB; idx++) {
    K[idx] = Math.exp(-(K[idx]! * K[idx]!) / (2 * sigma * sigma));
  }

  return K;
}

function kernelRegression(
  K: Float64Array,
  tensorsB: readonly Float64Array[],
  nA: number,
  nB: number,
): Float64Array {
  const phi = new Float64Array(nA * PDIM);

  for (let i = 0; i < nA; i++) {
    let wSum = 0;
    for (let j = 0; j < nB; j++) wSum += K[i * nB + j]!;
    if (wSum < 1e-15) continue;
    for (let j = 0; j < nB; j++) {
      const w = K[i * nB + j]! / wSum;
      const tB = tensorsB[j]!;
      for (let k = 0; k < PDIM; k++) {
        phi[i * PDIM + k]! += w * tB[k]!;
      }
    }
  }

  return phi;
}

function measureDistortionMS(
  phi: Float64Array,
  a: MultiScalePatches,
  b: MultiScalePatches,
  tensorsB: readonly Float64Array[],
): number {
  const nA = a.n;
  const nB = b.n;
  const A_adj = a.adjacency;
  const B_adj = b.adjacency;
  const gA = a.graphN;
  const gB = b.graphN;

  // Map each A-module to nearest B-module under Φ
  const nearestB = new Int32Array(nA);
  for (let i = 0; i < nA; i++) {
    let best = Infinity;
    let bestJ = 0;
    for (let j = 0; j < nB; j++) {
      let d2 = 0;
      for (let k = 0; k < PDIM; k++) {
        const diff = phi[i * PDIM + k]! - tensorsB[j]![k]!;
        d2 += diff * diff;
      }
      if (d2 < best) { best = d2; bestJ = j; }
    }
    nearestB[i] = bestJ;
  }

  let total = 0, preserved = 0;
  for (let i = 0; i < nA; i++) {
    for (let j = i + 1; j < nA; j++) {
      if (A_adj[i * gA + j]! < 1e-12) continue;
      total++;
      const bi = nearestB[i]!;
      const bj = nearestB[j]!;
      if (bi === bj || B_adj[bi * gB + bj]! > 1e-12) preserved++;
    }
  }
  return total > 0 ? 1 - preserved / total : 1;
}

function measureStabilityMS(
  phi: Float64Array,
  a: MultiScalePatches,
): number {
  const nA = a.n;
  const A_adj = a.adjacency;
  const gN = a.graphN;
  const edgeDists: number[] = [];

  for (let i = 0; i < nA; i++) {
    for (let j = i + 1; j < nA; j++) {
      if (A_adj[i * gN + j]! < 1e-12) continue;
      let d2 = 0;
      for (let k = 0; k < PDIM; k++) {
        const diff = phi[i * PDIM + k]! - phi[j * PDIM + k]!;
        d2 += diff * diff;
      }
      edgeDists.push(Math.sqrt(d2));
    }
  }

  if (edgeDists.length < 2) return 0;
  let sum = 0;
  for (const d of edgeDists) sum += d;
  const mean = sum / edgeDists.length;
  let varSum = 0;
  for (const d of edgeDists) varSum += (d - mean) * (d - mean);
  const cv = mean > 1e-12 ? Math.sqrt(varSum / edgeDists.length) / mean : 1;
  return Math.exp(-cv);
}

function measureCurvatureMS(
  phi: Float64Array,
  tensorsA: readonly Float64Array[],
  tensorsB: readonly Float64Array[],
  nA: number,
  nB: number,
): number {
  let totalMismatch = 0;
  for (let i = 0; i < nA; i++) {
    let bestDist = Infinity;
    let bestJ = 0;
    for (let j = 0; j < nB; j++) {
      let d2 = 0;
      for (let k = 0; k < PDIM; k++) {
        const diff = phi[i * PDIM + k]! - tensorsB[j]![k]!;
        d2 += diff * diff;
      }
      if (d2 < bestDist) { bestDist = d2; bestJ = j; }
    }
    // Compare spectra (first LOCAL_SPEC dims)
    let specDist = 0;
    for (let k = 0; k < LOCAL_SPEC; k++) {
      const d = tensorsA[i]![k]! - tensorsB[bestJ]![k]!;
      specDist += d * d;
    }
    totalMismatch += Math.sqrt(specDist);
  }
  return Math.min(totalMismatch / nA / 2.0, 1.0);
}
