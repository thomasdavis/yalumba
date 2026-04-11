/**
 * Algorithm Family 4: Spectral Ecology v3 — Pair-Coupled Ecosystem Transport
 *
 * v1: sequential adjacency → graph collapse → failure
 * v2: co-occurrence + within-sample spectral → +1.55% sep, spouse confound
 * v3: cross-sample bipartite transport → the missing ingredient
 *
 * Key insight: within-sample spectral summaries hit a ceiling because
 * they measure ecosystem SHAPE, which correlates with coverage.
 * v3 builds a structure that ONLY EXISTS when two samples are
 * considered together: a bipartite soft correspondence between
 * their module ecosystems.
 *
 * Score = transport affinity + topology preservation + unmatched penalty
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import {
  buildInteractionGraph,
  normalizedLaplacian,
  eigenDecomposition,
  computeHeatKernel,
  assignRoles,
  buildNodeFeatures,
  pairTransport,
} from "@yalumba/ecology";
import type { NodeFeatureSet } from "@yalumba/ecology";
import { buildModules } from "@yalumba/modules";
import type { Module, ModuleExtractionOptions } from "@yalumba/modules";

const EXTRACT_OPTS: ModuleExtractionOptions = {
  motifK: 15,
  windowSize: 150,
  minSupport: 3,
  minCohesion: 0.25,
};

interface PreparedSample {
  modules: readonly Module[];
  nodeFeatures: NodeFeatureSet;
}

interface PreparedContext {
  samples: Map<string, PreparedSample>;
}

export const spectralEcology: SymbioAlgorithm = {
  name: "Spectral ecology",
  version: 3,
  description: "Pair-coupled ecosystem transport — cross-sample bipartite module correspondence",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [spectral-ecology-v3] Building per-sample ecosystems...`);

    const prepared = new Map<string, PreparedSample>();

    for (const sample of samples) {
      const st = performance.now();
      console.log(`      ${sample.id}: modules + graph + spectral...`);

      // Extract modules
      const modules = buildModules(sample.reads, EXTRACT_OPTS);

      // Build co-occurrence graph
      const graph = buildInteractionGraph(sample.reads, EXTRACT_OPTS);

      // Spectral decomposition
      const laplacian = normalizedLaplacian(graph.adjacency);
      const eigen = eigenDecomposition(laplacian);
      const heat = computeHeatKernel(eigen);
      const roles = assignRoles(graph, eigen);

      // Build enriched node features for cross-sample matching
      const nodeFeatures = buildNodeFeatures(
        sample.id, modules, graph, eigen, heat, roles,
      );

      const elapsed = ((performance.now() - st) / 1000).toFixed(1);
      console.log(`        ${graph.n} modules, ${nodeFeatures.n} nodes, ${elapsed}s`);

      prepared.set(sample.id, { modules, nodeFeatures });
    }

    console.log(`    [spectral-ecology-v3] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { samples: prepared };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const prepA = ctx.samples.get(a.id)!;
    const prepB = ctx.samples.get(b.id)!;

    const result = pairTransport(prepA.nodeFeatures, prepB.nodeFeatures);

    return {
      score: result.score,
      detail: result.detail,
    };
  },
};
