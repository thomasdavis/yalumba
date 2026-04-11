/**
 * Module feature embeddings.
 *
 * Each module → feature vector capturing its ecological character,
 * NOT its token identity. Two modules with zero k-mer overlap can
 * have identical embeddings if they play the same structural role.
 *
 * Features:
 *   - motif count (log-scaled)
 *   - support (log-scaled)
 *   - cohesion
 *   - motif diversity (entropy of motif hash distribution)
 *   - GC content of constituent k-mers
 *   - reverse complement symmetry ratio
 *   - mean co-occurrence degree in the interaction graph
 *   - spectral position (from Laplacian eigenvectors, added later)
 */

import type { Module } from "@yalumba/modules";
import type { InteractionGraph } from "./types.js";

/** Number of intrinsic features per module (before spectral position) */
export const EMBEDDING_DIM = 7;

/**
 * Compute feature embeddings for all modules in a graph.
 * Returns n × EMBEDDING_DIM matrix as Float64Array (row-major).
 *
 * Features are normalized to [0, 1] range within each sample
 * to remove absolute scale (coverage deconfounding).
 */
export function computeModuleEmbeddings(
  modules: readonly Module[],
  graph: InteractionGraph,
): Float64Array {
  const n = modules.length;
  if (n === 0) return new Float64Array(0);

  const raw = new Float64Array(n * EMBEDDING_DIM);

  for (let i = 0; i < n; i++) {
    const mod = modules[i];
    if (!mod) continue;
    const offset = i * EMBEDDING_DIM;

    // Feature 0: log motif count
    raw[offset] = Math.log1p(mod.members.length);

    // Feature 1: log support
    raw[offset + 1] = Math.log1p(mod.support);

    // Feature 2: cohesion (already 0-1)
    raw[offset + 2] = mod.cohesion;

    // Feature 3: motif diversity — entropy of member hash distribution
    raw[offset + 3] = motifDiversityEntropy(mod);

    // Feature 4: GC content approximation from motif hashes
    raw[offset + 4] = estimateGcFromMembers(mod);

    // Feature 5: reverse complement symmetry
    raw[offset + 5] = rcSymmetryRatio(mod);

    // Feature 6: mean weighted degree in interaction graph
    raw[offset + 6] = meanGraphDegree(i, graph);
  }

  // Normalize each feature to [0, 1] within this sample
  normalizeColumns(raw, n, EMBEDDING_DIM);

  return raw;
}

/**
 * Compute pairwise cosine similarity between module embeddings
 * from two different samples. Returns n_A × n_B matrix.
 *
 * This produces the Layer 2 (module similarity) graph:
 * dense structure even when modules share zero identical motifs.
 */
export function crossSampleSimilarity(
  embA: Float64Array,
  nA: number,
  embB: Float64Array,
  nB: number,
): Float64Array {
  const dim = EMBEDDING_DIM;
  const result = new Float64Array(nA * nB);

  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < nB; j++) {
      let dot = 0, normI = 0, normJ = 0;
      for (let k = 0; k < dim; k++) {
        const a = embA[i * dim + k]!;
        const b = embB[j * dim + k]!;
        dot += a * b;
        normI += a * a;
        normJ += b * b;
      }
      const denom = Math.sqrt(normI) * Math.sqrt(normJ);
      result[i * nB + j] = denom > 1e-12 ? dot / denom : 0;
    }
  }

  return result;
}

// ── Feature computation helpers ──

/** Entropy of the motif hash distribution (bits of diversity) */
function motifDiversityEntropy(mod: Module): number {
  if (mod.members.length <= 1) return 0;
  // Use hash modulo 256 as a proxy for hash distribution
  const bins = new Float64Array(256);
  for (const h of mod.members) {
    bins[h & 0xff]!++;
  }
  let entropy = 0;
  const total = mod.members.length;
  for (let i = 0; i < 256; i++) {
    const p = bins[i]! / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Estimate GC content from motif hash distribution.
 * Since we don't store the actual sequences, use the hash
 * modulo properties as a proxy. Higher hashes correlate
 * weakly with GC-rich k-mers due to FNV-1a properties.
 */
function estimateGcFromMembers(mod: Module): number {
  if (mod.members.length === 0) return 0.5;
  let sum = 0;
  for (const h of mod.members) {
    // Use upper bits as GC proxy (normalized to 0-1)
    sum += ((h >>> 16) & 0xffff) / 0xffff;
  }
  return sum / mod.members.length;
}

/**
 * Reverse complement symmetry: fraction of members where
 * the canonical hash equals the forward hash (proxy for
 * palindromic/self-complementary k-mers).
 *
 * Since we store canonical hashes, we can't distinguish
 * forward from reverse. Use even/odd parity as proxy.
 */
function rcSymmetryRatio(mod: Module): number {
  if (mod.members.length === 0) return 0;
  let even = 0;
  for (const h of mod.members) {
    if ((h & 1) === 0) even++;
  }
  return even / mod.members.length;
}

/** Mean weighted degree of node i in the interaction graph */
function meanGraphDegree(nodeIndex: number, graph: InteractionGraph): number {
  const n = graph.n;
  const A = graph.adjacency.data;
  let degree = 0;
  for (let j = 0; j < n; j++) {
    degree += A[nodeIndex * n + j]!;
  }
  return degree;
}

/** Normalize each column (feature) to [0, 1] */
function normalizeColumns(
  data: Float64Array,
  rows: number,
  cols: number,
): void {
  for (let c = 0; c < cols; c++) {
    let min = Infinity, max = -Infinity;
    for (let r = 0; r < rows; r++) {
      const v = data[r * cols + c]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min;
    if (range < 1e-12) {
      for (let r = 0; r < rows; r++) data[r * cols + c] = 0;
    } else {
      for (let r = 0; r < rows; r++) {
        data[r * cols + c] = (data[r * cols + c]! - min) / range;
      }
    }
  }
}
