/**
 * Holonomy-based curvature invariants — v2.
 *
 * Three fixes from v1:
 *
 * 1. TOP-K TRANSPORT: Use only the 5 nearest target modules for
 *    mapping (not full Gaussian kernel). Sharp transport produces
 *    discriminative holonomy; diffuse transport washes out signal.
 *
 * 2. SELF-CURVATURE BASELINE: Compute holonomy for A's triangles
 *    mapped through A itself (A-via-A). Then compare:
 *      score = similarity(A-via-B curvature, A-via-A curvature)
 *    Related pairs: A-via-B ≈ A-via-A (inherited structure preserves local geometry)
 *    Unrelated: A-via-B ≠ A-via-A (random structure disrupts geometry)
 *    This deconfounds graph density (bigger graphs have more triangles
 *    but self-curvature normalizes for that).
 *
 * 3. EARTH MOVER'S DISTANCE for distribution comparison.
 *    EMD captures shift in the curvature distribution, not just overlap.
 */

import type { SamplePatches } from "./patch-tensor.js";
import { PATCH_DIM } from "./patch-tensor.js";

const TOP_K = 5; // Only use 5 nearest neighbors for transport

/** A triangle in the module graph */
interface Triangle {
  readonly i: number;
  readonly j: number;
  readonly k: number;
}

/** Curvature distribution for a sample pair */
export interface HolonomyResult {
  readonly curvatures: readonly number[];
  readonly meanCurvature: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p90: number;
  readonly triangleCount: number;
}

/**
 * Find all triangles in the module graph.
 */
export function findTriangles(patches: SamplePatches): Triangle[] {
  const n = patches.graphN;
  const A = patches.adjacency;
  const triangles: Triangle[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (A[i * n + j]! < 1e-12) continue;
      for (let k = j + 1; k < n; k++) {
        if (A[j * n + k]! < 1e-12) continue;
        if (A[i * n + k]! < 1e-12) continue;
        triangles.push({ i, j, k });
      }
    }
  }

  return triangles;
}

/**
 * Compute holonomy curvatures using TOP-K sharp transport.
 */
export function computeHolonomy(
  source: SamplePatches,
  target: SamplePatches,
  triangles: Triangle[],
): HolonomyResult {
  if (triangles.length === 0) {
    return { curvatures: [], meanCurvature: 0, p25: 0, p50: 0, p75: 0, p90: 0, triangleCount: 0 };
  }

  // Build top-k transport maps
  const fwdMap = buildTopKMap(source, target); // source[i] → target space
  const revMap = buildTopKMap(target, source); // target[j] → source space

  const curvatures: number[] = [];

  for (const tri of triangles) {
    // Transport around triangle: i → target → back to see if we land near j
    const holIJ = edgeHolonomy(tri.i, tri.j, source, target, fwdMap, revMap);
    const holJK = edgeHolonomy(tri.j, tri.k, source, target, fwdMap, revMap);
    const holKI = edgeHolonomy(tri.k, tri.i, source, target, fwdMap, revMap);

    curvatures.push((holIJ + holJK + holKI) / 3);
  }

  const sorted = [...curvatures].sort((a, b) => a - b);
  const n = sorted.length;

  return {
    curvatures,
    meanCurvature: curvatures.reduce((s, v) => s + v, 0) / n,
    p25: sorted[Math.floor(n * 0.25)]!,
    p50: sorted[Math.floor(n * 0.50)]!,
    p75: sorted[Math.floor(n * 0.75)]!,
    p90: sorted[Math.floor(n * 0.90)]!,
    triangleCount: n,
  };
}

/**
 * Compare curvature distributions via EMD (Earth Mover's Distance).
 * Returns similarity = 1 / (1 + EMD).
 */
export function compareCurvatureDistributions(
  holA: HolonomyResult,
  holB: HolonomyResult,
): number {
  if (holA.triangleCount < 3 || holB.triangleCount < 3) return 0;

  // Build CDFs from sorted curvatures
  const BINS = 30;
  const maxCurv = Math.max(
    holA.curvatures.length > 0 ? Math.max(...holA.curvatures) : 1,
    holB.curvatures.length > 0 ? Math.max(...holB.curvatures) : 1,
    0.01,
  );

  const cdfA = new Float64Array(BINS);
  const cdfB = new Float64Array(BINS);

  for (const c of holA.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * BINS), BINS - 1);
    cdfA[bin]! += 1 / holA.triangleCount;
  }
  for (const c of holB.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * BINS), BINS - 1);
    cdfB[bin]! += 1 / holB.triangleCount;
  }

  // Convert to CDFs
  for (let i = 1; i < BINS; i++) {
    cdfA[i]! += cdfA[i - 1]!;
    cdfB[i]! += cdfB[i - 1]!;
  }

  // EMD = sum of |CDF_A - CDF_B| (for 1D distributions)
  let emd = 0;
  for (let i = 0; i < BINS; i++) {
    emd += Math.abs(cdfA[i]! - cdfB[i]!);
  }
  emd /= BINS; // Normalize

  return 1 / (1 + emd * 10); // Scale so differences are visible
}

// ── Top-K transport map ──

interface TopKEntry {
  indices: Int32Array;
  weights: Float64Array;
}

function buildTopKMap(
  source: SamplePatches,
  target: SamplePatches,
): TopKEntry[] {
  const nS = source.n;
  const nT = target.n;
  const k = Math.min(TOP_K, nT);
  const map: TopKEntry[] = [];

  for (let i = 0; i < nS; i++) {
    // Find k nearest target modules by patch tensor distance
    const dists: { idx: number; dist: number }[] = [];
    for (let j = 0; j < nT; j++) {
      let d2 = 0;
      for (let dim = 0; dim < PATCH_DIM; dim++) {
        const diff = source.patches[i]!.tensor[dim]! - target.patches[j]!.tensor[dim]!;
        d2 += diff * diff;
      }
      dists.push({ idx: j, dist: Math.sqrt(d2) });
    }
    dists.sort((a, b) => a.dist - b.dist);

    const indices = new Int32Array(k);
    const weights = new Float64Array(k);

    // Softmax over top-k distances
    const topK = dists.slice(0, k);
    const minDist = topK[0]!.dist;
    let wSum = 0;
    for (let j = 0; j < k; j++) {
      weights[j] = Math.exp(-(topK[j]!.dist - minDist));
      indices[j] = topK[j]!.idx;
      wSum += weights[j]!;
    }
    for (let j = 0; j < k; j++) weights[j]! /= wSum;

    map.push({ indices, weights });
  }

  return map;
}

/** Compute per-edge holonomy: map source[i] through target and back, measure distance to source[j] */
function edgeHolonomy(
  i: number,
  j: number,
  source: SamplePatches,
  target: SamplePatches,
  fwdMap: TopKEntry[],
  revMap: TopKEntry[],
): number {
  // Map source[i] → target space
  const mapped = new Float64Array(PATCH_DIM);
  const fwd = fwdMap[i]!;
  for (let ki = 0; ki < fwd.indices.length; ki++) {
    const tIdx = fwd.indices[ki]!;
    const w = fwd.weights[ki]!;
    for (let d = 0; d < PATCH_DIM; d++) {
      mapped[d]! += w * target.patches[tIdx]!.tensor[d]!;
    }
  }

  // Find nearest target module to mapped position
  let bestDist = Infinity;
  let bestT = 0;
  for (let t = 0; t < target.n; t++) {
    let d2 = 0;
    for (let d = 0; d < PATCH_DIM; d++) {
      const diff = mapped[d]! - target.patches[t]!.tensor[d]!;
      d2 += diff * diff;
    }
    if (d2 < bestDist) { bestDist = d2; bestT = t; }
  }

  // Map target[bestT] back to source space
  const mappedBack = new Float64Array(PATCH_DIM);
  const rev = revMap[bestT]!;
  for (let ki = 0; ki < rev.indices.length; ki++) {
    const sIdx = rev.indices[ki]!;
    const w = rev.weights[ki]!;
    for (let d = 0; d < PATCH_DIM; d++) {
      mappedBack[d]! += w * source.patches[sIdx]!.tensor[d]!;
    }
  }

  // Distance from mapped-back to actual source[j]
  let d2 = 0;
  for (let d = 0; d < PATCH_DIM; d++) {
    const diff = mappedBack[d]! - source.patches[j]!.tensor[d]!;
    d2 += diff * diff;
  }
  return Math.sqrt(d2);
}
