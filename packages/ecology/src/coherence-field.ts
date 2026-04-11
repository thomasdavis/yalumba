/**
 * Symbiogenetic Coherence Field (SCF) solver.
 *
 * The core of v4: instead of matching individual modules, compute
 * a continuous transformation Φ: M_A → M_B that maps every module
 * in sample A into the ecosystem of sample B.
 *
 * Φ is constructed via kernel regression:
 *   Φ(i) = Σ_j K(patch_i, patch_j) * position_j / Σ_j K(patch_i, patch_j)
 *
 * where K is a Gaussian kernel over patch tensors, and position_j
 * is the spectral embedding coordinate of module j in B.
 *
 * The quality of the mapping is measured by THREE scores:
 *
 * 1. DISTORTION ENERGY: does Φ preserve neighbourhood structure?
 *    E = Σ_i Σ_{j∈N(i)} ||Φ(j) - nearest_B_to_Φ(i)||
 *    Low distortion = neighbourhoods map coherently = related.
 *
 * 2. CURVATURE MISMATCH: do mapped patches have similar local spectra?
 *    Compare patch tensors of i in A with the patch at Φ(i) in B.
 *
 * 3. COOPERATIVE STABILITY: is the field smooth or erratic?
 *    Measure variance of Φ's local behaviour. Smooth = coherent
 *    deformation. Erratic = no consistent correspondence.
 */

import type { SamplePatches } from "./patch-tensor.js";
import { PATCH_DIM } from "./patch-tensor.js";

/** Result of coherence field analysis */
export interface CoherenceFieldResult {
  /** Combined symbiogenetic coherence score (higher = more coherent) */
  readonly score: number;
  /** Distortion energy (lower = more coherent). Normalized to [0, 1]. */
  readonly distortion: number;
  /** Curvature mismatch (lower = more similar patch structure) */
  readonly curvatureMismatch: number;
  /** Cooperative stability (higher = smoother field) */
  readonly cooperativeStability: number;
  /** Detail string */
  readonly detail: string;
}

/**
 * Solve the coherence field Φ: A → B and score it.
 */
export function solveCoherenceField(
  a: SamplePatches,
  b: SamplePatches,
): CoherenceFieldResult {
  if (a.n === 0 || b.n === 0) {
    return { score: 0, distortion: 1, curvatureMismatch: 1,
             cooperativeStability: 0, detail: "empty" };
  }

  // ── Step 1: Compute patch-to-patch kernel matrix ──
  // K[i][j] = exp(-||tensor_A_i - tensor_B_j||² / (2σ²))
  const K = computePatchKernel(a, b);

  // ── Step 2: Solve Φ via kernel regression ──
  // Φ maps each A-module to a position in B's patch-tensor space
  // Φ(i) = Σ_j K(i,j) * tensor_B_j / Σ_j K(i,j)
  const phi = solveFieldMapping(K, a.n, b);

  // ── Step 3: Measure distortion energy ──
  const distortion = measureDistortion(phi, a, b, K);

  // ── Step 4: Measure curvature mismatch ──
  const curvatureMismatch = measureCurvatureMismatch(phi, a, b, K);

  // ── Step 5: Measure cooperative stability ──
  const cooperativeStability = measureCooperativeStability(phi, a);

  // ── Combine into coherence score ──
  // Higher = more coherent = more likely related
  const score = 0.40 * (1 - distortion)
              + 0.35 * (1 - curvatureMismatch)
              + 0.25 * cooperativeStability;

  return {
    score,
    distortion,
    curvatureMismatch,
    cooperativeStability,
    detail: `D=${distortion.toFixed(4)} C=${curvatureMismatch.toFixed(4)} S=${cooperativeStability.toFixed(4)}`,
  };
}

// ── Kernel computation ──

/**
 * Compute Gaussian kernel between all A-patches and B-patches.
 * Auto-scaled bandwidth from median distance.
 */
function computePatchKernel(
  a: SamplePatches,
  b: SamplePatches,
): Float64Array {
  const nA = a.n;
  const nB = b.n;
  const K = new Float64Array(nA * nB);

  // Compute all pairwise distances
  const distances = new Float64Array(nA * nB);
  for (let i = 0; i < nA; i++) {
    const tA = a.patches[i]!.tensor;
    for (let j = 0; j < nB; j++) {
      const tB = b.patches[j]!.tensor;
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = tA[k]! - tB[k]!;
        d2 += diff * diff;
      }
      distances[i * nB + j] = Math.sqrt(d2);
    }
  }

  // Auto-scale bandwidth: median distance
  const sampled: number[] = [];
  const step = Math.max(1, Math.floor((nA * nB) / 5000));
  for (let idx = 0; idx < nA * nB; idx += step) {
    if (distances[idx]! > 1e-12) sampled.push(distances[idx]!);
  }
  sampled.sort((a, b) => a - b);
  const sigma = Math.max(sampled[Math.floor(sampled.length / 2)] ?? 1, 0.01);

  // Compute kernel
  for (let i = 0; i < nA * nB; i++) {
    K[i] = Math.exp(-(distances[i]! * distances[i]!) / (2 * sigma * sigma));
  }

  return K;
}

// ── Field mapping ──

/**
 * Solve Φ via kernel regression.
 * Φ(i) maps A-module i to a point in B's patch tensor space.
 * Returns nA × PATCH_DIM matrix of mapped positions.
 */
function solveFieldMapping(
  K: Float64Array,
  nA: number,
  b: SamplePatches,
): Float64Array {
  const nB = b.n;
  const phi = new Float64Array(nA * PATCH_DIM);

  for (let i = 0; i < nA; i++) {
    // Weighted sum of B patch tensors
    let weightSum = 0;
    for (let j = 0; j < nB; j++) {
      weightSum += K[i * nB + j]!;
    }
    if (weightSum < 1e-15) continue;

    for (let j = 0; j < nB; j++) {
      const w = K[i * nB + j]! / weightSum;
      const tB = b.patches[j]!.tensor;
      for (let k = 0; k < PATCH_DIM; k++) {
        phi[i * PATCH_DIM + k]! += w * tB[k]!;
      }
    }
  }

  return phi;
}

// ── Distortion energy ──

/**
 * Measure how much Φ distorts neighbourhood structure.
 *
 * For each A-module i with neighbour j:
 *   - Φ maps i to some point in B-space
 *   - Φ maps j to some point in B-space
 *   - Find the B-module closest to Φ(i) and the B-module closest to Φ(j)
 *   - If those B-modules are also neighbours, distortion is low
 *
 * Returns normalized distortion in [0, 1]. Lower = more coherent.
 */
function measureDistortion(
  phi: Float64Array,
  a: SamplePatches,
  b: SamplePatches,
  _K: Float64Array,
): number {
  const nA = a.n;
  const nB = b.n;
  const A_adj = a.adjacency;
  const B_adj = b.adjacency;
  const gN_A = a.graphN;
  const gN_B = b.graphN;

  // For each A-module, find nearest B-module to Φ(i)
  const nearestB = new Int32Array(nA);
  for (let i = 0; i < nA; i++) {
    let bestDist = Infinity;
    let bestJ = 0;
    for (let j = 0; j < nB; j++) {
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = phi[i * PATCH_DIM + k]! - b.patches[j]!.tensor[k]!;
        d2 += diff * diff;
      }
      if (d2 < bestDist) {
        bestDist = d2;
        bestJ = j;
      }
    }
    nearestB[i] = bestJ;
  }

  // Measure neighbourhood preservation
  let totalPairs = 0;
  let preservedPairs = 0;

  for (let i = 0; i < nA; i++) {
    for (let j = i + 1; j < nA; j++) {
      // Are i and j neighbours in A?
      if (A_adj[i * gN_A + j]! < 1e-12) continue;
      totalPairs++;

      // Are nearestB[i] and nearestB[j] neighbours in B?
      const bi = nearestB[i]!;
      const bj = nearestB[j]!;
      if (bi === bj || B_adj[bi * gN_B + bj]! > 1e-12) {
        preservedPairs++;
      }
    }
  }

  if (totalPairs === 0) return 1;
  return 1 - preservedPairs / totalPairs;
}

// ── Curvature mismatch ──

/**
 * Compare the local spectral structure at Φ(i) with the structure at i.
 *
 * For each A-module i, find its nearest B-module under Φ,
 * then compare their patch tensors. The first 8 dimensions are
 * local Laplacian eigenvalues — this IS the local curvature.
 */
function measureCurvatureMismatch(
  phi: Float64Array,
  a: SamplePatches,
  b: SamplePatches,
  _K: Float64Array,
): number {
  const nA = a.n;
  const nB = b.n;
  let totalMismatch = 0;

  for (let i = 0; i < nA; i++) {
    // Find nearest B-patch to Φ(i)
    let bestDist = Infinity;
    let bestJ = 0;
    for (let j = 0; j < nB; j++) {
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = phi[i * PATCH_DIM + k]! - b.patches[j]!.tensor[k]!;
        d2 += diff * diff;
      }
      if (d2 < bestDist) {
        bestDist = d2;
        bestJ = j;
      }
    }

    // Compare local spectra (first 8 dims of patch tensor)
    const patchA = a.patches[i]!.tensor;
    const patchB = b.patches[bestJ]!.tensor;
    let specDist = 0;
    for (let k = 0; k < 8; k++) {
      const d = patchA[k]! - patchB[k]!;
      specDist += d * d;
    }
    totalMismatch += Math.sqrt(specDist);
  }

  // Normalize: divide by nA and by typical spectral range (~2.0)
  const raw = totalMismatch / nA;
  return Math.min(raw / 2.0, 1.0);
}

// ── Cooperative stability ──

/**
 * Measure smoothness of the coherence field.
 *
 * If Φ is a coherent deformation, nearby modules in A should map to
 * nearby positions in B-space. Measure the variance of Φ's "gradient":
 * for each A-edge (i,j), compute ||Φ(i) - Φ(j)||.
 *
 * Low variance = smooth, cooperative field = related.
 * High variance = erratic, inconsistent mapping = unrelated.
 *
 * Returns value in [0, 1]. Higher = more stable/smooth.
 */
function measureCooperativeStability(
  phi: Float64Array,
  a: SamplePatches,
): number {
  const nA = a.n;
  const A_adj = a.adjacency;
  const gN = a.graphN;

  const edgeDistances: number[] = [];

  for (let i = 0; i < nA; i++) {
    for (let j = i + 1; j < nA; j++) {
      if (A_adj[i * gN + j]! < 1e-12) continue;

      // Distance between Φ(i) and Φ(j) in B-space
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = phi[i * PATCH_DIM + k]! - phi[j * PATCH_DIM + k]!;
        d2 += diff * diff;
      }
      edgeDistances.push(Math.sqrt(d2));
    }
  }

  if (edgeDistances.length < 2) return 0;

  // Compute coefficient of variation (std / mean)
  let sum = 0;
  for (const d of edgeDistances) sum += d;
  const mean = sum / edgeDistances.length;

  let varSum = 0;
  for (const d of edgeDistances) {
    const diff = d - mean;
    varSum += diff * diff;
  }
  const std = Math.sqrt(varSum / edgeDistances.length);
  const cv = mean > 1e-12 ? std / mean : 1;

  // Low CV = smooth field = high stability
  // Transform: stability = exp(-cv) so high CV → low stability
  return Math.exp(-cv);
}
