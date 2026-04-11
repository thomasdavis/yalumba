/**
 * Build dense module interaction graphs from reads.
 *
 * v1 FAILURE: sequential adjacency produced 2-5 edges from 300-450 modules.
 *             >99% disconnected → spectrum collapsed → coverage confound.
 *
 * v2 FIX: statistical co-occurrence. For each read, find ALL modules
 *          present, add edges between ALL pairs. Weight normalized by
 *          geometric mean of individual frequencies:
 *
 *            w(A,B) = cooccur(A,B) / sqrt(freq(A) * freq(B))
 *
 *          This approximates linkage disequilibrium without coordinates.
 *          Produces dense graphs (5-20% edge density) with continuous
 *          weights reflecting probabilistic dependence, not physical
 *          adjacency coincidences.
 */

import { buildModulesCanonical } from "@yalumba/modules";
import type { ModuleExtractionOptions } from "@yalumba/modules";
import { extractMotifsWithPositions } from "@yalumba/modules";
import type { InteractionGraph } from "./types.js";

/** Default extraction parameters */
const DEFAULT_OPTIONS: ModuleExtractionOptions = {
  motifK: 15,
  windowSize: 150,
  minSupport: 3,
  minCohesion: 0.25,
};

/**
 * Build a dense module interaction graph from raw reads.
 *
 * 1. Extract modules via buildModules()
 * 2. Build motif → module lookup
 * 3. For each read, find all modules present
 * 4. For each module pair on same read, increment co-occurrence
 * 5. Normalize: w(A,B) = cooccur(A,B) / sqrt(freq(A) * freq(B))
 * 6. Threshold low-weight edges to control density
 */
export function buildInteractionGraph(
  reads: readonly string[],
  options: ModuleExtractionOptions = DEFAULT_OPTIONS,
  edgeThreshold: number = 0.01,
): InteractionGraph {
  const modules = buildModulesCanonical(reads, options);
  if (modules.length === 0) return emptyGraph();

  const k = options.motifK ?? 15;
  const n = modules.length;

  // Module.id → dense index
  const idToIndex = new Map<number, number>();
  const nodeIds: number[] = [];
  const supports = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const mod = modules[i];
    if (!mod) continue;
    idToIndex.set(mod.id, i);
    nodeIds.push(mod.id);
    supports[i] = mod.support;
  }

  // Motif hash → module index (a motif may appear in one module)
  const motifToModule = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const mod = modules[i];
    if (!mod) continue;
    for (const member of mod.members) {
      motifToModule.set(member, i);
    }
  }

  // ── Scan reads for module co-occurrence ──
  // Raw co-occurrence counts and per-module read frequencies
  const cooccur = new Float64Array(n * n);
  const freq = new Float64Array(n); // reads containing each module

  for (const read of reads) {
    const motifs = extractMotifsWithPositions(read, k);

    // Find all modules present on this read
    const presentSet = new Set<number>();
    for (const m of motifs) {
      const modIdx = motifToModule.get(m.hash);
      if (modIdx !== undefined) presentSet.add(modIdx);
    }

    const present = [...presentSet];
    // Update per-module frequency
    for (const idx of present) {
      freq[idx]!++;
    }

    // Update pairwise co-occurrence for all module pairs on this read
    for (let a = 0; a < present.length; a++) {
      for (let b = a + 1; b < present.length; b++) {
        const i = present[a]!;
        const j = present[b]!;
        cooccur[i * n + j]!++;
        cooccur[j * n + i]!++;
      }
    }
  }

  // ── Normalize: w(A,B) = cooccur(A,B) / sqrt(freq(A) * freq(B)) ──
  const adjacency = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const raw = cooccur[i * n + j]!;
      if (raw < 1) continue;
      const denom = Math.sqrt(freq[i]! * freq[j]!);
      if (denom < 1e-12) continue;
      const w = raw / denom;
      if (w < edgeThreshold) continue;
      adjacency[i * n + j] = w;
      adjacency[j * n + i] = w;
    }
  }

  return {
    n,
    nodeIds,
    supports,
    adjacency: { data: adjacency, rows: n, cols: n },
    readCount: reads.length,
  };
}

function emptyGraph(): InteractionGraph {
  return {
    n: 0,
    nodeIds: [],
    supports: new Float64Array(0),
    adjacency: { data: new Float64Array(0), rows: 0, cols: 0 },
    readCount: 0,
  };
}
