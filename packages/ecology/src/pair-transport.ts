/**
 * Pair-Coupled Ecosystem Transport (v3 core).
 *
 * The missing ingredient from v2: cross-sample structural signal.
 *
 * Instead of comparing samples through separate summaries, we build
 * a structure that ONLY EXISTS when two samples are considered
 * together: a bipartite correspondence between their module
 * ecosystems.
 *
 * For each pair (A, B):
 *   1. Compute cross-sample similarity kernel K(m_A, m_B)
 *   2. Build mutual top-k bipartite matching
 *   3. Score via:
 *      - Transport affinity: total compatibility mass
 *      - Topology preservation: do matched nodes have similar neighborhoods?
 *      - Unmatched penalty: fraction of modules with no plausible mate
 *
 * This directly attacks the spouse confound: spouses have similar
 * global statistics but should NOT admit coherent local correspondences,
 * because their modules arose from independent genomic regions.
 * Parent-child pairs SHOULD admit correspondences because ~50% of
 * their haplotype blocks are shared.
 */

import type { NodeFeatureSet } from "./node-features.js";

/** Number of nearest neighbors for mutual matching */
const TOP_K = 5;

/** Kernel bandwidth (auto-scaled from data) */
const BANDWIDTH_PERCENTILE = 0.5; // median distance as bandwidth

/** Result of pair transport scoring */
export interface PairTransportScore {
  /** Combined similarity score (higher = more similar) */
  readonly score: number;
  /** Transport affinity: total normalized compatibility mass */
  readonly transportAffinity: number;
  /** Topology preservation: neighborhood consistency of matched pairs */
  readonly topologyPreservation: number;
  /** Unmatched penalty: 1 - fraction of unmatched modules */
  readonly unmatchedPenalty: number;
  /** Number of mutual matches found */
  readonly matchCount: number;
  /** Detail string for logging */
  readonly detail: string;
}

/**
 * Compute pair-coupled ecosystem transport score.
 */
export function pairTransport(
  a: NodeFeatureSet,
  b: NodeFeatureSet,
  topK: number = TOP_K,
): PairTransportScore {
  if (a.n === 0 || b.n === 0) {
    return { score: 0, transportAffinity: 0, topologyPreservation: 0,
             unmatchedPenalty: 0, matchCount: 0, detail: "empty" };
  }

  const dim = a.features.length / a.n; // feature dimension

  // ── Step 1: Compute pairwise distance matrix ──
  const distMatrix = new Float64Array(a.n * b.n);
  for (let i = 0; i < a.n; i++) {
    for (let j = 0; j < b.n; j++) {
      let d2 = 0;
      for (let k = 0; k < dim; k++) {
        const diff = a.features[i * dim + k]! - b.features[j * dim + k]!;
        d2 += diff * diff;
      }
      distMatrix[i * b.n + j] = Math.sqrt(d2);
    }
  }

  // ── Step 2: Auto-scale kernel bandwidth ──
  const tau = computeBandwidth(distMatrix, a.n, b.n);

  // ── Step 3: Compute similarity kernel ──
  const kernel = new Float64Array(a.n * b.n);
  for (let i = 0; i < a.n * b.n; i++) {
    kernel[i] = Math.exp(-distMatrix[i]! / tau);
  }

  // ── Step 4: Mutual top-k matching ──
  const matchesA = topKPerRow(kernel, a.n, b.n, topK); // A→B
  const matchesB = topKPerCol(kernel, a.n, b.n, topK); // B→A
  const mutualPairs = findMutualMatches(matchesA, matchesB, a.n, b.n);

  // ── Step 5: Transport affinity ──
  const transportAffinity = computeTransportAffinity(
    kernel, mutualPairs, a.n, b.n,
  );

  // ── Step 6: Topology preservation ──
  const topologyPreservation = computeTopologyPreservation(
    mutualPairs, a, b,
  );

  // ── Step 7: Unmatched penalty ──
  const unmatchedPenalty = computeUnmatchedPenalty(
    mutualPairs, a.n, b.n,
  );

  // ── Composite score ──
  const score = 0.45 * transportAffinity
              + 0.40 * topologyPreservation
              + 0.15 * unmatchedPenalty;

  return {
    score,
    transportAffinity,
    topologyPreservation,
    unmatchedPenalty,
    matchCount: mutualPairs.length,
    detail: `T=${transportAffinity.toFixed(4)} N=${topologyPreservation.toFixed(4)} U=${unmatchedPenalty.toFixed(4)} matches=${mutualPairs.length}`,
  };
}

// ── Internal helpers ──

/** Compute bandwidth as median of all pairwise distances */
function computeBandwidth(
  dist: Float64Array,
  nA: number,
  nB: number,
): number {
  // Sample distances for efficiency (if matrix is large)
  const total = nA * nB;
  const sampleSize = Math.min(total, 10000);
  const step = Math.max(1, Math.floor(total / sampleSize));
  const sampled: number[] = [];
  for (let i = 0; i < total; i += step) {
    if (dist[i]! > 1e-12) sampled.push(dist[i]!);
  }
  sampled.sort((a, b) => a - b);
  const median = sampled[Math.floor(sampled.length * BANDWIDTH_PERCENTILE)] ?? 1;
  return Math.max(median, 0.01);
}

/** For each row (A module), find top-k most similar B modules */
function topKPerRow(
  kernel: Float64Array,
  nA: number,
  nB: number,
  k: number,
): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();
  for (let i = 0; i < nA; i++) {
    const scored: { j: number; s: number }[] = [];
    for (let j = 0; j < nB; j++) {
      scored.push({ j, s: kernel[i * nB + j]! });
    }
    scored.sort((a, b) => b.s - a.s);
    const topSet = new Set<number>();
    for (let t = 0; t < Math.min(k, scored.length); t++) {
      topSet.add(scored[t]!.j);
    }
    result.set(i, topSet);
  }
  return result;
}

/** For each column (B module), find top-k most similar A modules */
function topKPerCol(
  kernel: Float64Array,
  nA: number,
  nB: number,
  k: number,
): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();
  for (let j = 0; j < nB; j++) {
    const scored: { i: number; s: number }[] = [];
    for (let i = 0; i < nA; i++) {
      scored.push({ i, s: kernel[i * nB + j]! });
    }
    scored.sort((a, b) => b.s - a.s);
    const topSet = new Set<number>();
    for (let t = 0; t < Math.min(k, scored.length); t++) {
      topSet.add(scored[t]!.i);
    }
    result.set(j, topSet);
  }
  return result;
}

/** Find mutual matches: i→j AND j→i both in top-k */
function findMutualMatches(
  matchesA: Map<number, Set<number>>,
  matchesB: Map<number, Set<number>>,
  nA: number,
  _nB: number,
): { i: number; j: number }[] {
  const pairs: { i: number; j: number }[] = [];
  for (let i = 0; i < nA; i++) {
    const aCandidates = matchesA.get(i);
    if (!aCandidates) continue;
    for (const j of aCandidates) {
      const bCandidates = matchesB.get(j);
      if (bCandidates && bCandidates.has(i)) {
        pairs.push({ i, j });
      }
    }
  }
  return pairs;
}

/**
 * Transport affinity: how much total compatibility mass exists
 * between mutually matched modules.
 *
 * T(A,B) = Σ K(i,j) for mutual matches / sqrt(|A| * |B|)
 */
function computeTransportAffinity(
  kernel: Float64Array,
  pairs: readonly { i: number; j: number }[],
  nA: number,
  nB: number,
): number {
  if (pairs.length === 0) return 0;
  let mass = 0;
  const nBStored = Math.round(kernel.length / nA); // recover nB from kernel size
  for (const { i, j } of pairs) {
    mass += kernel[i * nBStored + j]!;
  }
  return mass / Math.sqrt(nA * nB);
}

/**
 * Topology preservation: do matched modules have similar neighborhoods?
 *
 * For each mutual match (i, j), compare:
 *   - degree similarity
 *   - neighbor match rate: fraction of i's neighbors that are matched
 *     to j's neighbors
 *
 * High topology preservation means the matching respects graph structure,
 * not just node features.
 */
function computeTopologyPreservation(
  pairs: readonly { i: number; j: number }[],
  a: NodeFeatureSet,
  b: NodeFeatureSet,
): number {
  if (pairs.length === 0) return 0;

  // Build match lookup: A-node → B-node, B-node → A-node
  const aToBMap = new Map<number, number>();
  const bToAMap = new Map<number, number>();
  for (const { i, j } of pairs) {
    aToBMap.set(i, j);
    bToAMap.set(j, i);
  }

  let totalConsistency = 0;

  for (const { i, j } of pairs) {
    // Get neighbors of i in A
    const neighborsA: number[] = [];
    for (let k = 0; k < a.n; k++) {
      if (k !== i && a.adjacency[i * a.n + k]! > 1e-12) neighborsA.push(k);
    }

    // Get neighbors of j in B
    const neighborsBSet = new Set<number>();
    for (let k = 0; k < b.n; k++) {
      if (k !== j && b.adjacency[j * b.n + k]! > 1e-12) neighborsBSet.add(k);
    }

    // What fraction of i's matched neighbors map to j's neighbors?
    let matchedNeighbors = 0;
    let totalMatchedNeighbors = 0;
    for (const ni of neighborsA) {
      const mappedNi = aToBMap.get(ni);
      if (mappedNi !== undefined) {
        totalMatchedNeighbors++;
        if (neighborsBSet.has(mappedNi)) matchedNeighbors++;
      }
    }

    const neighborConsistency = totalMatchedNeighbors > 0
      ? matchedNeighbors / totalMatchedNeighbors
      : 0;

    // Degree similarity
    let degA = 0, degB = 0;
    for (let k = 0; k < a.n; k++) degA += a.adjacency[i * a.n + k]! > 1e-12 ? 1 : 0;
    for (let k = 0; k < b.n; k++) degB += b.adjacency[j * b.n + k]! > 1e-12 ? 1 : 0;
    const degreeSim = (Math.min(degA, degB) + 1) / (Math.max(degA, degB) + 1);

    totalConsistency += 0.6 * neighborConsistency + 0.4 * degreeSim;
  }

  return totalConsistency / pairs.length;
}

/**
 * Unmatched penalty: 1 - fraction of unmatched modules.
 * If many modules have no plausible mate, similarity drops.
 */
function computeUnmatchedPenalty(
  pairs: readonly { i: number; j: number }[],
  nA: number,
  nB: number,
): number {
  const matchedA = new Set(pairs.map(p => p.i));
  const matchedB = new Set(pairs.map(p => p.j));
  const unmatchedFrac = 1 - (matchedA.size + matchedB.size) / (nA + nB);
  return 1 - unmatchedFrac; // higher = more matched = more similar
}
