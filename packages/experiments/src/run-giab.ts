#!/usr/bin/env bun

/**
 * Run all experiments against the GIAB Ashkenazi trio dataset.
 * Caches results to disk — only re-runs when algorithm version changes.
 *
 * Usage: bun run packages/experiments/src/run-giab.ts
 * Force fresh: rm data/giab/.cache.json
 */

import { join } from "path";
import { BenchmarkRunner } from "./runner.js";
import { Reporter } from "./reporter.js";
import { loadSample, GIAB_SAMPLES, GIAB_PAIRS } from "./data-loader.js";
import { ALL_EXPERIMENTS } from "./algorithms/index.js";

const DATA_DIR = join(import.meta.dir, "../../../data/giab");
const CACHE_PATH = join(DATA_DIR, ".cache.json");
const MAX_READS = 2_000_000;

async function main(): Promise<void> {
  console.log("=== yalumba experiment framework — GIAB Ashkenazi trio ===\n");
  console.log(`HG003 (Father) + HG004 (Mother) → HG002 (Son)`);
  console.log(`${ALL_EXPERIMENTS.length} algorithms registered\n`);

  const samples = new Map<string, Awaited<ReturnType<typeof loadSample>>>();
  for (const def of GIAB_SAMPLES) {
    process.stdout.write(`Loading ${def.id} (${def.role})... `);
    const start = performance.now();
    const sample = await loadSample(DATA_DIR, def, MAX_READS);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    samples.set(def.id, sample);
    console.log(`${sample.reads.length.toLocaleString()} reads (${elapsed}s)`);
  }
  console.log();

  const runner = new BenchmarkRunner(samples, GIAB_PAIRS, CACHE_PATH);
  const results = [];

  for (const experiment of ALL_EXPERIMENTS) {
    process.stdout.write(`${experiment.name} (v${experiment.version})... `);
    try {
      const { result, cached } = runner.run(experiment);
      results.push(result);
      if (cached) {
        console.log(`CACHED (sep=${(result.separation * 100).toFixed(4)}%)`);
      } else {
        Reporter.printDetail(result);
      }
    } catch (err) {
      console.log(`FAILED: ${err}`);
    }
  }

  const sorted = results.sort((a, b) => {
    if (a.correct !== b.correct) return a.correct ? -1 : 1;
    if (a.detectsMother !== b.detectsMother) return a.detectsMother ? -1 : 1;
    return Math.abs(b.separation) - Math.abs(a.separation);
  });

  Reporter.printLeaderboard(sorted);

  const detecting = sorted.filter((r) => r.correct).length;
  const detectingMother = sorted.filter((r) => r.detectsMother).length;
  console.log(`\n${detecting}/${sorted.length} detect father-son`);
  console.log(`${detectingMother}/${sorted.length} detect BOTH parent-child pairs`);
}

main().catch((err) => {
  console.error("Framework error:", err);
  process.exit(1);
});
