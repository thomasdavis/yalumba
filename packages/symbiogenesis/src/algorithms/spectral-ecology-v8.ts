/**
 * Spectral Ecology v8 — Holonomy Curvature with Self-Baseline
 *
 * Three fixes from v8-alpha:
 * 1. TOP-K transport (k=5) — sharp, not diffuse Gaussian
 * 2. SELF-CURVATURE BASELINE — compare A-via-B to A-via-A
 *    score = similarity(cross-curvature, self-curvature)
 * 3. EMD distribution comparison — captures distribution shift
 *
 * Combined with cooperative stability from v7 (the best discriminator).
 *
 * Scoring:
 *   0.40 cooperative stability (from v7 persistence field)
 *   0.35 holonomy self-baseline similarity
 *   0.15 Sinkhorn symmetry
 *   0.10 (1 - distortion)
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import {
  buildInteractionGraph,
  normalizedLaplacian,
  eigenDecomposition,
  assignRoles,
  extractPatches,
  solvePersistenceField,
  findTriangles,
  computeHolonomy,
  compareCurvatureDistributions,
} from "@yalumba/ecology";
import type { SamplePatches, HolonomyResult } from "@yalumba/ecology";
import type { ModuleExtractionOptions } from "@yalumba/modules";

const EXTRACT_OPTS: ModuleExtractionOptions = {
  motifK: 15,
  windowSize: 150,
  minSupport: 3,
  minCohesion: 0.25,
};

interface PreparedContext {
  samples: Map<string, SamplePatches>;
  triangles: Map<string, ReturnType<typeof findTriangles>>;
  selfHolonomy: Map<string, HolonomyResult>;
}

export const spectralEcologyV8: SymbioAlgorithm = {
  name: "Spectral ecology v8",
  version: 8,
  description: "Holonomy curvature with self-baseline — top-k transport + EMD distribution comparison",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [v8] Building patches + triangles + self-holonomy...`);

    const prepared = new Map<string, SamplePatches>();
    const triMap = new Map<string, ReturnType<typeof findTriangles>>();
    const selfHol = new Map<string, HolonomyResult>();

    for (const sample of samples) {
      const st = performance.now();
      const graph = buildInteractionGraph(sample.reads, EXTRACT_OPTS);
      const laplacian = normalizedLaplacian(graph.adjacency);
      const eigen = eigenDecomposition(laplacian);
      const roles = assignRoles(graph, eigen);
      const patches = extractPatches(sample.id, graph, roles);
      const triangles = findTriangles(patches);

      // Self-holonomy: map A through A (baseline curvature)
      const selfResult = computeHolonomy(patches, patches, triangles);

      const elapsed = ((performance.now() - st) / 1000).toFixed(1);
      console.log(`      ${sample.id}: ${patches.n} modules, ${triangles.length} tri, self-κ=${selfResult.meanCurvature.toFixed(3)} (${elapsed}s)`);

      prepared.set(sample.id, patches);
      triMap.set(sample.id, triangles);
      selfHol.set(sample.id, selfResult);
    }

    console.log(`    [v8] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { samples: prepared, triangles: triMap, selfHolonomy: selfHol };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const pA = ctx.samples.get(a.id)!;
    const pB = ctx.samples.get(b.id)!;
    const triA = ctx.triangles.get(a.id)!;
    const selfA = ctx.selfHolonomy.get(a.id)!;

    // ── 1. Cooperative stability + symmetry + distortion from v7 ──
    const seed = hashPair(a.id, b.id);
    const v7 = solvePersistenceField(pA, pB, seed);

    // ── 2. Cross-holonomy: A's triangles mapped through B ──
    let holonomyScore = 0;
    let crossMean = 0;
    if (triA.length >= 3 && selfA.triangleCount >= 3) {
      const crossHol = computeHolonomy(pA, pB, triA);
      crossMean = crossHol.meanCurvature;

      // Self-baseline comparison: how similar is A-via-B to A-via-A?
      // Related: A-via-B ≈ A-via-A (inherited structure preserves geometry)
      // Unrelated: A-via-B ≠ A-via-A (random structure disrupts geometry)
      holonomyScore = compareCurvatureDistributions(selfA, crossHol);
    }

    // ── 3. Composite score ──
    const score =
      0.40 * v7.cooperativeStability +
      0.35 * holonomyScore +
      0.15 * v7.symmetryAgreement +
      0.10 * (1 - v7.distortion);

    return {
      score,
      detail: `S=${v7.cooperativeStability.toFixed(4)} H=${holonomyScore.toFixed(4)} selfκ=${selfA.meanCurvature.toFixed(3)} crossκ=${crossMean.toFixed(3)} SYM=${v7.symmetryAgreement.toFixed(4)} tri=${triA.length}`,
    };
  },
};

function hashPair(a: string, b: string): number {
  let h = 0x811c9dc5;
  for (const c of a + b) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
