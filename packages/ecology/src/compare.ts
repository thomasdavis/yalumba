/**
 * Ecosystem comparison — v3 (experiment 4).
 *
 * Key change: replace heat TRACE (graph-level sum) with heat
 * SIGNATURE DISTRIBUTION (node-level). The trace is just Σ HKS(j,t)
 * over all nodes — it collapses internal structure. The distribution
 * preserves which nodes are hubs vs periphery.
 *
 * Method: at each timescale, sort the per-node HKS values and
 * compare the sorted vectors. This is a 1D Wasserstein distance
 * (earth mover's distance between empirical distributions).
 */

import type { EcosystemSignature, EcosystemComparison } from "./types.js";
import { logTraces } from "./heat-kernel.js";

/**
 * Compare two ecosystem signatures.
 */
export function compareEcosystems(
  a: EcosystemSignature,
  b: EcosystemSignature,
): EcosystemComparison {
  // ── Node-level HKS distribution distance (NEW — experiment 4) ──
  const hksDistribDistance = nodeHksDistributionDistance(a, b);

  // ── Graph-level heat trace (kept at lower weight) ──
  const heatTraceDistance = l2Distance(logTraces(a.heatTrace), logTraces(b.heatTrace));

  const roleSpectrumDivergence = jsDivergence(
    a.roleSpectrum.distribution, b.roleSpectrum.distribution,
  );

  const specA = filterTrivialEigenvalues(a.spectrum);
  const specB = filterTrivialEigenvalues(b.spectrum);
  const spectralDistance = paddedL2(specA, specB, 0.5);
  const trivialFracA = 1 - specA.length / Math.max(a.spectrum.length, 1);
  const trivialFracB = 1 - specB.length / Math.max(b.spectrum.length, 1);
  const trivialFracDiff = Math.abs(trivialFracA - trivialFracB);

  const spectralGapRatio = ratio(a.spectralGap, b.spectralGap);
  const energyRatio = ratio(a.graphEnergy, b.graphEnergy);
  const densityDistance = l2Distance(a.eigenvalueDensity, b.eigenvalueDensity);
  const localizationDistance = Math.abs(a.meanLocalization - b.meanLocalization) +
    Math.abs(a.localizationSpread - b.localizationSpread);
  const deconfoundedDistance = paddedL2(a.spectralResidual, b.spectralResidual, 0);
  const diffusionDistance = l2Distance(a.diffusionMeans, b.diffusionMeans) +
    l2Distance(a.diffusionVariances, b.diffusionVariances);

  // Composite: node-level HKS distribution gets the largest weight
  const distance =
    0.30 * hksDistribDistance +
    0.10 * heatTraceDistance +
    0.15 * roleSpectrumDivergence +
    0.15 * densityDistance +
    0.10 * diffusionDistance +
    0.10 * spectralDistance +
    0.05 * trivialFracDiff +
    0.025 * localizationDistance +
    0.0125 * (1 - spectralGapRatio) +
    0.0125 * (1 - energyRatio);

  return {
    distance,
    heatTraceDistance,
    roleSpectrumDivergence,
    spectralDistance,
    spectralGapRatio,
    energyRatio,
    densityDistance,
    localizationDistance,
    deconfoundedDistance,
    diffusionDistance,
  };
}

/**
 * Node-level HKS distribution distance.
 *
 * For each timescale t, sort the per-node HKS values for both samples.
 * Interpolate to common length (since graphs may have different n).
 * Compare sorted vectors via L2.
 * Average across timescales.
 *
 * This is equivalent to 1D Wasserstein distance between empirical
 * distributions of node heat signatures.
 */
function nodeHksDistributionDistance(
  a: EcosystemSignature,
  b: EcosystemSignature,
): number {
  const sigA = a.heatTrace.nodeSignatures;
  const sigB = b.heatTrace.nodeSignatures;
  const nA = sigA.length;
  const nB = sigB.length;
  if (nA === 0 || nB === 0) return 1;

  const T = a.heatTrace.timescales.length;
  if (T === 0) return 1;

  let totalDist = 0;

  for (let ti = 0; ti < T; ti++) {
    // Extract HKS values at timescale ti for all nodes
    const valsA = new Float64Array(nA);
    const valsB = new Float64Array(nB);
    for (let j = 0; j < nA; j++) valsA[j] = sigA[j]![ti]!;
    for (let j = 0; j < nB; j++) valsB[j] = sigB[j]![ti]!;

    // Normalize to mean=1 within each sample — removes absolute scale,
    // compares RELATIVE node importance (hub-ness, periphery-ness)
    normalizeMean(valsA);
    normalizeMean(valsB);

    // Sort ascending
    valsA.sort();
    valsB.sort();

    // Interpolate to common grid (max of nA, nB points)
    // and compute L2 distance between quantile functions
    const m = Math.max(nA, nB);
    let sumSq = 0;
    for (let i = 0; i < m; i++) {
      const qA = interpolateQuantile(valsA, i / m);
      const qB = interpolateQuantile(valsB, i / m);
      const d = qA - qB;
      sumSq += d * d;
    }
    totalDist += Math.sqrt(sumSq / m);
  }

  return totalDist / T;
}

/** Normalize array so mean = 1 (removes absolute scale) */
function normalizeMean(arr: Float64Array): void {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i]!;
  const mean = sum / arr.length;
  if (mean > 1e-15) {
    for (let i = 0; i < arr.length; i++) arr[i]! /= mean;
  }
}

/** Linear interpolation into a sorted array at quantile p ∈ [0, 1) */
function interpolateQuantile(sorted: Float64Array, p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, n - 1);
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/**
 * Convert ecosystem distance to similarity score in [0, 1].
 */
export function distanceToSimilarity(
  distance: number,
  scale: number = 2.0,
): number {
  return Math.exp(-distance * scale);
}

// ── Distance helpers ──

function l2Distance(a: Float64Array, b: Float64Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / len);
}

function paddedL2(a: Float64Array, b: Float64Array, padValue: number): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < maxLen; i++) {
    const va = i < a.length ? a[i]! : padValue;
    const vb = i < b.length ? b[i]! : padValue;
    sumSq += (va - vb) * (va - vb);
  }
  return Math.sqrt(sumSq / maxLen);
}

function jsDivergence(p: Float64Array, q: Float64Array): number {
  if (p.length === 0 || q.length === 0) return 1;
  const m = new Float64Array(p.length);
  for (let i = 0; i < p.length; i++) m[i] = ((p[i] ?? 0) + (q[i] ?? 0)) / 2;
  let jsd = 0;
  for (let i = 0; i < p.length; i++) {
    const pi = p[i] ?? 0, qi = q[i] ?? 0, mi = m[i] ?? 0;
    if (pi > 1e-12 && mi > 1e-12) jsd += 0.5 * pi * Math.log(pi / mi);
    if (qi > 1e-12 && mi > 1e-12) jsd += 0.5 * qi * Math.log(qi / mi);
  }
  return Math.min(jsd / Math.LN2, 1);
}

function filterTrivialEigenvalues(spectrum: Float64Array): Float64Array {
  const result: number[] = [];
  for (let i = 0; i < spectrum.length; i++) {
    const v = spectrum[i]!;
    if (v > 0.01 && (v < 0.99 || v > 1.01)) result.push(v);
  }
  return Float64Array.from(result);
}

function ratio(a: number, b: number): number {
  const minV = Math.min(a, b);
  const maxV = Math.max(a, b);
  return maxV > 1e-12 ? minV / maxV : 1;
}
