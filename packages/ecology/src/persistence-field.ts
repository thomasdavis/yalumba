/**
 * Symbiogenetic Persistence Field (SPF) — v6 core.
 *
 * Built on v4's coherence field (which had the best gap at -4.99%).
 * Adds three fixes for three diagnosed failure modes:
 *
 * 1. SYMMETRIZED FIELD: compute Φ(A→B) and Φ(B→A), measure agreement.
 *    Fixes: NA12891 outlier dominance (asymmetric fields let one
 *    sample's distinctive patches control the mapping direction).
 *
 * 2. PERTURBATION COHERENCE: perturb patches with edge noise, re-solve
 *    field, measure whether the mapping persists. Inherited structure
 *    should resist perturbation; random correspondence should not.
 *    Fixes: false positives from accidental structural similarity.
 *
 * 3. ROBUST AGGREGATION: trimmed mean over per-module scores, dropping
 *    top/bottom 10% of modules before aggregating.
 *    Fixes: single outlier modules dominating aggregate scores.
 *
 * Scoring weights commit to cooperative structure:
 *   0.30 perturbation coherence
 *   0.25 symmetry agreement
 *   0.25 cooperative stability
 *   0.10 curvature mismatch
 *   0.10 distortion
 */

import type { SamplePatches } from "./patch-tensor.js";
import { PATCH_DIM } from "./patch-tensor.js";

/** Number of perturbation trials */
const NUM_PERTURBATIONS = 5;

/** Edge noise magnitude (fraction of edges to perturb) */
const NOISE_FRACTION = 0.10;

/** Trimmed mean: drop this fraction from each tail */
const TRIM_FRACTION = 0.10;

/** v6 result */
export interface PersistenceFieldResult {
  readonly score: number;
  readonly perturbationCoherence: number;
  readonly symmetryAgreement: number;
  readonly cooperativeStability: number;
  readonly curvatureMismatch: number;
  readonly distortion: number;
  readonly detail: string;
}

/**
 * Compute v6 persistence field score for a pair.
 */
export function solvePersistenceField(
  a: SamplePatches,
  b: SamplePatches,
  seed: number = 42,
): PersistenceFieldResult {
  if (a.n === 0 || b.n === 0) {
    return { score: 0, perturbationCoherence: 0, symmetryAgreement: 0,
             cooperativeStability: 0, curvatureMismatch: 1, distortion: 1,
             detail: "empty" };
  }

  // ── 1. Solve base fields in BOTH directions ──
  const kernelAB = computeKernel(a, b);
  const kernelBA = computeKernel(b, a);
  const phiAB = solveField(kernelAB, a.n, b);
  const phiBA = solveField(kernelBA, b.n, a);

  // ── 2. Base metrics (A→B direction) ──
  const distortion = robustDistortion(phiAB, a, b);
  const curvature = robustCurvature(phiAB, a, b);
  const stability = robustStability(phiAB, a);

  // ── 3. Symmetry agreement ──
  // How well do the two directions agree?
  // For each A-module i, Φ_AB maps i to some position in B-space.
  // For the nearest B-module j to Φ_AB(i), Φ_BA should map j back near i.
  const symmetryAgreement = measureSymmetry(phiAB, phiBA, a, b);

  // ── 4. Perturbation coherence ──
  // Perturb patches, re-solve field, measure persistence
  const perturbationCoherence = measurePerturbationCoherence(
    a, b, phiAB, seed,
  );

  // ── 5. Composite score ──
  const score =
    0.30 * perturbationCoherence +
    0.25 * symmetryAgreement +
    0.25 * stability +
    0.10 * (1 - curvature) +
    0.10 * (1 - distortion);

  return {
    score,
    perturbationCoherence,
    symmetryAgreement,
    cooperativeStability: stability,
    curvatureMismatch: curvature,
    distortion,
    detail: `PC=${perturbationCoherence.toFixed(4)} SYM=${symmetryAgreement.toFixed(4)} S=${stability.toFixed(4)} C=${curvature.toFixed(4)} D=${distortion.toFixed(4)}`,
  };
}

// ── Kernel and field solving ──

function computeKernel(
  a: SamplePatches,
  b: SamplePatches,
): Float64Array {
  const nA = a.n;
  const K = new Float64Array(nA * b.n);

  // Compute distances
  const dists: number[] = [];
  for (let i = 0; i < nA; i++) {
    const tA = a.patches[i]!.tensor;
    for (let j = 0; j < b.n; j++) {
      const tB = b.patches[j]!.tensor;
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = tA[k]! - tB[k]!;
        d2 += diff * diff;
      }
      const d = Math.sqrt(d2);
      K[i * b.n + j] = d;
      dists.push(d);
    }
  }

  // Median bandwidth
  dists.sort((a, b) => a - b);
  const sigma = Math.max(dists[Math.floor(dists.length / 2)] ?? 1, 0.01);

  for (let idx = 0; idx < nA * b.n; idx++) {
    K[idx] = Math.exp(-(K[idx]! * K[idx]!) / (2 * sigma * sigma));
  }

  return K;
}

function solveField(
  K: Float64Array,
  nA: number,
  b: SamplePatches,
): Float64Array {
  const phi = new Float64Array(nA * PATCH_DIM);

  for (let i = 0; i < nA; i++) {
    let wSum = 0;
    for (let j = 0; j < b.n; j++) wSum += K[i * b.n + j]!;
    if (wSum < 1e-15) continue;
    for (let j = 0; j < b.n; j++) {
      const w = K[i * b.n + j]! / wSum;
      const tB = b.patches[j]!.tensor;
      for (let k = 0; k < PATCH_DIM; k++) {
        phi[i * PATCH_DIM + k]! += w * tB[k]!;
      }
    }
  }

  return phi;
}

// ── Robust metrics (trimmed) ──

function robustDistortion(
  phi: Float64Array,
  a: SamplePatches,
  b: SamplePatches,
): number {
  const nA = a.n;
  const A_adj = a.adjacency;
  const B_adj = b.adjacency;
  const gA = a.graphN;
  const gB = b.graphN;

  // Nearest B-module for each A-module
  const nearestB = findNearestTargets(phi, nA, b);

  // Per-module preservation rate
  const perModule: number[] = [];
  for (let i = 0; i < nA; i++) {
    let total = 0, preserved = 0;
    for (let j = 0; j < nA; j++) {
      if (j === i || A_adj[i * gA + j]! < 1e-12) continue;
      total++;
      const bi = nearestB[i]!;
      const bj = nearestB[j]!;
      if (bi === bj || B_adj[bi * gB + bj]! > 1e-12) preserved++;
    }
    if (total > 0) perModule.push(1 - preserved / total);
  }

  return trimmedMean(perModule);
}

function robustCurvature(
  phi: Float64Array,
  a: SamplePatches,
  b: SamplePatches,
): number {
  const nA = a.n;
  const nearestB = findNearestTargets(phi, nA, b);

  const perModule: number[] = [];
  for (let i = 0; i < nA; i++) {
    const pA = a.patches[i]!.tensor;
    const pB = b.patches[nearestB[i]!]!.tensor;
    let specDist = 0;
    for (let k = 0; k < 8; k++) { // first 8 = local spectrum
      const d = pA[k]! - pB[k]!;
      specDist += d * d;
    }
    perModule.push(Math.min(Math.sqrt(specDist) / 2.0, 1.0));
  }

  return trimmedMean(perModule);
}

function robustStability(
  phi: Float64Array,
  a: SamplePatches,
): number {
  const nA = a.n;
  const A_adj = a.adjacency;
  const gN = a.graphN;
  const edgeDists: number[] = [];

  for (let i = 0; i < nA; i++) {
    for (let j = i + 1; j < nA; j++) {
      if (A_adj[i * gN + j]! < 1e-12) continue;
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = phi[i * PATCH_DIM + k]! - phi[j * PATCH_DIM + k]!;
        d2 += diff * diff;
      }
      edgeDists.push(Math.sqrt(d2));
    }
  }

  if (edgeDists.length < 2) return 0;
  const mean = edgeDists.reduce((s, v) => s + v, 0) / edgeDists.length;
  const variance = edgeDists.reduce((s, v) => s + (v - mean) ** 2, 0) / edgeDists.length;
  const cv = mean > 1e-12 ? Math.sqrt(variance) / mean : 1;
  return Math.exp(-cv);
}

// ── Symmetry agreement ──

function measureSymmetry(
  phiAB: Float64Array,
  phiBA: Float64Array,
  a: SamplePatches,
  b: SamplePatches,
): number {
  const nA = a.n;

  // For each A-module i:
  //   1. Find nearest B-module j to Φ_AB(i)
  //   2. Find nearest A-module i' to Φ_BA(j)
  //   3. Measure distance between i and i' in A's patch space
  const nearestB = findNearestTargets(phiAB, nA, b);

  const perModule: number[] = [];
  for (let i = 0; i < nA; i++) {
    const j = nearestB[i]!;

    // Where does Φ_BA map j?
    const phiBA_j = new Float64Array(PATCH_DIM);
    for (let k = 0; k < PATCH_DIM; k++) {
      phiBA_j[k] = phiBA[j * PATCH_DIM + k]!;
    }

    // Find nearest A-module to Φ_BA(j)
    let bestDist = Infinity;
    let bestI = 0;
    for (let ip = 0; ip < nA; ip++) {
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = phiBA_j[k]! - a.patches[ip]!.tensor[k]!;
        d2 += diff * diff;
      }
      if (d2 < bestDist) { bestDist = d2; bestI = ip; }
    }

    // How close is i' to i?
    if (bestI === i) {
      perModule.push(1.0); // perfect round-trip
    } else {
      // Measure distance in patch space, normalize
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = a.patches[i]!.tensor[k]! - a.patches[bestI]!.tensor[k]!;
        d2 += diff * diff;
      }
      perModule.push(Math.exp(-Math.sqrt(d2)));
    }
  }

  return trimmedMean(perModule);
}

// ── Perturbation coherence ──

function measurePerturbationCoherence(
  a: SamplePatches,
  b: SamplePatches,
  basePhi: Float64Array,
  seed: number,
): number {
  const nA = a.n;
  let rng = seed;

  const deviations: number[] = [];

  for (let trial = 0; trial < NUM_PERTURBATIONS; trial++) {
    // Perturb A's patches: add noise to patch tensors
    const perturbedA = perturbPatches(a, NOISE_FRACTION, rng);
    rng = nextRng(rng);

    // Perturb B's patches
    const perturbedB = perturbPatches(b, NOISE_FRACTION, rng);
    rng = nextRng(rng);

    // Re-solve field
    const K = computeKernel(perturbedA, perturbedB);
    const pertPhi = solveField(K, nA, perturbedB);

    // Measure deviation from base field
    let totalDev = 0;
    for (let i = 0; i < nA; i++) {
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = basePhi[i * PATCH_DIM + k]! - pertPhi[i * PATCH_DIM + k]!;
        d2 += diff * diff;
      }
      totalDev += Math.sqrt(d2);
    }
    deviations.push(totalDev / nA);
  }

  // Coherence = low deviation = high persistence
  const meanDev = deviations.reduce((s, v) => s + v, 0) / deviations.length;
  return Math.exp(-meanDev * 5);
}

/**
 * Perturb patch tensors by adding Gaussian noise to a fraction of values.
 */
function perturbPatches(
  sample: SamplePatches,
  noiseFrac: number,
  seed: number,
): SamplePatches {
  let rng = seed;
  const newPatches = sample.patches.map(patch => {
    const newTensor = new Float64Array(patch.tensor);
    for (let k = 0; k < PATCH_DIM; k++) {
      rng = nextRng(rng);
      if ((rng & 0xff) / 255 < noiseFrac) {
        // Add small Gaussian-ish noise
        rng = nextRng(rng);
        const u1 = ((rng & 0xffff) + 1) / 65537;
        rng = nextRng(rng);
        const u2 = ((rng & 0xffff) + 1) / 65537;
        const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        newTensor[k]! += noise * 0.05; // small perturbation
      }
    }
    return { ...patch, tensor: newTensor };
  });

  return { ...sample, patches: newPatches };
}

// ── Helpers ──

function findNearestTargets(
  phi: Float64Array,
  nA: number,
  b: SamplePatches,
): Int32Array {
  const nearest = new Int32Array(nA);
  for (let i = 0; i < nA; i++) {
    let best = Infinity;
    let bestJ = 0;
    for (let j = 0; j < b.n; j++) {
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = phi[i * PATCH_DIM + k]! - b.patches[j]!.tensor[k]!;
        d2 += diff * diff;
      }
      if (d2 < best) { best = d2; bestJ = j; }
    }
    nearest[i] = bestJ;
  }
  return nearest;
}

function trimmedMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * TRIM_FRACTION);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)]!;
  return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}

function nextRng(rng: number): number {
  return (Math.imul(rng, 1103515245) + 12345) >>> 0;
}
