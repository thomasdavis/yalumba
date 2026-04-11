/**
 * Null model normalization for coverage deconfounding.
 *
 * The coverage confound: samples with similar sequencing depth
 * produce similar module counts, similar degree distributions,
 * and similar spectra — regardless of kinship.
 *
 * Fix: compare the REAL spectrum to the EXPECTED spectrum under
 * a random graph with the same degree sequence. The residual
 * captures structure beyond what degree alone explains.
 *
 * We use the Chung-Lu random graph model: expected edge weight
 * between nodes i,j is d_i * d_j / (2m), where d_i is the
 * weighted degree and m is total edge weight. The expected
 * normalized Laplacian eigenvalues for Chung-Lu converge to
 * a known distribution that depends only on the degree sequence.
 *
 * For practical computation, we generate K random graphs with
 * the same degree sequence, compute their spectra, and take
 * the mean as the null expectation.
 */

import type { InteractionGraph } from "./types.js";
import { normalizedLaplacian, eigenDecomposition } from "./laplacian.js";

/** Number of null model realizations */
const NULL_SAMPLES = 5;

/**
 * Compute the spectral residual: how much the real spectrum
 * deviates from what's expected given the degree sequence alone.
 *
 * Returns normalized residuals: (real - null_mean) / null_std
 * for each eigenvalue position. Positive = more structured than
 * expected. Negative = less structured than expected.
 */
export function spectralResidual(
  realSpectrum: Float64Array,
  graph: InteractionGraph,
  seed: number = 42,
): Float64Array {
  const n = graph.n;
  if (n < 3) return new Float64Array(realSpectrum.length);

  // Compute degree sequence from real graph
  const degrees = new Float64Array(n);
  let totalWeight = 0;
  const A = graph.adjacency.data;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let j = 0; j < n; j++) d += A[i * n + j]!;
    degrees[i] = d;
    totalWeight += d;
  }
  totalWeight /= 2; // undirected

  if (totalWeight < 1e-12) return new Float64Array(realSpectrum.length);

  // Generate null spectra via Chung-Lu model
  const nullSpectra: Float64Array[] = [];
  let rng = seed;
  for (let s = 0; s < NULL_SAMPLES; s++) {
    const nullAdj = generateChungLu(n, degrees, totalWeight, rng);
    rng = (rng * 1103515245 + 12345) >>> 0;
    const nullL = normalizedLaplacian({ data: nullAdj, rows: n, cols: n });
    const nullEigen = eigenDecomposition(nullL);
    nullSpectra.push(nullEigen.values);
  }

  // Compute mean and std of null eigenvalues at each position
  const residual = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let mean = 0;
    for (const ns of nullSpectra) mean += ns[i]!;
    mean /= NULL_SAMPLES;

    let variance = 0;
    for (const ns of nullSpectra) {
      const d = ns[i]! - mean;
      variance += d * d;
    }
    const std = Math.sqrt(variance / NULL_SAMPLES + 1e-12);

    residual[i] = (realSpectrum[i]! - mean) / std;
  }

  return residual;
}

/**
 * Normalized ecosystem signature: replace raw spectral features
 * with coverage-deconfounded versions.
 *
 * - Spectral entropy computed on residual spectrum
 * - Graph energy computed on residual spectrum
 * - Heat traces recomputed on residual (not implemented here —
 *   would require modifying eigenvalues before heat kernel)
 */
export function deconfoundedSpectralEntropy(residual: Float64Array): number {
  // Shift residuals to positive for entropy computation
  let minR = Infinity;
  for (let i = 0; i < residual.length; i++) {
    if (residual[i]! < minR) minR = residual[i]!;
  }

  let sum = 0;
  const shifted = new Float64Array(residual.length);
  for (let i = 0; i < residual.length; i++) {
    shifted[i] = residual[i]! - minR + 1e-6;
    sum += shifted[i]!;
  }

  if (sum < 1e-12) return 0;
  let entropy = 0;
  for (let i = 0; i < shifted.length; i++) {
    const p = shifted[i]! / sum;
    if (p > 1e-15) entropy -= p * Math.log(p);
  }
  return entropy;
}

/**
 * Generate a Chung-Lu random graph with the given degree sequence.
 * Edge probability: P(i,j) = d_i * d_j / (2m).
 * Returns dense adjacency matrix.
 */
function generateChungLu(
  n: number,
  degrees: Float64Array,
  totalWeight: number,
  seed: number,
): Float64Array {
  const adj = new Float64Array(n * n);
  let rng = seed;

  const twoM = 2 * totalWeight;
  if (twoM < 1e-12) return adj;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const expectedWeight = (degrees[i]! * degrees[j]!) / twoM;
      // Deterministic seeded pseudo-random
      rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
      const u = (rng & 0x7fffffff) / 0x7fffffff;
      // Use expected weight as Poisson mean, sample binary
      if (u < Math.min(expectedWeight, 1)) {
        const w = expectedWeight;
        adj[i * n + j] = w;
        adj[j * n + i] = w;
      }
    }
  }

  return adj;
}
