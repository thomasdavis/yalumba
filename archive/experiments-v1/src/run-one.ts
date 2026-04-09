#!/usr/bin/env bun

/**
 * Run a SINGLE algorithm with detailed logging and timing breakdown.
 *
 * Usage:
 *   bun run packages/experiments/src/run-one.ts "Rare-run P90"
 *   bun run packages/experiments/src/run-one.ts --list
 */

import { join } from "path";
import { BenchmarkRunner } from "./runner.js";
import { loadDataset, CEPH_1463 } from "./data-loader.js";
import { ALL_EXPERIMENTS } from "./algorithms/index.js";
import type { Experiment, SampleData, PairDef, AlgorithmResult } from "./types.js";

const CACHE_PATH = join(CEPH_1463.dataDir, ".cache.json");
const arg = process.argv.slice(2).join(" ");

if (!arg || arg === "--list") {
  console.log("Available algorithms:\n");
  for (const exp of ALL_EXPERIMENTS) {
    console.log(`  "${exp.name}" (v${exp.version}) — ${exp.description}`);
  }
  console.log(`\n${ALL_EXPERIMENTS.length} algorithms total`);
  process.exit(0);
}

const experiment = ALL_EXPERIMENTS.find((e) => e.name === arg);
if (!experiment) {
  console.error(`Algorithm not found: "${arg}"`);
  console.error(`Run with --list to see available algorithms`);
  process.exit(1);
}

async function main(exp: Experiment): Promise<void> {
  const dataset = CEPH_1463;

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log(`║  ${exp.name.padEnd(56)}  ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`Description: ${exp.description}`);
  console.log(`Version:     ${exp.version}`);
  console.log(`Max reads:   ${exp.maxReadsPerSample?.toLocaleString() ?? "unlimited"}`);
  console.log(`Dataset:     ${dataset.name}`);
  console.log(`Samples:     ${dataset.samples.length}`);
  console.log(`Pairs:       ${dataset.pairs.length}`);
  console.log();

  // ── Phase 1: Load data ──
  console.log("── Phase 1: Loading data ──");
  const loadStart = performance.now();
  const samples = await loadDataset(dataset);
  const loadMs = performance.now() - loadStart;
  console.log(`  Total load time: ${(loadMs / 1000).toFixed(2)}s`);

  for (const [id, sample] of samples) {
    const readLen = sample.reads[0]?.length ?? 0;
    const totalBases = sample.reads.reduce((s, r) => s + r.length, 0);
    console.log(`  ${id}: ${sample.reads.length.toLocaleString()} reads × ${readLen}bp = ${(totalBases / 1e6).toFixed(1)}Mb`);
  }
  console.log();

  // ── Phase 2: Subsample ──
  const maxReads = exp.maxReadsPerSample ?? Infinity;
  const subsampled = new Map<string, SampleData>();
  for (const [id, sample] of samples) {
    if (sample.reads.length > maxReads) {
      subsampled.set(id, { ...sample, reads: sample.reads.slice(0, maxReads) });
      console.log(`  Subsampled ${id}: ${sample.reads.length.toLocaleString()} → ${maxReads.toLocaleString()} reads`);
    } else {
      subsampled.set(id, sample);
    }
  }
  console.log();

  // ── Phase 3: Prepare (if applicable) ──
  let context: unknown = undefined;
  if (exp.prepare) {
    console.log("── Phase 2: Prepare (preprocessing all samples) ──");
    const prepStart = performance.now();

    // Memory snapshot before
    const memBefore = process.memoryUsage();
    context = exp.prepare([...subsampled.values()]);
    const prepMs = performance.now() - prepStart;
    const memAfter = process.memoryUsage();

    console.log(`  Prep time:   ${(prepMs / 1000).toFixed(2)}s`);
    console.log(`  Heap before: ${(memBefore.heapUsed / 1e6).toFixed(1)}MB`);
    console.log(`  Heap after:  ${(memAfter.heapUsed / 1e6).toFixed(1)}MB`);
    console.log(`  Heap delta:  +${((memAfter.heapUsed - memBefore.heapUsed) / 1e6).toFixed(1)}MB`);
    console.log(`  RSS:         ${(memAfter.rss / 1e6).toFixed(1)}MB`);
    console.log();
  } else {
    console.log("── Phase 2: No prepare step ──\n");
  }

  // ── Phase 4: Compare all pairs ──
  console.log("── Phase 3: Comparing pairs ──\n");

  const pairResults: {
    pair: string; label: string; related: boolean;
    score: number; detail: string; timeMs: number;
  }[] = [];

  for (const pair of dataset.pairs) {
    const a = subsampled.get(pair.a)!;
    const b = subsampled.get(pair.b)!;

    process.stdout.write(`  ${pair.a} ↔ ${pair.b} (${pair.label})... `);
    const start = performance.now();
    const result = exp.compare(a, b, context);
    const timeMs = performance.now() - start;

    pairResults.push({
      pair: `${pair.a} ↔ ${pair.b}`,
      label: pair.label,
      related: pair.related,
      score: result.score,
      detail: result.detail,
      timeMs,
    });

    console.log(`${(timeMs / 1000).toFixed(2)}s`);
    console.log(`    Score:  ${result.score.toFixed(6)}`);
    console.log(`    Detail: ${result.detail}`);
    console.log();
  }

  // ── Phase 5: Analysis ──
  console.log("── Phase 4: Analysis ──\n");

  const related = pairResults.filter((p) => p.related);
  const unrelated = pairResults.filter((p) => !p.related);
  const avgRelated = related.reduce((s, p) => s + p.score, 0) / related.length;
  const avgUnrelated = unrelated.reduce((s, p) => s + p.score, 0) / unrelated.length;
  const separation = avgRelated - avgUnrelated;

  const weakestRelated = related.reduce((min, p) => p.score < min.score ? p : min);
  const strongestUnrelated = unrelated.reduce((max, p) => p.score > max.score ? p : max);
  const weakestGap = weakestRelated.score - strongestUnrelated.score;
  const detectsAll = weakestGap > 0;

  console.log("  Scores by pair:");
  for (const p of [...pairResults].sort((a, b) => b.score - a.score)) {
    const marker = p.related ? "►" : " ";
    const bar = "█".repeat(Math.max(0, Math.round(p.score * 20)));
    console.log(`    ${marker} ${p.score.toFixed(6)} ${bar} ${p.pair} (${p.label})`);
  }

  console.log();
  console.log(`  Avg related:          ${avgRelated.toFixed(6)}`);
  console.log(`  Avg unrelated:        ${avgUnrelated.toFixed(6)}`);
  console.log(`  Separation:           ${separation >= 0 ? "+" : ""}${(separation * 100).toFixed(4)}%`);
  console.log(`  Weakest related:      ${weakestRelated.score.toFixed(6)} (${weakestRelated.label})`);
  console.log(`  Strongest unrelated:  ${strongestUnrelated.score.toFixed(6)} (${strongestUnrelated.label})`);
  console.log(`  Weakest pair gap:     ${weakestGap >= 0 ? "+" : ""}${(weakestGap * 100).toFixed(4)}%`);
  console.log(`  Detects ALL pairs:    ${detectsAll ? "YES ✓" : "NO ✗"}`);

  // ── Timing breakdown ──
  console.log();
  console.log("── Timing breakdown ──\n");
  const totalCompare = pairResults.reduce((s, p) => s + p.timeMs, 0);
  console.log(`  Data loading:    ${(loadMs / 1000).toFixed(2)}s`);
  if (exp.prepare) {
    // prepMs not in scope here, recalculate isn't possible
    // but we can show compare time
  }
  console.log(`  All comparisons: ${(totalCompare / 1000).toFixed(2)}s`);
  console.log(`  Per pair avg:    ${(totalCompare / pairResults.length / 1000).toFixed(2)}s`);
  console.log(`  Slowest pair:    ${(Math.max(...pairResults.map((p) => p.timeMs)) / 1000).toFixed(2)}s`);
  console.log(`  Fastest pair:    ${(Math.min(...pairResults.map((p) => p.timeMs)) / 1000).toFixed(2)}s`);
  console.log(`  Compute type:    CPU (TypeScript/V8) — native C acceleration available but not yet wired`);

  // ── Visualization suggestions ──
  console.log();
  console.log("── Visualization suggestions ──\n");
  console.log("  1. BAR CHART: Score per pair — height = score, color = related/unrelated");
  console.log("     Shows separation gap visually. Related bars should be taller.");
  console.log("  2. HEATMAP: 6×6 matrix of all pairwise scores");
  console.log("     Rows/cols = samples, cell color = score. IBD blocks visible as warm cells.");
  console.log("  3. HISTOGRAM: Run-length distribution (if run-based algorithm)");
  console.log("     X = run length, Y = frequency. Related pairs should have heavier right tail.");
  console.log("  4. VIOLIN PLOT: Score distribution across related vs unrelated groups");
  console.log("     Shows overlap (or lack thereof) between the two groups.");
  console.log("  5. LINE CHART: Score vs pair rank");
  console.log("     Sorted by score. The gap between the 4th and 5th point is the separation.");
}

main(experiment).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
