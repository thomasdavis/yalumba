/**
 * Ecological patch extraction.
 *
 * The unit of comparison in v4 is not individual modules but their
 * LOCAL ENVIRONMENTS — the 2-hop neighbourhood around each module.
 *
 * For each module m, extract:
 *   - The subgraph induced by m + neighbours + neighbours-of-neighbours
 *   - Local Laplacian spectrum of that subgraph
 *   - Diffusion distance vector from m to all patch members
 *   - Role composition of the patch (fraction core/sat/bridge/etc)
 *   - Edge weight statistics (mean, variance, max)
 *   - Patch size and density
 *
 * This forms a tensor that captures the ecological CONTEXT of each
 * module — not just what it is, but what kind of neighbourhood it
 * lives in. Two modules in different samples are ecologically
 * equivalent if their patch tensors are similar, even with zero
 * k-mer overlap.
 */

import type { InteractionGraph, ModuleRole } from "./types.js";
import { normalizedLaplacian, eigenDecomposition } from "./laplacian.js";

/** Maximum patch size to keep eigendecomposition tractable */
const MAX_PATCH_SIZE = 60;

/** Number of eigenvalues to keep from local spectrum */
const LOCAL_SPECTRUM_SIZE = 8;

/** Patch tensor dimension: 8 spectrum + 5 role + 4 stats = 17 */
export const PATCH_DIM = 17;

/** Ecological patch for a single module */
export interface EcologicalPatch {
  /** Center module index */
  readonly center: number;
  /** Indices of all modules in the patch (including center) */
  readonly members: readonly number[];
  /** Patch tensor (PATCH_DIM floats) — the fixed-size summary */
  readonly tensor: Float64Array;
  /** Diffusion distances from center to all patch members */
  readonly diffusionDistances: Float64Array;
}

/** All patches for a sample */
export interface SamplePatches {
  readonly sampleId: string;
  readonly n: number;
  /** One patch per module */
  readonly patches: readonly EcologicalPatch[];
  /** Adjacency matrix (for field solver) */
  readonly adjacency: Float64Array;
  /** Graph size */
  readonly graphN: number;
}

/**
 * Extract ecological patches for all modules in a sample.
 */
export function extractPatches(
  sampleId: string,
  graph: InteractionGraph,
  roles: readonly ModuleRole[],
): SamplePatches {
  const n = graph.n;
  const A = graph.adjacency.data;
  const patches: EcologicalPatch[] = [];

  for (let center = 0; center < n; center++) {
    // ── Collect 2-hop neighbourhood ──
    const hop1 = new Set<number>();
    const hop2 = new Set<number>();
    hop1.add(center);

    // 1-hop: direct neighbours
    for (let j = 0; j < n; j++) {
      if (j !== center && A[center * n + j]! > 1e-12) {
        hop1.add(j);
      }
    }

    // 2-hop: neighbours of neighbours
    for (const h1 of hop1) {
      for (let j = 0; j < n; j++) {
        if (!hop1.has(j) && A[h1 * n + j]! > 1e-12) {
          hop2.add(j);
        }
      }
    }

    // Combine and cap size
    const allMembers = [...hop1, ...hop2];
    const members = allMembers.length <= MAX_PATCH_SIZE
      ? allMembers
      : allMembers.slice(0, MAX_PATCH_SIZE);

    const patchSize = members.length;

    // ── Extract local subgraph ──
    const localAdj = new Float64Array(patchSize * patchSize);
    for (let li = 0; li < patchSize; li++) {
      for (let lj = 0; lj < patchSize; lj++) {
        localAdj[li * patchSize + lj] = A[members[li]! * n + members[lj]!]!;
      }
    }

    // ── Local Laplacian spectrum ──
    let localSpectrum = new Float64Array(LOCAL_SPECTRUM_SIZE);
    if (patchSize >= 3) {
      const localL = normalizedLaplacian({ data: localAdj, rows: patchSize, cols: patchSize });
      const localEigen = eigenDecomposition(localL);
      // Take first LOCAL_SPECTRUM_SIZE eigenvalues (skip trivial zero)
      for (let k = 0; k < LOCAL_SPECTRUM_SIZE; k++) {
        const idx = Math.min(k + 1, localEigen.values.length - 1);
        localSpectrum[k] = idx >= 0 ? localEigen.values[idx]! : 1.0;
      }
    }

    // ── Role composition of patch ──
    const roleCounts = [0, 0, 0, 0, 0]; // core, sat, bridge, scaffold, boundary
    for (const mi of members) {
      const role = roles[mi];
      if (!role) continue;
      switch (role.role) {
        case "core": roleCounts[0]!++; break;
        case "satellite": roleCounts[1]!++; break;
        case "bridge": roleCounts[2]!++; break;
        case "scaffold": roleCounts[3]!++; break;
        case "boundary": roleCounts[4]!++; break;
      }
    }
    const roleComp = new Float64Array(5);
    for (let r = 0; r < 5; r++) {
      roleComp[r] = patchSize > 0 ? roleCounts[r]! / patchSize : 0;
    }

    // ── Edge weight statistics ──
    let edgeSum = 0, edgeMax = 0, edgeCount = 0;
    for (let li = 0; li < patchSize; li++) {
      for (let lj = li + 1; lj < patchSize; lj++) {
        const w = localAdj[li * patchSize + lj]!;
        if (w > 1e-12) {
          edgeSum += w;
          if (w > edgeMax) edgeMax = w;
          edgeCount++;
        }
      }
    }
    const edgeMean = edgeCount > 0 ? edgeSum / edgeCount : 0;
    const maxPossibleEdges = (patchSize * (patchSize - 1)) / 2;
    const patchDensity = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    // ── Diffusion distances from center ──
    // Approximate via shortest weighted path (BFS with weights)
    const diffDist = computeLocalDiffusion(0, patchSize, localAdj);

    // ── Assemble patch tensor (fixed size) ──
    const tensor = new Float64Array(PATCH_DIM);
    // [0..7]: local spectrum (8 values)
    for (let k = 0; k < LOCAL_SPECTRUM_SIZE; k++) {
      tensor[k] = localSpectrum[k]!;
    }
    // [8..12]: role composition (5 values)
    for (let r = 0; r < 5; r++) {
      tensor[LOCAL_SPECTRUM_SIZE + r] = roleComp[r]!;
    }
    // [13]: edge mean weight
    tensor[13] = edgeMean;
    // [14]: patch density
    tensor[14] = patchDensity;
    // [15]: patch size (normalized by graph size)
    tensor[15] = n > 0 ? patchSize / n : 0;
    // [16]: mean diffusion distance from center
    let meanDiff = 0;
    for (let k = 1; k < diffDist.length; k++) meanDiff += diffDist[k]!;
    tensor[16] = patchSize > 1 ? meanDiff / (patchSize - 1) : 0;

    patches.push({ center, members, tensor, diffusionDistances: diffDist });
  }

  return { sampleId, n, patches, adjacency: graph.adjacency.data, graphN: graph.n };
}

/**
 * Approximate diffusion distances from source node in local subgraph.
 * Uses inverse edge weight as distance, Dijkstra-like BFS.
 */
function computeLocalDiffusion(
  source: number,
  n: number,
  adj: Float64Array,
): Float64Array {
  const dist = new Float64Array(n).fill(Infinity);
  const visited = new Uint8Array(n);
  dist[source] = 0;

  for (let iter = 0; iter < n; iter++) {
    // Find unvisited node with smallest distance
    let minDist = Infinity;
    let minNode = -1;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i]! < minDist) {
        minDist = dist[i]!;
        minNode = i;
      }
    }
    if (minNode === -1) break;
    visited[minNode] = 1;

    // Relax neighbours
    for (let j = 0; j < n; j++) {
      const w = adj[minNode * n + j]!;
      if (w > 1e-12) {
        const d = dist[minNode]! + 1.0 / w; // inverse weight as distance
        if (d < dist[j]!) dist[j] = d;
      }
    }
  }

  // Replace Infinity with large value
  for (let i = 0; i < n; i++) {
    if (dist[i] === Infinity) dist[i] = 100;
  }

  return dist;
}
