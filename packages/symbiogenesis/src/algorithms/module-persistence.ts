/**
 * Algorithm Family 1: Module Persistence Graph (v2)
 *
 * Key fix from v1: build a SHARED module vocabulary across all samples,
 * then map each sample's reads to that vocabulary. This ensures the same
 * biological module gets the same ID across all samples.
 *
 * Additionally: filter to modules that are NOT universal (present in
 * fewer than all samples) — these carry ancestry signal, analogous
 * to how rare k-mers carry more signal than common ones.
 *
 * Compare samples by:
 *   1. Shared informative module identities
 *   2. Shared edge topology (module adjacency patterns)
 *   3. Module support correlation (similar usage frequencies)
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import { buildModules, buildModuleGraph } from "@yalumba/modules";
import type { Module, ModuleGraph } from "@yalumba/modules";

interface PreparedContext {
  /** Shared module vocabulary (union across all samples) */
  sharedModules: Module[];
  /** Per-sample: which shared modules are present + their local support */
  samplePresence: Map<string, Map<number, number>>;
  /** Per-sample module graphs using shared module IDs */
  graphs: Map<string, ModuleGraph>;
  /** Modules present in fewer than all samples (informative) */
  informativeModuleIds: Set<number>;
}

export const modulePersistence: SymbioAlgorithm = {
  name: "Module persistence graph",
  version: 2,
  description: "Shared module vocabulary + informative module filtering — graph topology of co-inherited modules",
  family: "module-persistence",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();

    // ── Step 1: Build modules per sample ──
    console.log("    [v2] Step 1: Extract modules per sample...");
    const perSampleModules = new Map<string, Module[]>();

    for (const sample of samples) {
      const st = performance.now();
      const modules = buildModules(sample.reads, {
        motifK: 15,
        windowSize: 50,
        minSupport: 3,
        minCohesion: 0.3,
      });
      perSampleModules.set(sample.id, modules);
      console.log(`      ${sample.id}: ${modules.length} modules (${((performance.now() - st) / 1000).toFixed(1)}s)`);
    }

    // ── Step 2: Build shared module vocabulary ──
    // Union all modules, deduplicate by member fingerprint
    console.log("    [v2] Step 2: Building shared module vocabulary...");
    const fpToModule = new Map<number, Module>();
    let sharedId = 0;

    for (const [, modules] of perSampleModules) {
      for (const mod of modules) {
        const fp = moduleFingerprint(mod.members);
        if (!fpToModule.has(fp)) {
          fpToModule.set(fp, { ...mod, id: sharedId++ });
        }
      }
    }

    const sharedModules = [...fpToModule.values()];
    console.log(`      ${sharedModules.length} unique modules in shared vocabulary`);

    // ── Step 3: Map each sample to shared vocabulary ──
    console.log("    [v2] Step 3: Mapping samples to shared vocabulary...");
    const samplePresence = new Map<string, Map<number, number>>();

    for (const [sampleId, modules] of perSampleModules) {
      const presence = new Map<number, number>();
      for (const mod of modules) {
        const fp = moduleFingerprint(mod.members);
        const sharedMod = fpToModule.get(fp);
        if (sharedMod) {
          presence.set(sharedMod.id, mod.support);
        }
      }
      samplePresence.set(sampleId, presence);
      console.log(`      ${sampleId}: ${presence.size} shared modules present`);
    }

    // ── Step 4: Identify informative modules (not universal) ──
    const modulePresenceCount = new Map<number, number>();
    for (const [, presence] of samplePresence) {
      for (const modId of presence.keys()) {
        modulePresenceCount.set(modId, (modulePresenceCount.get(modId) ?? 0) + 1);
      }
    }

    const informativeModuleIds = new Set<number>();
    for (const [modId, count] of modulePresenceCount) {
      // Informative = not in ALL samples (like rare k-mers)
      if (count < samples.length) {
        informativeModuleIds.add(modId);
      }
    }
    console.log(`      ${informativeModuleIds.size} informative modules (of ${sharedModules.length} total)`);

    // ── Step 5: Build graphs using shared vocabulary ──
    console.log("    [v2] Step 5: Building module graphs...");
    const graphs = new Map<string, ModuleGraph>();
    for (const sample of samples) {
      const graph = buildModuleGraph(sample.reads, sharedModules, 15);
      graphs.set(sample.id, graph);
    }

    console.log(`    [v2] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { sharedModules, samplePresence, graphs, informativeModuleIds };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const presA = ctx.samplePresence.get(a.id)!;
    const presB = ctx.samplePresence.get(b.id)!;
    const graphA = ctx.graphs.get(a.id)!;
    const graphB = ctx.graphs.get(b.id)!;

    // ── Score 1: Informative module overlap (Jaccard) ──
    let sharedInformative = 0;
    let unionInformative = 0;
    for (const modId of ctx.informativeModuleIds) {
      const inA = presA.has(modId);
      const inB = presB.has(modId);
      if (inA && inB) sharedInformative++;
      if (inA || inB) unionInformative++;
    }
    const infoJaccard = unionInformative > 0 ? sharedInformative / unionInformative : 0;

    // ── Score 2: Edge topology overlap (informative edges only) ──
    const edgeFpA = buildInformativeEdgeFPs(graphA, ctx.informativeModuleIds);
    const edgeFpB = buildInformativeEdgeFPs(graphB, ctx.informativeModuleIds);

    let sharedEdges = 0;
    for (const efp of edgeFpA) { if (edgeFpB.has(efp)) sharedEdges++; }
    const edgeUnion = edgeFpA.size + edgeFpB.size - sharedEdges;
    const edgeJaccard = edgeUnion > 0 ? sharedEdges / edgeUnion : 0;

    // ── Score 3: Module support correlation ──
    // For shared informative modules, compare their support values
    let dot = 0, normA = 0, normB = 0;
    for (const modId of ctx.informativeModuleIds) {
      const va = presA.get(modId) ?? 0;
      const vb = presB.get(modId) ?? 0;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const supportCosine = denom > 0 ? dot / denom : 0;

    // Combined: weight edge topology highest (most symbiogenesis-native)
    const score = infoJaccard * 0.3 + edgeJaccard * 0.4 + supportCosine * 0.3;

    return {
      score,
      detail: `infoMod=${sharedInformative}/${unionInformative} (${(infoJaccard * 100).toFixed(1)}%) edges=${sharedEdges}/${edgeUnion} (${(edgeJaccard * 100).toFixed(1)}%) cosine=${supportCosine.toFixed(4)}`,
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

function buildInformativeEdgeFPs(graph: ModuleGraph, informative: Set<number>): Set<number> {
  const fps = new Set<number>();
  for (const edge of graph.edges) {
    // Only count edges where at least one module is informative
    if (!informative.has(edge.from) && !informative.has(edge.to)) continue;
    const a = Math.min(edge.from, edge.to);
    const b = Math.max(edge.from, edge.to);
    fps.add(((a * 31) + b) >>> 0);
  }
  return fps;
}
