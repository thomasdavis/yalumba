#!/usr/bin/env bun

/**
 * Determinism Verification Test
 *
 * Stage A of the representation canonicalization program.
 *
 * Tests whether the canonical module builder produces IDENTICAL output
 * regardless of read ordering. This is the minimum requirement before
 * any downstream invariant can be trusted.
 *
 * Protocol:
 *   1. Load reads for each sample
 *   2. Extract modules with ORIGINAL order
 *   3. Shuffle reads (3 different seeds)
 *   4. Extract modules with EACH shuffle
 *   5. Compare: module count, module fingerprints, edge count
 *   6. PASS = identical across all orderings
 *
 * Also compares old builder (non-deterministic) vs new builder
 * to quantify the improvement.
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";
import { buildModules } from "@yalumba/modules";
import { buildModulesCanonical } from "@yalumba/modules";

const ROOT = join(import.meta.dir, "../../../");
const DATA_DIR = join(ROOT, "data/ceph-6");
const MAX_READS = 50_000;

const SAMPLES = [
  { id: "NA12889", file: "NA12889_R1.fastq.gz" },
  { id: "NA12877", file: "NA12877_R1.fastq.gz" },
];

const SHUFFLE_SEEDS = [42, 12345, 99999];

async function loadReads(file: string): Promise<string[]> {
  const fullPath = join(DATA_DIR, file);
  if (!existsSync(fullPath)) throw new Error(`Not found: ${fullPath}`);
  const compressed = await Bun.file(fullPath).arrayBuffer();
  const decompressed = Bun.gunzipSync(new Uint8Array(compressed));
  const text = new TextDecoder().decode(decompressed);
  const parser = new FastqParser({ validateQuality: false, validateSequence: false });
  const records = parser.parse(text);
  const reads: string[] = [];
  for (const rec of records) {
    if (reads.length >= MAX_READS) break;
    if (!rec.sequence.includes("N")) reads.push(rec.sequence);
  }
  return reads;
}

function shuffleReads(reads: string[], seed: number): string[] {
  const arr = [...reads];
  let rng = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
    const j = rng % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function moduleFingerprint(members: readonly number[]): number {
  const sorted = [...members].sort((a, b) => a - b);
  let h = 0x811c9dc5 | 0;
  for (const m of sorted) {
    h ^= m;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function getModuleSignature(modules: readonly { members: readonly number[] }[]): string {
  const fps = modules.map(m => moduleFingerprint(m.members)).sort((a, b) => a - b);
  return fps.join(",");
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║              DETERMINISM VERIFICATION TEST                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const OPTS = { motifK: 15, windowSize: 150, minSupport: 3, minCohesion: 0.25 };

  for (const sample of SAMPLES) {
    console.log(`\n━━━ ${sample.id} ━━━\n`);

    const reads = await loadReads(sample.file);
    console.log(`  Loaded ${reads.length} reads\n`);

    // ── Test OLD builder (known non-deterministic) ──
    console.log("  OLD builder (non-deterministic):");
    const oldOriginal = buildModules(reads, OPTS);
    const oldOrigSig = getModuleSignature(oldOriginal);
    console.log(`    Original: ${oldOriginal.length} modules`);

    let oldFailures = 0;
    for (const seed of SHUFFLE_SEEDS) {
      const shuffled = shuffleReads(reads, seed);
      const oldShuffled = buildModules(shuffled, OPTS);
      const oldShufSig = getModuleSignature(oldShuffled);
      const match = oldOrigSig === oldShufSig;
      if (!match) oldFailures++;
      console.log(`    Shuffle(${seed}): ${oldShuffled.length} modules — ${match ? "MATCH ✓" : "DIFFERENT ✗"} (Δ=${oldShuffled.length - oldOriginal.length})`);
    }
    console.log(`    Result: ${oldFailures === 0 ? "DETERMINISTIC ✓" : `${oldFailures}/3 FAILURES ✗`}\n`);

    // ── Test NEW canonical builder ──
    console.log("  CANONICAL builder:");
    const t0 = performance.now();
    const newOriginal = buildModulesCanonical(reads, OPTS);
    const elapsed0 = ((performance.now() - t0) / 1000).toFixed(1);
    const newOrigSig = getModuleSignature(newOriginal);
    console.log(`    Original: ${newOriginal.length} modules (${elapsed0}s)`);

    let newFailures = 0;
    for (const seed of SHUFFLE_SEEDS) {
      const shuffled = shuffleReads(reads, seed);
      const t1 = performance.now();
      const newShuffled = buildModulesCanonical(shuffled, OPTS);
      const elapsed1 = ((performance.now() - t1) / 1000).toFixed(1);
      const newShufSig = getModuleSignature(newShuffled);
      const match = newOrigSig === newShufSig;
      if (!match) newFailures++;
      console.log(`    Shuffle(${seed}): ${newShuffled.length} modules (${elapsed1}s) — ${match ? "MATCH ✓" : "DIFFERENT ✗"} (Δ=${newShuffled.length - newOriginal.length})`);
    }
    console.log(`    Result: ${newFailures === 0 ? "DETERMINISTIC ✓" : `${newFailures}/3 FAILURES ✗`}`);

    // ── Summary ──
    console.log(`\n  Summary for ${sample.id}:`);
    console.log(`    Old builder: ${oldFailures === 0 ? "PASS" : "FAIL"} (${oldOriginal.length} modules, ${oldFailures}/3 shuffle failures)`);
    console.log(`    Canonical:   ${newFailures === 0 ? "PASS" : "FAIL"} (${newOriginal.length} modules, ${newFailures}/3 shuffle failures)`);
  }

  console.log("\n\n═══ OVERALL ═══\n");
  console.log("If canonical builder shows MATCH ✓ for all shuffles,");
  console.log("the representation is deterministic — Stage A passes.\n");
}

main().catch(console.error);
