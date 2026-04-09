/**
 * Build modules from reads.
 *
 * A module = a set of motifs that repeatedly co-occur.
 *
 * Memory strategy: use streaming counts with a fixed-size hash table
 * to avoid OOM. For truly large-scale work, the C native library
 * should be used via @yalumba/compute.
 *
 * Algorithm:
 * 1. First pass: count individual motif frequencies
 * 2. Filter to frequent motifs (removes noise)
 * 3. Second pass: count co-occurrences of frequent motifs only
 * 4. Cluster into modules via connected components
 */

import type { Module, ModuleExtractionOptions } from "./types.js";
import { extractMotifsWithPositions } from "./motif-extractor.js";

const DEFAULT_OPTIONS: Required<ModuleExtractionOptions> = {
  motifK: 15,
  windowSize: 50,
  minSupport: 3,
  minCohesion: 0.3,
};

/**
 * Build modules from a set of reads.
 * Uses a two-pass approach to control memory:
 *   Pass 1: Find frequent motifs
 *   Pass 2: Count co-occurrences of frequent motifs only
 */
export function buildModules(
  reads: readonly string[],
  options: ModuleExtractionOptions = {},
): Module[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ── Pass 1: Count motif frequencies ──
  const motifFreq = new Map<number, number>();
  for (const read of reads) {
    const motifs = extractMotifsWithPositions(read, opts.motifK);
    const seen = new Set<number>();
    for (const m of motifs) {
      if (!seen.has(m.hash)) {
        seen.add(m.hash);
        motifFreq.set(m.hash, (motifFreq.get(m.hash) ?? 0) + 1);
      }
    }
  }

  // Filter to motifs with sufficient support
  const frequentMotifs = new Set<number>();
  for (const [motif, freq] of motifFreq) {
    if (freq >= opts.minSupport) frequentMotifs.add(motif);
  }

  console.log(`        [module-builder] ${frequentMotifs.size.toLocaleString()} frequent motifs (of ${motifFreq.size.toLocaleString()} total)`);

  // ── Pass 2: Count pairwise co-occurrences of frequent motifs ──
  // Use a fixed-size open-addressing hash table to control memory
  // Table size: 16M entries (~128MB) — enough for millions of pairs
  const TABLE_SIZE = 1 << 24; // 16M
  const TABLE_MASK = TABLE_SIZE - 1;
  const tableKeys = new Uint32Array(TABLE_SIZE);   // pair hash
  const tableVals = new Uint16Array(TABLE_SIZE);   // count (max 65535)
  const tableMotifA = new Uint32Array(TABLE_SIZE); // first motif
  const tableMotifB = new Uint32Array(TABLE_SIZE); // second motif

  let insertions = 0;
  const MAX_LOAD = TABLE_SIZE * 0.7; // 70% load factor

  for (const read of reads) {
    if (insertions > MAX_LOAD) break; // Stop if table is getting full

    const motifs = extractMotifsWithPositions(read, opts.motifK);
    // Collect frequent motifs in this read with positions
    const readFrequent: { hash: number; position: number }[] = [];
    for (const m of motifs) {
      if (frequentMotifs.has(m.hash)) readFrequent.push(m);
    }

    // Count co-occurrences within window
    for (let i = 0; i < readFrequent.length; i++) {
      for (let j = i + 1; j < readFrequent.length; j++) {
        if (readFrequent[j]!.position - readFrequent[i]!.position > opts.windowSize) break;

        const a = Math.min(readFrequent[i]!.hash, readFrequent[j]!.hash);
        const b = Math.max(readFrequent[i]!.hash, readFrequent[j]!.hash);
        const pairHash = ((a * 0x9e3779b9) ^ b) >>> 0;

        // Open-addressing insert/increment
        let idx = pairHash & TABLE_MASK;
        while (tableKeys[idx] !== 0 && tableKeys[idx] !== pairHash) {
          idx = (idx + 1) & TABLE_MASK;
        }
        if (tableKeys[idx] === 0) {
          // New entry
          tableKeys[idx] = pairHash;
          tableMotifA[idx] = a;
          tableMotifB[idx] = b;
          tableVals[idx] = 1;
          insertions++;
        } else {
          // Existing entry — increment
          if (tableVals[idx]! < 65535) tableVals[idx]!++;
        }
      }
    }
  }

  console.log(`        [module-builder] ${insertions.toLocaleString()} motif pairs tracked (table ${(insertions / TABLE_SIZE * 100).toFixed(1)}% full)`);

  // ── Phase 3: Build adjacency graph from high co-occurrence pairs ──
  const adjacency = new Map<number, Set<number>>();

  for (let i = 0; i < TABLE_SIZE; i++) {
    if (tableKeys[i] === 0) continue;
    const count = tableVals[i]!;
    if (count < opts.minSupport) continue;

    const a = tableMotifA[i]!;
    const b = tableMotifB[i]!;

    // Check cohesion
    const supportA = motifFreq.get(a) ?? 0;
    const supportB = motifFreq.get(b) ?? 0;
    const cohesion = count / Math.min(supportA, supportB);
    if (cohesion < opts.minCohesion) continue;

    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  console.log(`        [module-builder] ${adjacency.size.toLocaleString()} motifs in co-occurrence graph`);

  // ── Phase 4: Connected components = modules ──
  const visited = new Set<number>();
  const modules: Module[] = [];
  let moduleId = 0;

  for (const node of adjacency.keys()) {
    if (visited.has(node)) continue;

    const component: number[] = [];
    const queue = [node];
    visited.add(node);

    while (queue.length > 0 && component.length < 200) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Skip singleton and tiny components
    if (component.length < 2) continue;

    const support = Math.min(
      ...component.slice(0, 20).map((m) => motifFreq.get(m) ?? 0),
    );

    // Quick cohesion estimate from first few pairs
    let totalCoh = 0;
    let pairs = 0;
    for (let ci = 0; ci < Math.min(component.length, 10); ci++) {
      for (let cj = ci + 1; cj < Math.min(component.length, 10); cj++) {
        const neighbors = adjacency.get(component[ci]!);
        if (neighbors?.has(component[cj]!)) totalCoh += 1;
        pairs++;
      }
    }
    const cohesion = pairs > 0 ? totalCoh / pairs : 0;
    if (cohesion < opts.minCohesion) continue;

    modules.push({
      id: moduleId++,
      members: component,
      support,
      cohesion,
      spanBp: opts.windowSize,
    });
  }

  console.log(`        [module-builder] ${modules.length} modules discovered`);
  return modules;
}
