#!/usr/bin/env bun

/**
 * Run symbiogenesis algorithms one at a time with detailed logging.
 * Default dataset: CEPH 1463 (hardest test).
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";
import type { SymbioAlgorithm, SampleReads, DatasetDef, PairResult } from "./types.js";
import { modulePersistence } from "./algorithms/module-persistence.js";
import { coalitionTransfer } from "./algorithms/coalition-transfer.js";
import { moduleStability } from "./algorithms/module-stability.js";
import { spectralEcology } from "./algorithms/spectral-ecology.js";

const ALGORITHMS: Record<string, SymbioAlgorithm> = {
  "module-persistence": modulePersistence,
  "coalition-transfer": coalitionTransfer,
  "module-stability": moduleStability,
  "spectral-ecology": spectralEcology,
};

const ROOT = join(import.meta.dir, "../../../");

const CEPH_1463: DatasetDef = {
  id: "ceph-1463",
  name: "CEPH 1463 Pedigree — 6 members, 3 generations (NYGC 30x, 150bp)",
  dataDir: join(ROOT, "data/ceph-6"),
  maxReads: 2_000_000,
  samples: [
    { id: "NA12889", role: "Pat. grandfather", file: "NA12889_R1.fastq.gz" },
    { id: "NA12890", role: "Pat. grandmother", file: "NA12890_R1.fastq.gz" },
    { id: "NA12891", role: "Mat. grandfather", file: "NA12891_R1.fastq.gz" },
    { id: "NA12892", role: "Mat. grandmother", file: "NA12892_R1.fastq.gz" },
    { id: "NA12877", role: "Father", file: "NA12877_R1.fastq.gz" },
    { id: "NA12878", role: "Mother", file: "NA12878_R1.fastq.gz" },
  ],
  pairs: [
    { a: "NA12877", b: "NA12878", label: "Spouses (unrelated)", related: false },
    { a: "NA12889", b: "NA12891", label: "Pat.GF ↔ Mat.GF (unrelated)", related: false },
    { a: "NA12890", b: "NA12892", label: "Pat.GM ↔ Mat.GM (unrelated)", related: false },
    { a: "NA12889", b: "NA12892", label: "Pat.GF ↔ Mat.GM (unrelated)", related: false },
    { a: "NA12889", b: "NA12877", label: "Pat.GF → Father (parent-child)", related: true },
    { a: "NA12890", b: "NA12877", label: "Pat.GM → Father (parent-child)", related: true },
    { a: "NA12891", b: "NA12878", label: "Mat.GF → Mother (parent-child)", related: true },
    { a: "NA12892", b: "NA12878", label: "Mat.GM → Mother (parent-child)", related: true },
    { a: "NA12889", b: "NA12878", label: "Pat.GF ↔ Mother (in-law)", related: false },
    { a: "NA12891", b: "NA12877", label: "Mat.GF ↔ Father (in-law)", related: false },
  ],
};

async function loadSample(dataDir: string, def: { id: string; role: string; file: string }, maxReads: number): Promise<SampleReads> {
  const fullPath = join(dataDir, def.file);
  if (!existsSync(fullPath)) throw new Error(`Not found: ${fullPath}`);

  const compressed = await Bun.file(fullPath).arrayBuffer();
  const decompressed = Bun.gunzipSync(new Uint8Array(compressed));
  const text = new TextDecoder().decode(decompressed);
  const parser = new FastqParser({ validateQuality: false, validateSequence: false });
  const records = parser.parse(text);
  const reads: string[] = [];
  for (const rec of records) {
    if (reads.length >= maxReads) break;
    if (!rec.sequence.includes("N")) reads.push(rec.sequence);
  }
  return { id: def.id, role: def.role, reads };
}

async function runAlgorithm(alg: SymbioAlgorithm): Promise<void> {
  const ds = CEPH_1463;

  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log(`║  SYMBIOGENESIS: ${alg.name.padEnd(52)} ║`);
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Family:      ${alg.family}`);
  console.log(`  Description: ${alg.description}`);
  console.log(`  Version:     ${alg.version}`);
  console.log(`  Max reads:   ${alg.maxReadsPerSample?.toLocaleString() ?? "unlimited"}`);
  console.log(`  Dataset:     ${ds.name}`);
  console.log();

  // ── Load ──
  console.log("── PHASE 1: Load data ──");
  const t0 = performance.now();
  const samples = new Map<string, SampleReads>();
  for (const def of ds.samples) {
    process.stdout.write(`  ${def.id} (${def.role})... `);
    const s = await loadSample(ds.dataDir, def, ds.maxReads);
    const sub = alg.maxReadsPerSample && s.reads.length > alg.maxReadsPerSample
      ? { ...s, reads: s.reads.slice(0, alg.maxReadsPerSample) }
      : s;
    samples.set(def.id, sub);
    console.log(`${sub.reads.length.toLocaleString()} reads`);
  }
  console.log(`  Load time: ${((performance.now() - t0) / 1000).toFixed(1)}s\n`);

  // ── Prepare ──
  console.log("── PHASE 2: Prepare (module extraction) ──");
  const memBefore = process.memoryUsage();
  const prepStart = performance.now();
  const context = alg.prepare([...samples.values()]);
  const prepMs = performance.now() - prepStart;
  const memAfter = process.memoryUsage();
  console.log(`  Prep time:   ${(prepMs / 1000).toFixed(1)}s`);
  console.log(`  Heap delta:  +${((memAfter.heapUsed - memBefore.heapUsed) / 1e6).toFixed(1)}MB`);
  console.log(`  Compute:     CPU (TypeScript)\n`);

  // ── Compare ──
  console.log("── PHASE 3: Pairwise comparison ──\n");
  const pairResults: PairResult[] = [];

  for (const pair of ds.pairs) {
    const a = samples.get(pair.a)!;
    const b = samples.get(pair.b)!;
    process.stdout.write(`  ${pair.a} ↔ ${pair.b}... `);

    const start = performance.now();
    const result = alg.compare(a, b, context);
    const timeMs = performance.now() - start;

    pairResults.push({
      pair: `${pair.a} ↔ ${pair.b}`, label: pair.label,
      related: pair.related, score: result.score, detail: result.detail, timeMs,
    });

    console.log(`${(timeMs / 1000).toFixed(2)}s`);
    console.log(`    Score:  ${result.score.toFixed(6)}`);
    console.log(`    Detail: ${result.detail}\n`);
  }

  // ── Analysis ──
  console.log("── PHASE 4: Analysis ──\n");

  const related = pairResults.filter((p) => p.related);
  const unrelated = pairResults.filter((p) => !p.related);
  const avgR = related.reduce((s, p) => s + p.score, 0) / related.length;
  const avgU = unrelated.reduce((s, p) => s + p.score, 0) / unrelated.length;
  const sep = avgR - avgU;

  const weakestR = related.reduce((m, p) => p.score < m.score ? p : m);
  const strongestU = unrelated.reduce((m, p) => p.score > m.score ? p : m);
  const gap = weakestR.score - strongestU.score;

  console.log("  Ranked scores:");
  for (const p of [...pairResults].sort((a, b) => b.score - a.score)) {
    const m = p.related ? "►" : " ";
    const bar = "█".repeat(Math.max(1, Math.round(p.score * 100)));
    console.log(`    ${m} ${p.score.toFixed(6)} ${bar} ${p.label}`);
  }

  console.log();
  console.log(`  Avg related:    ${avgR.toFixed(6)}`);
  console.log(`  Avg unrelated:  ${avgU.toFixed(6)}`);
  console.log(`  Separation:     ${sep >= 0 ? "+" : ""}${(sep * 100).toFixed(4)}%`);
  console.log(`  Weakest gap:    ${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(4)}%`);
  console.log(`  Detects all:    ${gap > 0 ? "YES ✓" : "NO ✗"}`);

  console.log();
  console.log("── Timing ──");
  const totalCompare = pairResults.reduce((s, p) => s + p.timeMs, 0);
  console.log(`  Prep:     ${(prepMs / 1000).toFixed(1)}s`);
  console.log(`  Compare:  ${(totalCompare / 1000).toFixed(1)}s (${(totalCompare / pairResults.length / 1000).toFixed(2)}s/pair)`);
  console.log(`  Total:    ${((prepMs + totalCompare) / 1000).toFixed(1)}s`);
  console.log(`  Compute:  100% CPU (no GPU acceleration yet)`);

  console.log();
  console.log("── Visualizations ──");
  console.log("  1. MODULE GRAPH: Force-directed layout of shared vs unique modules");
  console.log("  2. HEATMAP: 6×6 score matrix — module topology overlap");
  console.log("  3. VENN: Module identity overlap between related vs unrelated pairs");
  console.log("  4. SANKEY: Module flow from grandparents → parents (inheritance paths)");
}

// Select algorithm from CLI arg or default to coalition-transfer
const algName = process.argv[2] ?? "coalition-transfer";
const alg = ALGORITHMS[algName];
if (!alg) {
  console.error(`Unknown algorithm: ${algName}`);
  console.error(`Available: ${Object.keys(ALGORITHMS).join(", ")}`);
  process.exit(1);
}

runAlgorithm(alg).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
