#!/usr/bin/env bun

/**
 * Run all experiments against the CEPH 1463 dataset (default).
 * This is the hardest benchmark — same-population, 6 members, 3 generations.
 *
 * Usage: bun run packages/experiments/src/run.ts
 * Force fresh: rm data/ceph-6/.cache.json
 */

import { join } from "path";
import { BenchmarkRunner } from "./runner.js";
import { Reporter } from "./reporter.js";
import { loadDataset, CEPH_1463 } from "./data-loader.js";
import { ALL_EXPERIMENTS } from "./algorithms/index.js";

const CACHE_PATH = join(CEPH_1463.dataDir, ".cache.json");
const REPORT_PATH = join(CEPH_1463.dataDir, "report.md");

async function main(): Promise<void> {
  console.log(`=== yalumba experiments — ${CEPH_1463.name} ===\n`);
  console.log(`${ALL_EXPERIMENTS.length} algorithms registered\n`);

  const samples = await loadDataset(CEPH_1463);
  console.log();

  const runner = new BenchmarkRunner(samples, CEPH_1463.pairs, CEPH_1463.id, CACHE_PATH);
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

  const sorted = BenchmarkRunner.sort(results);
  Reporter.printLeaderboard(sorted);

  const detecting = results.filter((r) => r.correct).length;
  const detectingAll = results.filter((r) => r.detectsMother).length;
  console.log(`\n${detecting}/${results.length} detect related > unrelated`);
  console.log(`${detectingAll}/${results.length} detect ALL related pairs`);

  Reporter.generateReport(sorted, CEPH_1463, REPORT_PATH);
}

main().catch((err) => {
  console.error("Framework error:", err);
  process.exit(1);
});
