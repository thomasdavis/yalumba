/**
 * Spectral Ecology v9 — Constraint Compatibility Tensor
 *
 * FUNDAMENTALLY DIFFERENT from v1-v8:
 *   - No cross-sample field or kernel
 *   - Computes structure WITHIN each sample independently
 *   - Then compares distributions
 *
 * Each sample gets an intrinsic curvature profile:
 *   ψ(i,j) = patch tensor distance between connected modules
 *   Δ(i,j,k) = triangle inequality violation = curvature
 *   P(Δ) = distribution over all triangles
 *
 * Comparison = how similar are two samples' curvature distributions?
 * Related → similar inherited constraint systems → similar P(Δ)
 * Unrelated → independent constraints → different P(Δ)
 *
 * This is second-order structure: relationships between relationships.
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import {
  buildInteractionGraph,
  normalizedLaplacian,
  eigenDecomposition,
  assignRoles,
  extractPatches,
} from "@yalumba/ecology";
import { computeCurvatureProfile, compareCurvatureProfiles } from "@yalumba/ecology";
import type { CurvatureProfile } from "@yalumba/ecology";
import type { ModuleExtractionOptions } from "@yalumba/modules";

const EXTRACT_OPTS: ModuleExtractionOptions = {
  motifK: 15,
  windowSize: 150,
  minSupport: 3,
  minCohesion: 0.25,
};

interface PreparedContext {
  profiles: Map<string, CurvatureProfile>;
}

export const spectralEcologyV9: SymbioAlgorithm = {
  name: "Spectral ecology v9",
  version: 9,
  description: "Constraint compatibility tensor — intrinsic curvature distributions, no cross-sample field",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [v9] Computing intrinsic curvature profiles...`);

    const profiles = new Map<string, CurvatureProfile>();

    for (const sample of samples) {
      const st = performance.now();

      const graph = buildInteractionGraph(sample.reads, EXTRACT_OPTS);
      const laplacian = normalizedLaplacian(graph.adjacency);
      const eigen = eigenDecomposition(laplacian);
      const roles = assignRoles(graph, eigen);
      const patches = extractPatches(sample.id, graph, roles);

      const profile = computeCurvatureProfile(patches);
      profiles.set(sample.id, profile);

      const elapsed = ((performance.now() - st) / 1000).toFixed(1);
      console.log(`      ${sample.id}: ${profile.triangleCount} triangles, μ=${profile.mean.toFixed(3)}, σ=${profile.std.toFixed(3)}, P50=${profile.p50.toFixed(3)} (${elapsed}s)`);
    }

    console.log(`    [v9] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { profiles };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const profA = ctx.profiles.get(a.id)!;
    const profB = ctx.profiles.get(b.id)!;

    const result = compareCurvatureProfiles(profA, profB);

    return {
      score: result.score,
      detail: result.detail,
    };
  },
};
