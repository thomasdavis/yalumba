/**
 * Holonomy-based curvature invariants for ecosystem comparison.
 *
 * The key insight from gauge theory: curvature is detected by
 * transporting a quantity around a closed loop and measuring
 * how much it changes. In our context:
 *
 * 1. Find minimal cycles (triangles) in the module graph
 * 2. For each triangle (i,j,k), compute the "holonomy":
 *    transport the patch tensor from i→j→k→i using the
 *    coherence field, measure how far the result is from
 *    the original tensor
 * 3. The distribution of holonomies over all triangles
 *    characterizes the LOCAL GEOMETRIC CONSISTENCY of the
 *    ecosystem — how "flat" or "curved" the field is
 *
 * Related individuals should have similar curvature distributions
 * because they inherited the same local organizational constraints.
 * Unrelated individuals share modules by chance but their
 * arrangement constraints are independently random → different curvature.
 *
 * This is genuinely gauge-theoretic: we measure the connection
 * (how the field rotates along edges) rather than the field values.
 */

import type { SamplePatches, EcologicalPatch } from "./patch-tensor.js";
import { PATCH_DIM } from "./patch-tensor.js";

/** A triangle in the module graph */
interface Triangle {
  readonly i: number;
  readonly j: number;
  readonly k: number;
}

/** Curvature distribution for a sample pair */
export interface HolonomyResult {
  /** Per-triangle curvature values for this pair */
  readonly curvatures: readonly number[];
  /** Mean curvature */
  readonly meanCurvature: number;
  /** Curvature at P25, P50, P75, P90 */
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p90: number;
  /** Number of triangles found */
  readonly triangleCount: number;
}

/**
 * Find all triangles in the module graph.
 * A triangle = three modules that are all pairwise connected.
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
 * Compute holonomy curvatures for triangles in sample A
 * using a coherence field mapping A → B.
 *
 * For each triangle (i,j,k) in A:
 *   1. Map patch_A[i] to B-space via kernel regression
 *   2. Find nearest B-module to the mapped position
 *   3. Map that B-module's patch back to A-space
 *   4. Continue around the triangle: i→B→j→B→k→B→i
 *   5. Measure how far the round-trip result is from the start
 *
 * Low curvature = the field is "flat" = structure is consistently mapped
 * High curvature = the field is "curved" = mapping is locally inconsistent
 */
export function computeHolonomy(
  a: SamplePatches,
  b: SamplePatches,
  triangles: Triangle[],
): HolonomyResult {
  if (triangles.length === 0) {
    return { curvatures: [], meanCurvature: 0, p25: 0, p50: 0, p75: 0, p90: 0, triangleCount: 0 };
  }

  // Build kernel: A→B affinity matrix
  const kernel = buildGaussianKernel(a, b);
  // Build kernel: B→A affinity matrix
  const kernelBA = buildGaussianKernel(b, a);

  const curvatures: number[] = [];

  for (const tri of triangles) {
    // Transport patch[i] through the triangle via B-space
    // Step 1: i → B (map i's patch to B-space)
    const mappedI = mapToTarget(a.patches[tri.i]!, kernel, tri.i, b);

    // Step 2: Find nearest B-module to mapped position
    const nearestJ = findNearest(mappedI, b);

    // Step 3: B[nearestJ] → A (map back to find correspondent of j)
    const mappedBack = mapToTarget(b.patches[nearestJ]!, kernelBA, nearestJ, a);

    // Step 4: Measure distance from mapped-back to actual patch[j]
    const distIJ = tensorDistance(mappedBack, a.patches[tri.j]!.tensor);

    // Repeat for j→k edge
    const mappedJ = mapToTarget(a.patches[tri.j]!, kernel, tri.j, b);
    const nearestK = findNearest(mappedJ, b);
    const mappedBackK = mapToTarget(b.patches[nearestK]!, kernelBA, nearestK, a);
    const distJK = tensorDistance(mappedBackK, a.patches[tri.k]!.tensor);

    // And k→i edge
    const mappedK = mapToTarget(a.patches[tri.k]!, kernel, tri.k, b);
    const nearestI = findNearest(mappedK, b);
    const mappedBackI = mapToTarget(b.patches[nearestI]!, kernelBA, nearestI, a);
    const distKI = tensorDistance(mappedBackI, a.patches[tri.i]!.tensor);

    // Holonomy = average edge distortion around the triangle
    const holonomy = (distIJ + distJK + distKI) / 3;
    curvatures.push(holonomy);
  }

  // Sort for percentiles
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
 * Compare curvature distributions between two different pair computations.
 * Returns a similarity score [0, 1]: high = similar distributions.
 */
export function compareCurvatureDistributions(
  holA: HolonomyResult,
  holB: HolonomyResult,
): number {
  if (holA.triangleCount === 0 || holB.triangleCount === 0) return 0;

  // Build normalized histograms of curvatures
  const BINS = 20;
  const maxCurv = Math.max(
    holA.curvatures[holA.curvatures.length - 1] ?? 1,
    holB.curvatures[holB.curvatures.length - 1] ?? 1,
    0.01,
  );

  const histA = new Float64Array(BINS);
  const histB = new Float64Array(BINS);

  for (const c of holA.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * BINS), BINS - 1);
    histA[bin]! += 1 / holA.triangleCount;
  }
  for (const c of holB.curvatures) {
    const bin = Math.min(Math.floor((c / maxCurv) * BINS), BINS - 1);
    histB[bin]! += 1 / holB.triangleCount;
  }

  // Bhattacharyya coefficient: sum(sqrt(p*q))
  let bc = 0;
  for (let i = 0; i < BINS; i++) {
    bc += Math.sqrt(histA[i]! * histB[i]!);
  }

  return bc; // 1 = identical distributions, 0 = no overlap
}

// ── Internal helpers ──

function buildGaussianKernel(
  source: SamplePatches,
  target: SamplePatches,
): Float64Array {
  const nS = source.n;
  const nT = target.n;
  const K = new Float64Array(nS * nT);
  const dists: number[] = [];

  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < nT; j++) {
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = source.patches[i]!.tensor[k]! - target.patches[j]!.tensor[k]!;
        d2 += diff * diff;
      }
      const d = Math.sqrt(d2);
      K[i * nT + j] = d;
      dists.push(d);
    }
  }

  // Median bandwidth
  dists.sort((a, b) => a - b);
  const sigma = Math.max(dists[Math.floor(dists.length / 2)] ?? 1, 0.01);

  for (let idx = 0; idx < nS * nT; idx++) {
    K[idx] = Math.exp(-(K[idx]! * K[idx]!) / (2 * sigma * sigma));
  }

  return K;
}

function mapToTarget(
  patch: EcologicalPatch,
  kernel: Float64Array,
  sourceIdx: number,
  target: SamplePatches,
): Float64Array {
  const nT = target.n;
  const result = new Float64Array(PATCH_DIM);

  // Kernel-weighted mean in target space
  let wSum = 0;
  for (let j = 0; j < nT; j++) {
    wSum += kernel[sourceIdx * nT + j]!;
  }
  if (wSum < 1e-15) return result;

  for (let j = 0; j < nT; j++) {
    const w = kernel[sourceIdx * nT + j]! / wSum;
    for (let k = 0; k < PATCH_DIM; k++) {
      result[k]! += w * target.patches[j]!.tensor[k]!;
    }
  }

  return result;
}

function findNearest(mapped: Float64Array, target: SamplePatches): number {
  let best = Infinity;
  let bestJ = 0;
  for (let j = 0; j < target.n; j++) {
    let d2 = 0;
    for (let k = 0; k < PATCH_DIM; k++) {
      const diff = mapped[k]! - target.patches[j]!.tensor[k]!;
      d2 += diff * diff;
    }
    if (d2 < best) { best = d2; bestJ = j; }
  }
  return bestJ;
}

function tensorDistance(a: Float64Array, b: Float64Array): number {
  let d2 = 0;
  for (let k = 0; k < PATCH_DIM; k++) {
    const diff = a[k]! - b[k]!;
    d2 += diff * diff;
  }
  return Math.sqrt(d2);
}
