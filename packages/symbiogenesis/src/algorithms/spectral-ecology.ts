/**
 * Algorithm Family 4: Spectral Ecology v5 — Multi-Scale Symbiogenetic Field Curvature
 *
 * v1: graph collapse
 * v2: within-sample ceiling (+1.55%)
 * v3: cross-sample transport (+4.93%, spouse #1)
 * v4: coherence fields (+0.02%, spouse #8, gap -4.99%)
 * v5: multi-scale field consistency
 *
 * Key insight from v4: inheritance signal lies not in absolute
 * deformation magnitude, but in CONSISTENCY of deformation across
 * scales. Relatives share constraints that produce stable transformation
 * patterns across 1-hop, 2-hop, and 3-hop neighbourhoods.
 * Unrelated pairs produce scale-dependent incoherence.
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import {
  buildInteractionGraph,
  normalizedLaplacian,
  eigenDecomposition,
  assignRoles,
  extractMultiScalePatches,
  solveMultiScaleField,
} from "@yalumba/ecology";
import type { MultiScalePatches } from "@yalumba/ecology";
import type { ModuleExtractionOptions } from "@yalumba/modules";

const EXTRACT_OPTS: ModuleExtractionOptions = {
  motifK: 15,
  windowSize: 150,
  minSupport: 3,
  minCohesion: 0.25,
};

interface PreparedContext {
  samples: Map<string, MultiScalePatches>;
}

export const spectralEcology: SymbioAlgorithm = {
  name: "Spectral ecology",
  version: 5,
  description: "Multi-scale symbiogenetic field curvature — scale-consistent deformation over ecological patches",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [spectral-ecology-v5] Building multi-scale patches...`);

    const prepared = new Map<string, MultiScalePatches>();

    for (const sample of samples) {
      const st = performance.now();
      console.log(`      ${sample.id}: graph + spectral + 3-scale patches...`);

      const graph = buildInteractionGraph(sample.reads, EXTRACT_OPTS);
      const laplacian = normalizedLaplacian(graph.adjacency);
      const eigen = eigenDecomposition(laplacian);
      const roles = assignRoles(graph, eigen);

      const patches = extractMultiScalePatches(sample.id, graph, roles);

      const elapsed = ((performance.now() - st) / 1000).toFixed(1);
      console.log(`        ${graph.n} modules, 3 scales, ${elapsed}s`);

      prepared.set(sample.id, patches);
    }

    console.log(`    [spectral-ecology-v5] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { samples: prepared };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const pA = ctx.samples.get(a.id)!;
    const pB = ctx.samples.get(b.id)!;

    const result = solveMultiScaleField(pA, pB);

    return {
      score: result.score,
      detail: result.detail,
    };
  },
};
