/**
 * Constraint Compatibility Tensor — v9 core.
 *
 * Fundamentally different from v1-v8: computes structure WITHIN each
 * sample independently, then compares distributions. No cross-sample
 * field or kernel needed.
 *
 * For each sample:
 *   1. Define edge compatibility ψ(i,j) between connected modules
 *      using intrinsic patch tensor distance (spectral, role, topology)
 *   2. For each triangle (i,j,k), compute curvature:
 *      Δ = |ψ(i,j) + ψ(j,k) - ψ(i,k)|
 *      This measures whether the triangle's edge compatibilities
 *      are consistent (flat) or inconsistent (curved)
 *   3. Build a curvature distribution P(Δ) over all triangles
 *
 * Then compare samples by comparing their curvature distributions.
 * Related individuals inherited the same constraint systems →
 * similar curvature distributions. Unrelated have independent
 * constraint structures → different distributions.
 *
 * This is second-order structure: relationships between relationships.
 */

import type { SamplePatches } from "./patch-tensor.js";
import { PATCH_DIM } from "./patch-tensor.js";

/** Number of histogram bins for curvature distribution */
const CURV_BINS = 40;

/** Curvature profile for a single sample */
export interface CurvatureProfile {
  /** Sample ID */
  readonly sampleId: string;
  /** Raw curvature values per triangle */
  readonly curvatures: readonly number[];
  /** Histogram of curvature distribution (normalized) */
  readonly histogram: Float64Array;
  /** CDF of curvature distribution */
  readonly cdf: Float64Array;
  /** Statistics */
  readonly mean: number;
  readonly std: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p90: number;
  readonly triangleCount: number;
  /** Edge compatibility stats */
  readonly edgeMean: number;
  readonly edgeStd: number;
}

/**
 * Compute intrinsic curvature profile for a sample.
 * No cross-sample information needed — purely self-contained.
 */
export function computeCurvatureProfile(
  patches: SamplePatches,
): CurvatureProfile {
  const n = patches.graphN;
  const A = patches.adjacency;

  // ── 1. Compute edge compatibility ψ(i,j) for all connected pairs ──
  // ψ = normalized patch tensor distance (captures spectral + role + topology)
  const psi = new Float64Array(n * n);
  const edgeValues: number[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (A[i * n + j]! < 1e-12) continue;
      const d = patchDistance(patches, i, j);
      psi[i * n + j] = d;
      psi[j * n + i] = d;
      edgeValues.push(d);
    }
  }

  // Normalize ψ by median edge distance (scale-invariant)
  const sortedEdges = [...edgeValues].sort((a, b) => a - b);
  const medianEdge = sortedEdges.length > 0
    ? sortedEdges[Math.floor(sortedEdges.length / 2)]!
    : 1;
  const scale = Math.max(medianEdge, 0.001);

  for (let idx = 0; idx < n * n; idx++) {
    psi[idx]! /= scale;
  }

  // Edge stats (after normalization)
  let edgeSum = 0, edgeSqSum = 0;
  for (const v of edgeValues) {
    const nv = v / scale;
    edgeSum += nv;
    edgeSqSum += nv * nv;
  }
  const edgeMean = edgeValues.length > 0 ? edgeSum / edgeValues.length : 0;
  const edgeVar = edgeValues.length > 1
    ? edgeSqSum / edgeValues.length - edgeMean * edgeMean
    : 0;
  const edgeStd = Math.sqrt(Math.max(edgeVar, 0));

  // ── 2. Find triangles and compute curvature Δ per triple ──
  const curvatures: number[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (A[i * n + j]! < 1e-12) continue;
      for (let k = j + 1; k < n; k++) {
        if (A[j * n + k]! < 1e-12) continue;
        if (A[i * n + k]! < 1e-12) continue;

        // Curvature: triangle inequality violation
        // Δ = |ψ(i,j) + ψ(j,k) - ψ(i,k)|
        // On a flat manifold, Δ = 0 (triangle inequality is tight)
        // On a curved manifold, Δ > 0
        const psiIJ = psi[i * n + j]!;
        const psiJK = psi[j * n + k]!;
        const psiIK = psi[i * n + k]!;

        // Three rotations of the triangle inequality
        const d1 = Math.abs(psiIJ + psiJK - psiIK);
        const d2 = Math.abs(psiIJ + psiIK - psiJK);
        const d3 = Math.abs(psiJK + psiIK - psiIJ);

        // Curvature = average violation across all three orientations
        curvatures.push((d1 + d2 + d3) / 3);
      }
    }
  }

  if (curvatures.length === 0) {
    return emptyCurvatureProfile(patches.sampleId);
  }

  // ── 3. Build normalized histogram ──
  const sorted = [...curvatures].sort((a, b) => a - b);
  const maxCurv = sorted[sorted.length - 1]! * 1.01; // Slight padding
  const histogram = new Float64Array(CURV_BINS);

  for (const c of curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * CURV_BINS), CURV_BINS - 1);
    histogram[bin]! += 1 / curvatures.length;
  }

  // CDF
  const cdf = new Float64Array(CURV_BINS);
  cdf[0] = histogram[0]!;
  for (let i = 1; i < CURV_BINS; i++) {
    cdf[i] = cdf[i - 1]! + histogram[i]!;
  }

  // Stats
  const mean = curvatures.reduce((s, v) => s + v, 0) / curvatures.length;
  const variance = curvatures.reduce((s, v) => s + (v - mean) ** 2, 0) / curvatures.length;
  const ct = curvatures.length;

  return {
    sampleId: patches.sampleId,
    curvatures,
    histogram,
    cdf,
    mean,
    std: Math.sqrt(variance),
    p25: sorted[Math.floor(ct * 0.25)]!,
    p50: sorted[Math.floor(ct * 0.50)]!,
    p75: sorted[Math.floor(ct * 0.75)]!,
    p90: sorted[Math.floor(ct * 0.90)]!,
    triangleCount: ct,
    edgeMean,
    edgeStd,
  };
}

/**
 * Compare two curvature profiles.
 * Returns a composite similarity score.
 */
export function compareCurvatureProfiles(
  a: CurvatureProfile,
  b: CurvatureProfile,
): { score: number; emd: number; bhattacharyya: number; statsSim: number; detail: string } {
  if (a.triangleCount < 3 || b.triangleCount < 3) {
    return { score: 0, emd: 1, bhattacharyya: 0, statsSim: 0, detail: "too few triangles" };
  }

  // ── 1. Earth Mover's Distance between CDFs ──
  // Requires common binning — re-bin both to common range
  const maxCurv = Math.max(
    a.curvatures.length > 0 ? a.curvatures[a.curvatures.length - 1]! : 1,
    b.curvatures.length > 0 ? b.curvatures[b.curvatures.length - 1]! : 1,
    0.01,
  );

  const cdfA = new Float64Array(CURV_BINS);
  const cdfB = new Float64Array(CURV_BINS);

  // Rebuild with common range
  for (const c of a.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * CURV_BINS), CURV_BINS - 1);
    cdfA[bin]! += 1 / a.triangleCount;
  }
  for (const c of b.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * CURV_BINS), CURV_BINS - 1);
    cdfB[bin]! += 1 / b.triangleCount;
  }

  // Convert to CDFs
  for (let i = 1; i < CURV_BINS; i++) {
    cdfA[i]! += cdfA[i - 1]!;
    cdfB[i]! += cdfB[i - 1]!;
  }

  // EMD = L1 distance between CDFs (normalized)
  let emd = 0;
  for (let i = 0; i < CURV_BINS; i++) {
    emd += Math.abs(cdfA[i]! - cdfB[i]!);
  }
  emd /= CURV_BINS;

  // ── 2. Bhattacharyya coefficient ──
  const histA = new Float64Array(CURV_BINS);
  const histB = new Float64Array(CURV_BINS);
  for (const c of a.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * CURV_BINS), CURV_BINS - 1);
    histA[bin]! += 1 / a.triangleCount;
  }
  for (const c of b.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * CURV_BINS), CURV_BINS - 1);
    histB[bin]! += 1 / b.triangleCount;
  }

  let bhattacharyya = 0;
  for (let i = 0; i < CURV_BINS; i++) {
    bhattacharyya += Math.sqrt(histA[i]! * histB[i]!);
  }

  // ── 3. Statistical similarity ──
  // Compare mean, std, and shape (p25/p50/p75 ratios)
  const meanSim = 1 / (1 + Math.abs(a.mean - b.mean));
  const stdSim = 1 / (1 + Math.abs(a.std - b.std));

  const shapeA = a.p50 > 0 ? a.p75 / a.p50 : 0;
  const shapeB = b.p50 > 0 ? b.p75 / b.p50 : 0;
  const shapeSim = 1 / (1 + Math.abs(shapeA - shapeB));

  const edgeSim = 1 / (1 + Math.abs(a.edgeMean - b.edgeMean));

  const statsSim = (meanSim + stdSim + shapeSim + edgeSim) / 4;

  // ── Composite ──
  const emdSim = 1 / (1 + emd * 5);
  const score = bhattacharyya * 0.40 + emdSim * 0.35 + statsSim * 0.25;

  return {
    score,
    emd,
    bhattacharyya,
    statsSim,
    detail: `BC=${bhattacharyya.toFixed(4)} EMD=${emd.toFixed(4)} stats=${statsSim.toFixed(4)} μA=${a.mean.toFixed(3)} μB=${b.mean.toFixed(3)} triA=${a.triangleCount} triB=${b.triangleCount}`,
  };
}

// ── Helpers ──

function patchDistance(patches: SamplePatches, i: number, j: number): number {
  let d2 = 0;
  for (let k = 0; k < PATCH_DIM; k++) {
    const diff = patches.patches[i]!.tensor[k]! - patches.patches[j]!.tensor[k]!;
    d2 += diff * diff;
  }
  return Math.sqrt(d2);
}

function emptyCurvatureProfile(sampleId: string): CurvatureProfile {
  return {
    sampleId,
    curvatures: [],
    histogram: new Float64Array(CURV_BINS),
    cdf: new Float64Array(CURV_BINS),
    mean: 0, std: 0, p25: 0, p50: 0, p75: 0, p90: 0,
    triangleCount: 0, edgeMean: 0, edgeStd: 0,
  };
}
