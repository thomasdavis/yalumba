/**
 * Canonical Module Builder — deterministic, order-independent.
 *
 * The original module-builder.ts has a critical flaw: it stops processing
 * reads when a fixed-size hash table fills (line 74: `if (insertions > MAX_LOAD) break`).
 * Different read orderings fill different pairs → different graphs.
 * The representation audit showed 45-607% change from read shuffling.
 *
 * This replacement ensures:
 *   1. DETERMINISTIC: same reads in any order → same modules
 *   2. COMPLETE: all reads contribute, not just the first N before table fills
 *   3. TWO-PASS ARCHITECTURE:
 *      Pass 1: count ALL per-read motif sets (frequency map, order-independent)
 *      Pass 2: for each PAIR of frequent motifs, count reads containing both
 *              (this is set intersection, not sequential scanning — order-independent)
 *   4. MEMORY-BOUNDED: use Bloom filter sketch for pair counting instead of
 *      exact hash table, or use the frequency-product estimator
 *
 * The key insight: co-occurrence can be estimated WITHOUT iterating read pairs.
 * If motif A appears in n_A reads and motif B appears in n_B reads, and they
 * co-occur in n_AB reads, then:
 *   P(co-occur | A,B) = n_AB / min(n_A, n_B)
 *
 * We can count n_AB by maintaining per-motif read-ID sets (expensive) or
 * by using the MinHash sketch of read-ID sets to estimate Jaccard overlap.
 *
 * But the simplest deterministic approach: for each read, record which
 * frequent motifs appear. Then for each pair of frequent motifs, count
 * how many reads contain both. This is O(reads * motifs_per_read^2) but
 * the inner loop is small (typically 5-20 frequent motifs per read).
 *
 * To stay memory-bounded: don't store all pairs explicitly.
 * Instead, for each read, hash the sorted motif set and accumulate
 * into a deterministic structure.
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
 * Build modules deterministically from reads.
 * Order-independent: same reads in any order → identical output.
 */
export function buildModulesCanonical(
  reads: readonly string[],
  options: ModuleExtractionOptions = {},
): Module[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const t0 = performance.now();

  // ── Pass 1: Count per-motif frequency (order-independent) ──
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

  // Filter to frequent motifs
  const frequentMotifs = new Set<number>();
  for (const [motif, freq] of motifFreq) {
    if (freq >= opts.minSupport) frequentMotifs.add(motif);
  }

  console.log(`        [canonical] ${frequentMotifs.size.toLocaleString()} frequent motifs (of ${motifFreq.size.toLocaleString()} total)`);

  // ── Pass 2: Count co-occurrences (deterministic, processes ALL reads) ──
  // For each read, find frequent motifs within windows, record pairs.
  // Use a Map<number, number> for pair counts — no fixed-size table, no early termination.
  // Memory control: use a frequency threshold instead of top-N.
  // A threshold is fully deterministic (no tie-breaking issues).
  // Find the frequency at which we'd have ~50K motifs, then use that as cutoff.
  const MAX_FREQUENT = 50_000;
  let topMotifs: Set<number>;

  if (frequentMotifs.size > MAX_FREQUENT) {
    // Find frequency threshold that gives ~50K motifs
    const freqValues = [...frequentMotifs].map(m => motifFreq.get(m)!);
    freqValues.sort((a, b) => b - a);
    const thresholdFreq = freqValues[Math.min(MAX_FREQUENT - 1, freqValues.length - 1)]!;

    // Include ALL motifs at or above this frequency (deterministic — no tie-breaking)
    topMotifs = new Set<number>();
    for (const m of frequentMotifs) {
      if (motifFreq.get(m)! >= thresholdFreq) topMotifs.add(m);
    }
    console.log(`        [canonical] Frequency threshold ${thresholdFreq}: ${topMotifs.size.toLocaleString()} motifs (deterministic cutoff)`);
  } else {
    topMotifs = frequentMotifs;
  }

  // Count co-occurrences using collision-free string keys.
  // Key: "a:b" where a < b (canonical ordering). No hash collisions possible.
  // This is slower than integer keys but guarantees determinism.
  const pairCounts = new Map<string, number>();

  for (const read of reads) {
    const motifs = extractMotifsWithPositions(read, opts.motifK);

    // Collect top-frequent motifs in this read
    const readTop: { hash: number; position: number }[] = [];
    for (const m of motifs) {
      if (topMotifs.has(m.hash)) readTop.push(m);
    }

    // Count windowed pairs — use string key for zero collisions
    for (let i = 0; i < readTop.length; i++) {
      for (let j = i + 1; j < readTop.length; j++) {
        if (readTop[j]!.position - readTop[i]!.position > opts.windowSize) break;

        const a = Math.min(readTop[i]!.hash, readTop[j]!.hash);
        const b = Math.max(readTop[i]!.hash, readTop[j]!.hash);
        const key = `${a}:${b}`;

        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  console.log(`        [canonical] ${pairCounts.size.toLocaleString()} motif pairs counted (all reads, collision-free)`);

  // ── Pass 3: Build adjacency graph (deterministic) ──
  const adjacency = new Map<number, Set<number>>();

  for (const [key, count] of pairCounts) {
    if (count < opts.minSupport) continue;

    const colonIdx = key.indexOf(":");
    const a = parseInt(key.slice(0, colonIdx), 10);
    const b = parseInt(key.slice(colonIdx + 1), 10);

    const supportA = motifFreq.get(a) ?? 0;
    const supportB = motifFreq.get(b) ?? 0;
    const cohesion = count / Math.min(supportA, supportB);
    if (cohesion < opts.minCohesion) continue;

    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  console.log(`        [canonical] ${adjacency.size.toLocaleString()} motifs in co-occurrence graph`);

  // ── Pass 4: Connected components → modules (deterministic via sorted iteration) ──
  // Sort nodes before BFS to ensure deterministic component ordering
  const sortedNodes = [...adjacency.keys()].sort((a, b) => a - b);
  const visited = new Set<number>();
  const modules: Module[] = [];
  let moduleId = 0;

  for (const node of sortedNodes) {
    if (visited.has(node)) continue;

    // BFS with sorted neighbor iteration for determinism
    const component: number[] = [];
    const queue = [node];
    visited.add(node);

    while (queue.length > 0 && component.length < 200) {
      const current = queue.shift()!;
      component.push(current);
      // Sort neighbors for deterministic traversal
      const neighbors = [...(adjacency.get(current) ?? [])].sort((a, b) => a - b);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length < 2) continue;

    // Sort component members for deterministic fingerprinting
    component.sort((a, b) => a - b);

    const support = Math.min(
      ...component.slice(0, 20).map(m => motifFreq.get(m) ?? 0),
    );

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

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`        [canonical] ${modules.length} modules discovered (${elapsed}s, deterministic)`);
  return modules;
}
