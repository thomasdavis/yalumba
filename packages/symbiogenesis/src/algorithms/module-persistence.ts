/**
 * Algorithm Family 1: Module Persistence Graph
 *
 * Construct a module graph for each sample:
 *   - Nodes = motif clusters (modules) that repeatedly co-occur
 *   - Edges = module adjacency patterns observed across reads
 *
 * Compare samples by:
 *   - Shared module identities (same motif clusters exist)
 *   - Shared edge topology (same modules appear adjacent)
 *   - Edge weight correlation (same adjacency frequencies)
 *
 * Hypothesis: related individuals share not just modules,
 * but the INTERACTION TOPOLOGY between modules — the way
 * inherited genomic blocks are arranged relative to each other.
 *
 * This is genuinely symbiogenesis-native because the signal
 * comes from module RELATIONSHIPS, not individual markers.
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import { buildModules, buildModuleGraph } from "@yalumba/modules";
import type { ModuleGraph } from "@yalumba/modules";

interface PreparedContext {
  graphs: Map<string, ModuleGraph>;
}

export const modulePersistence: SymbioAlgorithm = {
  name: "Module persistence graph",
  version: 1,
  description: "Compare module interaction topology — shared graph edges indicate co-inherited genomic architecture",
  family: "module-persistence",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    console.log("    [module-persistence] Building module graphs...");
    const graphs = new Map<string, ModuleGraph>();

    for (const sample of samples) {
      const t0 = performance.now();
      console.log(`      ${sample.id}: extracting modules...`);

      // Phase 1: Discover modules
      const modules = buildModules(sample.reads, {
        motifK: 15,
        windowSize: 50,
        minSupport: 3,
        minCohesion: 0.3,
      });
      console.log(`        ${modules.length} modules found (${((performance.now() - t0) / 1000).toFixed(1)}s)`);

      // Phase 2: Build graph
      const t1 = performance.now();
      const graph = buildModuleGraph(sample.reads, modules, 15);
      console.log(`        ${graph.edges.length} edges, ${graph.modules.length} nodes (${((performance.now() - t1) / 1000).toFixed(1)}s)`);

      graphs.set(sample.id, graph);
    }

    return { graphs };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const { graphs } = context as PreparedContext;
    const graphA = graphs.get(a.id)!;
    const graphB = graphs.get(b.id)!;

    // Strategy 1: Module identity overlap
    // Build fingerprints from module member sets
    const fpA = new Set<number>();
    for (const mod of graphA.modules) {
      fpA.add(moduleFingerprint(mod.members));
    }
    const fpB = new Set<number>();
    for (const mod of graphB.modules) {
      fpB.add(moduleFingerprint(mod.members));
    }

    let sharedModules = 0;
    for (const fp of fpA) { if (fpB.has(fp)) sharedModules++; }
    const moduleUnion = fpA.size + fpB.size - sharedModules;
    const moduleJaccard = moduleUnion > 0 ? sharedModules / moduleUnion : 0;

    // Strategy 2: Edge topology overlap
    // Build edge fingerprints from (module_fp_from, module_fp_to)
    const edgeFpA = buildEdgeFingerprints(graphA);
    const edgeFpB = buildEdgeFingerprints(graphB);

    let sharedEdges = 0;
    for (const efp of edgeFpA) { if (edgeFpB.has(efp)) sharedEdges++; }
    const edgeUnion = edgeFpA.size + edgeFpB.size - sharedEdges;
    const edgeJaccard = edgeUnion > 0 ? sharedEdges / edgeUnion : 0;

    // Combined score: module overlap + edge topology
    const score = moduleJaccard * 0.4 + edgeJaccard * 0.6;

    return {
      score,
      detail: `modules=${sharedModules}/${moduleUnion} (${(moduleJaccard * 100).toFixed(2)}%) edges=${sharedEdges}/${edgeUnion} (${(edgeJaccard * 100).toFixed(2)}%)`,
    };
  },
};

function moduleFingerprint(members: readonly number[]): number {
  const sorted = [...members].sort((a, b) => a - b);
  let h = 0x811c9dc5 | 0;
  for (const m of sorted) {
    h ^= m;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function buildEdgeFingerprints(graph: ModuleGraph): Set<number> {
  const fps = new Set<number>();
  const moduleFps = new Map<number, number>();
  for (const mod of graph.modules) {
    moduleFps.set(mod.id, moduleFingerprint(mod.members));
  }

  for (const edge of graph.edges) {
    const fromFp = moduleFps.get(edge.from) ?? 0;
    const toFp = moduleFps.get(edge.to) ?? 0;
    // Canonical edge: sort by fingerprint
    const a = Math.min(fromFp, toFp);
    const b = Math.max(fromFp, toFp);
    fps.add(((a * 31) + b) >>> 0);
  }

  return fps;
}
