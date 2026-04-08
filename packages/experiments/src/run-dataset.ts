#!/usr/bin/env bun

/**
 * Run experiments against any registered dataset.
 *
 * Usage:
 *   bun run packages/experiments/src/run-dataset.ts giab-ashkenazi-trio
 *   bun run packages/experiments/src/run-dataset.ts synthetic-family
 *   bun run packages/experiments/src/run-dataset.ts --list
 */

import { join } from "path";
import { BenchmarkRunner } from "./runner.js";
import { Reporter } from "./reporter.js";
import { loadDataset, loadSample, ALL_DATASETS } from "./data-loader.js";
import { ALL_EXPERIMENTS } from "./algorithms/index.js";
import type { DatasetDef, SampleData } from "./types.js";

const arg = process.argv[2];

if (!arg || arg === "--list") {
  console.log("Available datasets:\n");
  for (const ds of ALL_DATASETS) {
    console.log(`  ${ds.id.padEnd(30)} ${ds.name}`);
    console.log(`    ${ds.samples.length} samples, ${ds.pairs.length} pairs, max ${ds.maxReads.toLocaleString()} reads`);
    console.log();
  }
  process.exit(0);
}

const dataset = ALL_DATASETS.find((d) => d.id === arg);
if (!dataset) {
  console.error(`Unknown dataset: ${arg}`);
  console.error(`Run with --list to see available datasets`);
  process.exit(1);
}

async function main(ds: DatasetDef): Promise<void> {
  console.log(`=== yalumba experiments — ${ds.name} ===\n`);
  console.log(`Dataset: ${ds.id}`);
  console.log(`${ALL_EXPERIMENTS.length} algorithms registered\n`);

  let samples: Map<string, SampleData>;
  // Synthetic data isn't gzipped — handle differently
  if (ds.id === "synthetic-family") {
    samples = new Map();
    for (const def of ds.samples) {
      process.stdout.write(`  Loading ${def.id} (${def.role})... `);
      const start = performance.now();
      const fullPath = join(ds.dataDir, def.file);
      const text = await Bun.file(fullPath).text();
      const { FastqParser } = await import("@yalumba/fastq");
      const parser = new FastqParser({ validateQuality: false, validateSequence: false });
      const records = parser.parse(text);
      const reads = records.slice(0, ds.maxReads).map((r) => r.sequence).filter((s) => !s.includes("N"));
      samples.set(def.id, { id: def.id, role: def.role, reads });
      console.log(`${reads.length.toLocaleString()} reads (${((performance.now() - start) / 1000).toFixed(1)}s)`);
    }
  } else {
    samples = await loadDataset(ds);
  }
  console.log();

  const cachePath = join(ds.dataDir, ".cache.json");
  const runner = new BenchmarkRunner(samples, ds.pairs, ds.id, cachePath);
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
  console.log(`\nDataset: ${ds.id}`);
  console.log(`${detecting}/${results.length} detect related > unrelated`);
  console.log(`${detectingMother}/${results.length} detect ALL related pairs`);
}

main(dataset).catch((err) => {
  console.error("Framework error:", err);
  process.exit(1);
});
