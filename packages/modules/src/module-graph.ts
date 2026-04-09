/**
 * Build module graphs from reads.
 *
 * After modules are extracted, we scan reads to detect:
 * - Which modules are present in each read
 * - How modules are arranged (adjacency/order)
 * - Module-to-module transition patterns
 */

import type { Module, ModuleGraph, ModuleEdge } from "./types.js";
import { extractMotifsWithPositions } from "./motif-extractor.js";

/**
 * Build a module graph from reads and a set of known modules.
 * Maps reads to module sequences, then records adjacency patterns.
 */
export function buildModuleGraph(
  reads: readonly string[],
  modules: readonly Module[],
  motifK: number = 15,
): ModuleGraph {
  // Build motif → module lookup
  const motifToModule = new Map<number, number>();
  for (const mod of modules) {
    for (const member of mod.members) {
      motifToModule.set(member, mod.id);
    }
  }

  // Scan reads for module sequences
  const edgeCounts = new Map<string, { count: number; totalGap: number }>();

  for (const read of reads) {
    const motifs = extractMotifsWithPositions(read, motifK);

    // Map each motif to its module (if any)
    let prevModule = -1;
    let prevPos = 0;

    for (const m of motifs) {
      const moduleId = motifToModule.get(m.hash);
      if (moduleId === undefined) {
        prevModule = -1;
        continue;
      }

      if (prevModule !== -1 && moduleId !== prevModule) {
        const key = `${prevModule}:${moduleId}`;
        const existing = edgeCounts.get(key);
        const gap = m.position - prevPos;
        if (existing) {
          existing.count++;
          existing.totalGap += gap;
        } else {
          edgeCounts.set(key, { count: 1, totalGap: gap });
        }
      }

      prevModule = moduleId;
      prevPos = m.position;
    }
  }

  // Build edge list
  const edges: ModuleEdge[] = [];
  for (const [key, data] of edgeCounts) {
    if (data.count < 2) continue; // Prune low-support edges
    const [from, to] = key.split(":").map(Number);
    edges.push({
      from: from!,
      to: to!,
      weight: data.count,
      avgGapBp: data.totalGap / data.count,
    });
  }

  return {
    modules,
    edges,
    readCount: reads.length,
  };
}
