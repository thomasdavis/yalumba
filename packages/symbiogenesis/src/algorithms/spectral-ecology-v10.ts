/**
 * Spectral Ecology v10 — Hybrid: v9 intrinsic curvature + v7 cooperative stability
 *
 * v9 has best separation (+3.20%) — intrinsic curvature detects structural similarity
 * v7 has best gap (-0.61%) — cooperative stability resists coverage confound
 *
 * The hybrid combines both signals:
 *   - v9's Bhattacharyya/EMD curvature comparison (no cross-sample field)
 *   - v7's cooperative stability from coherence fields (cross-sample)
 *
 * These are complementary because:
 *   - Curvature: intrinsic, identity-free, second-order
 *   - Cooperative stability: relational, context-aware, first-order
 *   - Different failure modes: curvature fails on coverage similarity,
 *     cooperative stability fails on outlier modules
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import {
  buildInteractionGraph,
  normalizedLaplacian,
  eigenDecomposition,
  assignRoles,
  extractPatches,
  solvePersistenceField,
  computeCurvatureProfile,
  compareCurvatureProfiles,
} from "@yalumba/ecology";
import type { SamplePatches, CurvatureProfile } from "@yalumba/ecology";
import type { ModuleExtractionOptions } from "@yalumba/modules";

const EXTRACT_OPTS: ModuleExtractionOptions = {
  motifK: 15,
  windowSize: 150,
  minSupport: 3,
  minCohesion: 0.25,
};

interface PreparedContext {
  patches: Map<string, SamplePatches>;
  curvatureProfiles: Map<string, CurvatureProfile>;
}

export const spectralEcologyV10: SymbioAlgorithm = {
  name: "Spectral ecology v10",
  version: 10,
  description: "Hybrid: intrinsic curvature (v9) + cooperative stability (v7) — complementary invariants",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [v10-hybrid] Building patches + curvature profiles...`);

    const patchesMap = new Map<string, SamplePatches>();
    const curvatureMap = new Map<string, CurvatureProfile>();

    for (const sample of samples) {
      const st = performance.now();

      const graph = buildInteractionGraph(sample.reads, EXTRACT_OPTS);
      const laplacian = normalizedLaplacian(graph.adjacency);
      const eigen = eigenDecomposition(laplacian);
      const roles = assignRoles(graph, eigen);
      const patches = extractPatches(sample.id, graph, roles);
      const curvature = computeCurvatureProfile(patches);

      patchesMap.set(sample.id, patches);
      curvatureMap.set(sample.id, curvature);

      const elapsed = ((performance.now() - st) / 1000).toFixed(1);
      console.log(`      ${sample.id}: ${patches.n} mod, ${curvature.triangleCount} tri, μ=${curvature.mean.toFixed(3)} (${elapsed}s)`);
    }

    console.log(`    [v10-hybrid] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { patches: patchesMap, curvatureProfiles: curvatureMap };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const pA = ctx.patches.get(a.id)!;
    const pB = ctx.patches.get(b.id)!;
    const curvA = ctx.curvatureProfiles.get(a.id)!;
    const curvB = ctx.curvatureProfiles.get(b.id)!;

    // ── v7 component: cooperative stability ──
    const seed = hashPair(a.id, b.id);
    const field = solvePersistenceField(pA, pB, seed);

    // ── v9 component: intrinsic curvature distribution similarity ──
    const curvResult = compareCurvatureProfiles(curvA, curvB);

    // ── Hybrid score ──
    // v7's cooperative stability is the best gap-reducer
    // v9's curvature similarity is the best separation-producer
    // v7's best configuration (55% coop + 15% sym + 15% curv + 10% dist + 5% pert)
    // combined with v9 curvature for additional signal
    const score =
      0.45 * field.cooperativeStability +
      0.20 * curvResult.score +
      0.15 * field.symmetryAgreement +
      0.10 * (1 - field.curvatureMismatch) +
      0.10 * (1 - field.distortion);

    return {
      score,
      detail: `coop=${field.cooperativeStability.toFixed(4)} curv=${curvResult.score.toFixed(4)} sym=${field.symmetryAgreement.toFixed(4)} BC=${curvResult.bhattacharyya.toFixed(4)}`,
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
