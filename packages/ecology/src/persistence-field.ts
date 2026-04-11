/**
 * Symbiogenetic Persistence Field (SPF) — v7 core.
 *
 * Three targeted improvements from CHECKPOINT analysis:
 *
 * 1. SINKHORN SYMMETRY: Replace hard nearest-neighbor round-trip (always
 *    fails) with Sinkhorn-regularized doubly-stochastic coupling. This
 *    produces a proper transport plan that's symmetric by construction.
 *
 * 2. COOPERATIVE STABILITY AT 45%: The strongest discriminative signal
 *    gets 45% weight (up from 25%). Perturbation coherence reduced to
 *    10% (0.95-0.98 range, barely discriminative).
 *
 * 3. PER-SAMPLE PATCH NORMALIZATION: Z-score each sample's patch
 *    tensors before cross-sample comparison. Deconfounds coverage
 *    (which inflates raw tensor magnitudes for well-sequenced samples).
 *
 * Scoring: 0.45 cooperative + 0.25 sinkhorn symmetry + 0.10 perturbation
 *          + 0.10 curvature + 0.10 distortion
 */

import type { SamplePatches } from "./patch-tensor.js";
import { PATCH_DIM } from "./patch-tensor.js";

const NUM_PERTURBATIONS = 5;
const NOISE_FRACTION = 0.10;
const TRIM_FRACTION = 0.10;
const SINKHORN_ITERS = 20;
const SINKHORN_REG = 0.5; // Entropy regularization

export interface PersistenceFieldResult {
  readonly score: number;
  readonly perturbationCoherence: number;
  readonly symmetryAgreement: number;
  readonly cooperativeStability: number;
  readonly curvatureMismatch: number;
  readonly distortion: number;
  readonly detail: string;
}

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

  // ── 1. Solve base field (A→B) — NO normalization (it hurt v6's signal) ──
  const kernelAB = computeKernel(a, b);
  const phiAB = solveField(kernelAB, a.n, b);

  // ── 2. Base metrics ──
  const distortion = robustDistortion(phiAB, a, b);
  const curvature = robustCurvature(phiAB, a, b);
  const stability = robustStability(phiAB, a);

  // ── 3. Sinkhorn symmetry on NORMALIZED tensors (normalization helps symmetry) ──
  const normA = normalizePatchTensors(a);
  const normB = normalizePatchTensors(b);
  const symmetryAgreement = sinkhornSymmetry(normA, normB);

  // ── 4. Perturbation coherence ──
  const perturbationCoherence = measurePerturbationCoherence(
    a, b, phiAB, seed,
  );

  // ── 5. Composite — best gap was at 55/15/5/15/10 ──
  const score =
    0.55 * stability +
    0.15 * symmetryAgreement +
    0.05 * perturbationCoherence +
    0.15 * (1 - curvature) +
    0.10 * (1 - distortion);

  return {
    score,
    perturbationCoherence,
    symmetryAgreement,
    cooperativeStability: stability,
    curvatureMismatch: curvature,
    distortion,
    detail: `S=${stability.toFixed(4)} SYM=${symmetryAgreement.toFixed(4)} PC=${perturbationCoherence.toFixed(4)} C=${curvature.toFixed(4)} D=${distortion.toFixed(4)}`,
  };
}

// ── Per-sample normalization ──

function normalizePatchTensors(sample: SamplePatches): SamplePatches {
  if (sample.n < 2) return sample;

  // Compute per-dimension mean and std
  const mean = new Float64Array(PATCH_DIM);
  const std = new Float64Array(PATCH_DIM);

  for (let k = 0; k < PATCH_DIM; k++) {
    let sum = 0;
    for (let i = 0; i < sample.n; i++) {
      sum += sample.patches[i]!.tensor[k]!;
    }
    mean[k] = sum / sample.n;

    let sumSq = 0;
    for (let i = 0; i < sample.n; i++) {
      const d = sample.patches[i]!.tensor[k]! - mean[k]!;
      sumSq += d * d;
    }
    std[k] = Math.sqrt(sumSq / sample.n);
    if (std[k]! < 1e-10) std[k] = 1; // Avoid division by zero
  }

  // Z-score normalize
  const newPatches = sample.patches.map(patch => {
    const newTensor = new Float64Array(PATCH_DIM);
    for (let k = 0; k < PATCH_DIM; k++) {
      newTensor[k] = (patch.tensor[k]! - mean[k]!) / std[k]!;
    }
    return { ...patch, tensor: newTensor };
  });

  return { ...sample, patches: newPatches };
}

// ── Sinkhorn symmetry ──

function sinkhornSymmetry(a: SamplePatches, b: SamplePatches): number {
  const nA = a.n;
  const nB = b.n;

  // Cost matrix: pairwise distances between normalized patch tensors
  const C = new Float64Array(nA * nB);
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < nB; j++) {
      let d2 = 0;
      for (let k = 0; k < PATCH_DIM; k++) {
        const diff = a.patches[i]!.tensor[k]! - b.patches[j]!.tensor[k]!;
        d2 += diff * diff;
      }
      C[i * nB + j] = Math.sqrt(d2);
    }
  }

  // Sinkhorn iteration: find doubly-stochastic transport plan
  // P = diag(u) * K * diag(v) where K = exp(-C / reg)
  const K = new Float64Array(nA * nB);
  for (let idx = 0; idx < nA * nB; idx++) {
    K[idx] = Math.exp(-C[idx]! / SINKHORN_REG);
  }

  const u = new Float64Array(nA).fill(1 / nA);
  const v = new Float64Array(nB).fill(1 / nB);

  for (let iter = 0; iter < SINKHORN_ITERS; iter++) {
    // Update u: u_i = 1/(nA * sum_j K_ij * v_j)
    for (let i = 0; i < nA; i++) {
      let sum = 0;
      for (let j = 0; j < nB; j++) sum += K[i * nB + j]! * v[j]!;
      u[i] = sum > 1e-15 ? 1 / (nA * sum) : 1 / nA;
    }
    // Update v: v_j = 1/(nB * sum_i K_ij * u_i)
    for (let j = 0; j < nB; j++) {
      let sum = 0;
      for (let i = 0; i < nA; i++) sum += K[i * nB + j]! * u[i]!;
      v[j] = sum > 1e-15 ? 1 / (nB * sum) : 1 / nB;
    }
  }

  // Transport plan P_ij = u_i * K_ij * v_j
  // Symmetry score: how much mass goes to low-cost matches?
  // = 1 - (transport cost / max possible cost)
  let totalCost = 0;
  let totalMass = 0;
  let maxCost = 0;
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < nB; j++) {
      const p = u[i]! * K[i * nB + j]! * v[j]!;
      totalCost += p * C[i * nB + j]!;
      totalMass += p;
      if (C[i * nB + j]! > maxCost) maxCost = C[i * nB + j]!;
    }
  }

  const avgCost = totalMass > 0 ? totalCost / totalMass : maxCost;
  return maxCost > 0 ? Math.max(0, 1 - avgCost / maxCost) : 0;
}

// ── Kernel and field solving ──

function computeKernel(a: SamplePatches, b: SamplePatches): Float64Array {
  const nA = a.n;
  const K = new Float64Array(nA * b.n);
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

  dists.sort((a, b) => a - b);
  const sigma = Math.max(dists[Math.floor(dists.length / 2)] ?? 1, 0.01);

  for (let idx = 0; idx < nA * b.n; idx++) {
    K[idx] = Math.exp(-(K[idx]! * K[idx]!) / (2 * sigma * sigma));
  }

  return K;
}

function solveField(K: Float64Array, nA: number, b: SamplePatches): Float64Array {
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

function robustDistortion(phi: Float64Array, a: SamplePatches, b: SamplePatches): number {
  const nA = a.n;
  const nearestB = findNearestTargets(phi, nA, b);
  const perModule: number[] = [];

  for (let i = 0; i < nA; i++) {
    let total = 0, preserved = 0;
    for (let j = 0; j < nA; j++) {
      if (j === i || a.adjacency[i * a.graphN + j]! < 1e-12) continue;
      total++;
      const bi = nearestB[i]!, bj = nearestB[j]!;
      if (bi === bj || b.adjacency[bi * b.graphN + bj]! > 1e-12) preserved++;
    }
    if (total > 0) perModule.push(1 - preserved / total);
  }
  return trimmedMean(perModule);
}

function robustCurvature(phi: Float64Array, a: SamplePatches, b: SamplePatches): number {
  const nA = a.n;
  const nearestB = findNearestTargets(phi, nA, b);
  const perModule: number[] = [];

  for (let i = 0; i < nA; i++) {
    const pA = a.patches[i]!.tensor;
    const pB = b.patches[nearestB[i]!]!.tensor;
    let specDist = 0;
    for (let k = 0; k < 8; k++) {
      const d = pA[k]! - pB[k]!;
      specDist += d * d;
    }
    perModule.push(Math.min(Math.sqrt(specDist) / 2.0, 1.0));
  }
  return trimmedMean(perModule);
}

function robustStability(phi: Float64Array, a: SamplePatches): number {
  const nA = a.n;
  const edgeDists: number[] = [];

  for (let i = 0; i < nA; i++) {
    for (let j = i + 1; j < nA; j++) {
      if (a.adjacency[i * a.graphN + j]! < 1e-12) continue;
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

// ── Perturbation coherence ──

function measurePerturbationCoherence(
  a: SamplePatches, b: SamplePatches,
  basePhi: Float64Array, seed: number,
): number {
  const nA = a.n;
  let rng = seed;
  const deviations: number[] = [];

  for (let trial = 0; trial < NUM_PERTURBATIONS; trial++) {
    const pertA = perturbPatches(a, NOISE_FRACTION, rng);
    rng = nextRng(rng);
    const pertB = perturbPatches(b, NOISE_FRACTION, rng);
    rng = nextRng(rng);

    const K = computeKernel(pertA, pertB);
    const pertPhi = solveField(K, nA, pertB);

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

  const meanDev = deviations.reduce((s, v) => s + v, 0) / deviations.length;
  return Math.exp(-meanDev * 5);
}

function perturbPatches(sample: SamplePatches, noiseFrac: number, seed: number): SamplePatches {
  let rng = seed;
  const newPatches = sample.patches.map(patch => {
    const newTensor = new Float64Array(patch.tensor);
    for (let k = 0; k < PATCH_DIM; k++) {
      rng = nextRng(rng);
      if ((rng & 0xff) / 255 < noiseFrac) {
        rng = nextRng(rng);
        const u1 = ((rng & 0xffff) + 1) / 65537;
        rng = nextRng(rng);
        const u2 = ((rng & 0xffff) + 1) / 65537;
        const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        newTensor[k]! += noise * 0.05;
      }
    }
    return { ...patch, tensor: newTensor };
  });
  return { ...sample, patches: newPatches };
}

// ── Helpers ──

function findNearestTargets(phi: Float64Array, nA: number, b: SamplePatches): Int32Array {
  const nearest = new Int32Array(nA);
  for (let i = 0; i < nA; i++) {
    let best = Infinity, bestJ = 0;
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
