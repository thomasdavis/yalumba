/**
 * Algorithm Family 4: Spectral Ecology v6 — Symbiogenetic Persistence Fields
 *
 * v4 broke the spouse confound (gap -4.99%). v6 builds on v4's architecture
 * with three targeted fixes:
 *
 * 1. SYMMETRIZED FIELD: Φ(A→B) and Φ(B→A), penalize disagreement
 * 2. PERTURBATION COHERENCE: do fields resist noise? (inherited = yes)
 * 3. ROBUST AGGREGATION: trimmed mean, no single module dominates
 *
 * Weights commit to cooperative structure:
 *   0.30 perturbation coherence
 *   0.25 symmetry agreement
 *   0.25 cooperative stability
 *   0.10 curvature mismatch
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
}

export const spectralEcology: SymbioAlgorithm = {
  name: "Spectral ecology",
  version: 7,
  description: "Sinkhorn symmetry + cooperative stability 45% + per-sample patch normalization",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [spectral-ecology-v6] Building ecological patches...`);

    const prepared = new Map<string, SamplePatches>();

    for (const sample of samples) {
      const st = performance.now();
      console.log(`      ${sample.id}: graph + spectral + patches...`);

      const graph = buildInteractionGraph(sample.reads, EXTRACT_OPTS);
      const laplacian = normalizedLaplacian(graph.adjacency);
      const eigen = eigenDecomposition(laplacian);
      const roles = assignRoles(graph, eigen);
      const patches = extractPatches(sample.id, graph, roles);

      const elapsed = ((performance.now() - st) / 1000).toFixed(1);
      console.log(`        ${graph.n} modules, ${patches.n} patches (${elapsed}s)`);

      prepared.set(sample.id, patches);
    }

    console.log(`    [spectral-ecology-v6] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { samples: prepared };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const pA = ctx.samples.get(a.id)!;
    const pB = ctx.samples.get(b.id)!;

    // Use pair index as seed for deterministic perturbations
    const seed = hashPair(a.id, b.id);
    const result = solvePersistenceField(pA, pB, seed);

    return {
      score: result.score,
      detail: result.detail,
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
