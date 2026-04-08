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
import { loadDataset, GIAB_TRIO } from "./data-loader.js";
import { ALL_EXPERIMENTS } from "./algorithms/index.js";

const CACHE_PATH = join(GIAB_TRIO.dataDir, ".cache.json");

async function main(): Promise<void> {
  console.log(`=== yalumba experiments — ${GIAB_TRIO.name} ===\n`);
  console.log(`${ALL_EXPERIMENTS.length} algorithms registered\n`);

  const samples = await loadDataset(GIAB_TRIO);
  console.log();

  const runner = new BenchmarkRunner(samples, GIAB_TRIO.pairs, GIAB_TRIO.id, CACHE_PATH);
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

  Reporter.printLeaderboard(BenchmarkRunner.sort(results));

  const detecting = results.filter((r) => r.correct).length;
  const detectingMother = results.filter((r) => r.detectsMother).length;
  console.log(`\n${detecting}/${results.length} detect father-son`);
  console.log(`${detectingMother}/${results.length} detect BOTH parent-child pairs`);
}

main().catch((err) => {
  console.error("Framework error:", err);
  process.exit(1);
});
