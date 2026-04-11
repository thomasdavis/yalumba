/**
 * Spectral Ecology v8 — Holonomy Curvature Invariants
 *
 * Key shift from v7: move from FIELD SIMILARITY to PARALLEL TRANSPORT INVARIANTS.
 *
 * Instead of comparing coherence field Φ directly, compare how Φ
 * changes along closed loops in the module graph. This is the
 * gauge-theoretic approach: curvature = holonomy around loops.
 *
 * For each pair (A, B):
 *   1. Find all triangles in A's module graph
 *   2. Transport A's patch tensors around each triangle via B-space
 *   3. Measure the "holonomy" — how much the tensor changes
 *   4. Build a curvature distribution over all triangles
 *   5. Compare A's self-curvature to the A-via-B curvature
 *
 * Hypothesis: related individuals preserve local organizational
 * constraints, producing LOW curvature (flat connection). Unrelated
 * individuals have inconsistent mappings, producing HIGH curvature.
 *
 * Scoring:
 *   0.45 cooperative stability (from v7 — best discriminator)
 *   0.30 holonomy-based curvature similarity
 *   0.15 Sinkhorn symmetry
 *   0.10 distortion
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
} from "@yalumba/ecology";
import type { SamplePatches } from "@yalumba/ecology";
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
}

export const spectralEcologyV8: SymbioAlgorithm = {
  name: "Spectral ecology v8",
  version: 8,
  description: "Holonomy curvature invariants — gauge-theoretic parallel transport around module graph loops",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [spectral-ecology-v8] Building ecological patches + finding triangles...`);

    const prepared = new Map<string, SamplePatches>();
    const triMap = new Map<string, ReturnType<typeof findTriangles>>();

    for (const sample of samples) {
      const st = performance.now();
      console.log(`      ${sample.id}:`);

      const graph = buildInteractionGraph(sample.reads, EXTRACT_OPTS);
      const laplacian = normalizedLaplacian(graph.adjacency);
      const eigen = eigenDecomposition(laplacian);
      const roles = assignRoles(graph, eigen);
      const patches = extractPatches(sample.id, graph, roles);
      const triangles = findTriangles(patches);

      const elapsed = ((performance.now() - st) / 1000).toFixed(1);
      console.log(`        ${graph.n} modules, ${patches.n} patches, ${triangles.length} triangles (${elapsed}s)`);

      prepared.set(sample.id, patches);
      triMap.set(sample.id, triangles);
    }

    console.log(`    [spectral-ecology-v8] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { samples: prepared, triangles: triMap };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const pA = ctx.samples.get(a.id)!;
    const pB = ctx.samples.get(b.id)!;
    const triA = ctx.triangles.get(a.id)!;

    // ── 1. Cooperative stability + Sinkhorn + distortion from v7 ──
    const seed = hashPair(a.id, b.id);
    const v7Result = solvePersistenceField(pA, pB, seed);

    // ── 2. Holonomy curvature ──
    // Compute curvature distribution for A's triangles mapped through B
    let holonomyScore = 0;
    if (triA.length >= 3) {
      const holonomy = computeHolonomy(pA, pB, triA);

      // Low mean curvature = flat connection = structure-preserving mapping
      // Normalize by a reference scale (median triangle curvature)
      const refScale = Math.max(holonomy.p50, 0.01);
      const normalizedMean = holonomy.meanCurvature / refScale;

      // Score: exp(-normalized_curvature) — high when curvature is low
      holonomyScore = Math.exp(-normalizedMean * 0.5);

      // Also consider curvature concentration (low P90/P50 ratio = concentrated)
      const concentration = holonomy.p50 > 0.01
        ? Math.exp(-holonomy.p90 / holonomy.p50)
        : 0;
      holonomyScore = 0.6 * holonomyScore + 0.4 * concentration;
    }

    // ── 3. Composite score ──
    const score =
      0.45 * v7Result.cooperativeStability +
      0.30 * holonomyScore +
      0.15 * v7Result.symmetryAgreement +
      0.10 * (1 - v7Result.distortion);

    return {
      score,
      detail: `S=${v7Result.cooperativeStability.toFixed(4)} H=${holonomyScore.toFixed(4)} SYM=${v7Result.symmetryAgreement.toFixed(4)} D=${v7Result.distortion.toFixed(4)} tri=${triA.length}`,
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
