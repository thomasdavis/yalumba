import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { fastHash } from "../hash-utils.js";

/**
 * De Bruijn graph edge overlap — compare graph structure of k-mer adjacencies.
 * Each (k-1)-mer is a node, each k-mer is an edge. Compare edge sets.
 */
export const kmerGraphSimilarity: Experiment = {
  name: "K-mer graph similarity (k=21)",
  description: "De Bruijn graph edge overlap — Jaccard of (k-1)-mer adjacency edges",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const graphs = new Map<string, Set<number>>();
    for (const s of samples) {
      graphs.set(s.id, buildEdgeSet(s.reads, 21));
    }
    return graphs;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const graphs = context as Map<string, Set<number>>;
    const edgesA = graphs.get(a.id)!;
    const edgesB = graphs.get(b.id)!;

    let shared = 0;
    for (const e of edgesA) { if (edgesB.has(e)) shared++; }
    const union = edgesA.size + edgesB.size - shared;
    const jaccard = union > 0 ? shared / union : 0;

    return {
      score: jaccard,
      detail: `shared=${shared.toLocaleString()} A=${edgesA.size.toLocaleString()} B=${edgesB.size.toLocaleString()}`,
    };
  },
};

function buildEdgeSet(reads: readonly string[], k: number): Set<number> {
  const edges = new Set<number>();
  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      // Edge = hash of (left_node, right_node)
      const left = fastHash(read, i, k - 1);
      const right = fastHash(read, i + 1, k - 1);
      // Combine into edge hash
      edges.add((left * 0x9e3779b9 + right) >>> 0);
    }
  }
  return edges;
}
