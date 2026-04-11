/**
 * Richer spectral invariants beyond heat kernel trace.
 *
 * The heat trace collapses too much information. These invariants
 * capture more of the spectral geometry:
 *
 * - Eigenvalue density (KDE): shape of the ecosystem
 * - Eigenvector localization (IPR): modular vs distributed structure
 * - Spectral curvature: eigenvalue spacing statistics
 * - Diffusion distance distribution: pairwise node distances at multiple scales
 */

import type { EigenDecomposition } from "./types.js";

/** Number of bins for eigenvalue density estimation */
const DENSITY_BINS = 32;

/** Eigenvalue density profile via kernel density estimation */
export interface EigenvalueDensity {
  /** Bin centers in [0, 2] (normalized Laplacian range) */
  readonly centers: Float64Array;
  /** Density values at each bin */
  readonly density: Float64Array;
}

/** Eigenvector localization statistics */
export interface LocalizationProfile {
  /** Inverse participation ratio for each eigenvector */
  readonly ipr: Float64Array;
  /** Mean IPR across eigenvectors */
  readonly meanIpr: number;
  /** Std of IPR (high std = mix of localized and delocalized modes) */
  readonly stdIpr: number;
}

/** Distribution of pairwise diffusion distances at a given timescale */
export interface DiffusionDistribution {
  readonly timescale: number;
  /** Histogram of pairwise diffusion distances */
  readonly histogram: Float64Array;
  /** Mean pairwise diffusion distance */
  readonly mean: number;
  /** Variance of pairwise diffusion distances */
  readonly variance: number;
}

/**
 * Compute eigenvalue density via Gaussian KDE.
 *
 * IMPORTANT: filters out trivial eigenvalues before density estimation.
 * - Near-zero eigenvalues (< 0.01) = disconnected components (always present)
 * - Near-one eigenvalues (0.99-1.01) = isolated/loosely-connected nodes
 *
 * Only the "interesting" eigenvalues in (0.01, 0.99) ∪ (1.01, 2.0) carry
 * structural information about the ecosystem's internal organization.
 * The fraction of trivial eigenvalues is captured separately as metadata.
 */
export function eigenvalueDensity(
  eigenvalues: Float64Array,
  bandwidth: number = 0.05,
): EigenvalueDensity {
  const centers = new Float64Array(DENSITY_BINS);
  const density = new Float64Array(DENSITY_BINS);

  // Filter to non-trivial eigenvalues
  const interesting: number[] = [];
  for (let i = 0; i < eigenvalues.length; i++) {
    const v = eigenvalues[i]!;
    if (v > 0.01 && (v < 0.99 || v > 1.01)) {
      interesting.push(v);
    }
  }

  if (interesting.length === 0) {
    // All trivial — flat density
    for (let i = 0; i < DENSITY_BINS; i++) {
      centers[i] = (i + 0.5) * 2.0 / DENSITY_BINS;
      density[i] = 1.0 / DENSITY_BINS;
    }
    return { centers, density };
  }

  // Bin centers evenly spaced in [0, 2]
  for (let i = 0; i < DENSITY_BINS; i++) {
    centers[i] = (i + 0.5) * 2.0 / DENSITY_BINS;
  }

  // Gaussian KDE on interesting eigenvalues only
  const m = interesting.length;
  const scale = 1.0 / (m * bandwidth * Math.sqrt(2 * Math.PI));
  for (let b = 0; b < DENSITY_BINS; b++) {
    let sum = 0;
    for (let i = 0; i < m; i++) {
      const z = (centers[b]! - interesting[i]!) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    density[b] = sum * scale;
  }

  // Normalize to sum to 1
  let total = 0;
  for (let i = 0; i < DENSITY_BINS; i++) total += density[i]!;
  if (total > 1e-12) {
    for (let i = 0; i < DENSITY_BINS; i++) density[i]! /= total;
  }

  return { centers, density };
}

/**
 * Eigenvector localization via Inverse Participation Ratio.
 *
 * IPR(k) = Σ_j φ_k(j)^4
 *
 * For a delocalized (uniform) eigenvector: IPR = 1/n
 * For a fully localized eigenvector: IPR = 1
 *
 * High IPR → modular structure (eigenvector concentrated on few nodes)
 * Low IPR → distributed structure (eigenvector spread across all nodes)
 */
export function eigenvectorLocalization(
  eigen: EigenDecomposition,
): LocalizationProfile {
  const n = eigen.values.length;
  if (n === 0) {
    return { ipr: new Float64Array(0), meanIpr: 0, stdIpr: 0 };
  }

  const ipr = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let sum4 = 0;
    for (let j = 0; j < n; j++) {
      const v = eigen.vectors.data[j * n + k]!;
      sum4 += v * v * v * v;
    }
    ipr[k] = sum4;
  }

  // Mean and std
  let mean = 0;
  for (let k = 0; k < n; k++) mean += ipr[k]!;
  mean /= n;

  let variance = 0;
  for (let k = 0; k < n; k++) {
    const d = ipr[k]! - mean;
    variance += d * d;
  }

  return { ipr, meanIpr: mean, stdIpr: Math.sqrt(variance / n) };
}

/**
 * Spectral curvature: statistics of eigenvalue spacing.
 *
 * In random matrix theory, the spacing distribution reveals
 * structural properties. Regular structure → regular spacing.
 * Random structure → Wigner-Dyson spacing.
 *
 * Returns normalized spacing statistics.
 */
export function spectralCurvature(eigenvalues: Float64Array): Float64Array {
  const n = eigenvalues.length;
  if (n < 3) return new Float64Array(0);

  // Compute spacings between consecutive eigenvalues
  const spacings = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    spacings[i] = eigenvalues[i + 1]! - eigenvalues[i]!;
  }

  // Normalize spacings to mean 1
  let meanSpacing = 0;
  for (let i = 0; i < spacings.length; i++) meanSpacing += spacings[i]!;
  meanSpacing /= spacings.length;
  if (meanSpacing > 1e-12) {
    for (let i = 0; i < spacings.length; i++) spacings[i]! /= meanSpacing;
  }

  return spacings;
}

/**
 * Diffusion distance distribution at a given timescale.
 *
 * Diffusion distance between nodes i and j at time t:
 *   d_t(i,j)² = Σ_k exp(-2tλ_k) (φ_k(i) - φ_k(j))²
 *
 * The distribution of all pairwise distances captures more
 * structure than the trace alone.
 */
export function diffusionDistribution(
  eigen: EigenDecomposition,
  t: number,
  histBins: number = 20,
): DiffusionDistribution {
  const n = eigen.values.length;
  if (n < 2) {
    return {
      timescale: t,
      histogram: new Float64Array(histBins),
      mean: 0,
      variance: 0,
    };
  }

  // Compute all pairwise diffusion distances
  const numPairs = (n * (n - 1)) / 2;
  const distances = new Float64Array(numPairs);
  let idx = 0;

  // Precompute exp(-2t*λ_k)
  const expWeights = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    expWeights[k] = Math.exp(-2 * t * eigen.values[k]!);
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let dist2 = 0;
      for (let k = 0; k < n; k++) {
        const diff = eigen.vectors.data[i * n + k]! - eigen.vectors.data[j * n + k]!;
        dist2 += expWeights[k]! * diff * diff;
      }
      distances[idx++] = Math.sqrt(Math.max(dist2, 0));
    }
  }

  // Compute mean and variance
  let mean = 0;
  for (let i = 0; i < numPairs; i++) mean += distances[i]!;
  mean /= numPairs;

  let variance = 0;
  for (let i = 0; i < numPairs; i++) {
    const d = distances[i]! - mean;
    variance += d * d;
  }
  variance /= numPairs;

  // Histogram
  let maxDist = 0;
  for (let i = 0; i < numPairs; i++) {
    if (distances[i]! > maxDist) maxDist = distances[i]!;
  }
  maxDist = Math.max(maxDist, 1e-12);

  const histogram = new Float64Array(histBins);
  for (let i = 0; i < numPairs; i++) {
    const bin = Math.min(
      Math.floor((distances[i]! / maxDist) * histBins),
      histBins - 1,
    );
    histogram[bin]!++;
  }
  // Normalize
  for (let i = 0; i < histBins; i++) histogram[i]! /= numPairs;

  return { timescale: t, histogram, mean, variance };
}
