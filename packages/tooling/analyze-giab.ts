#!/usr/bin/env bun

/**
 * GIAB Ashkenazi trio analysis — 150bp reads.
 *
 * HG003 (Father) + HG004 (Mother) → HG002 (Son)
 *
 * Strategy: anchor-based overlap comparison.
 * With 150bp reads, a 36bp anchor leaves 114bp for comparison.
 * At ~0.1% human divergence + ~0.5% seq error, we expect:
 *   - Unrelated: ~0.6% mismatch in overlapping regions
 *   - Parent-child: ~0.35% mismatch (half the sites are IBD)
 *   - The delta should be detectable with enough overlaps
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";

const DATA_DIR = join(import.meta.dir, "../../data/giab");

interface Sample {
  readonly id: string;
  readonly role: string;
  readonly file: string;
}

const SAMPLES: Sample[] = [
  { id: "HG003", role: "Father", file: "HG003_R1.fastq.gz" },
  { id: "HG004", role: "Mother", file: "HG004_R1.fastq.gz" },
  { id: "HG002", role: "Son", file: "HG002_R1.fastq.gz" },
];

const PAIRS = [
  { a: "HG003", b: "HG004", label: "Unrelated spouses" },
  { a: "HG003", b: "HG002", label: "Father ↔ Son" },
  { a: "HG004", b: "HG002", label: "Mother ↔ Son" },
];

async function loadReads(filePath: string, maxReads: number): Promise<string[]> {
  const fullPath = join(DATA_DIR, filePath);
  if (!existsSync(fullPath)) throw new Error(`Not found: ${fullPath}`);

  process.stdout.write(`  Loading ${filePath}... `);
  const compressed = await Bun.file(fullPath).arrayBuffer();
  const decompressed = Bun.gunzipSync(new Uint8Array(compressed));
  const text = new TextDecoder().decode(decompressed);

  const parser = new FastqParser({ validateQuality: false, validateSequence: false });
  const records = parser.parse(text);
  const reads: string[] = [];
  for (const rec of records) {
    if (reads.length >= maxReads) break;
    if (!rec.sequence.includes("N")) {
      reads.push(rec.sequence);
    }
  }
  console.log(`${reads.length.toLocaleString()} reads, ${reads[0]?.length ?? 0}bp`);
  return reads;
}

function compareWithAnchor(
  readsA: string[],
  readsB: string[],
  anchorLen: number,
  trimEnds: number,
): {
  overlaps: number;
  positions: number;
  matches: number;
  mismatches: number;
  identity: number;
  mismatchRate: number;
} {
  const index = new Map<string, number[]>();
  for (let i = 0; i < readsA.length; i++) {
    const read = readsA[i]!;
    if (read.length < anchorLen + trimEnds * 2) continue;
    const key = read.slice(trimEnds, trimEnds + anchorLen);
    const existing = index.get(key);
    if (existing) {
      if (existing.length < 3) existing.push(i);
    } else {
      index.set(key, [i]);
    }
  }

  let overlaps = 0;
  let positions = 0;
  let matches = 0;
  let mismatches = 0;

  for (const readB of readsB) {
    if (readB.length < anchorLen + trimEnds * 2) continue;
    const key = readB.slice(trimEnds, trimEnds + anchorLen);
    const hits = index.get(key);
    if (!hits) continue;

    for (const idx of hits) {
      const readA = readsA[idx]!;
      overlaps++;

      // Compare bases AFTER the anchor region (trim ends of read)
      const startCompare = trimEnds + anchorLen;
      const endCompare = Math.min(readA.length, readB.length) - trimEnds;

      for (let i = startCompare; i < endCompare; i++) {
        positions++;
        if (readA[i] === readB[i]) {
          matches++;
        } else {
          mismatches++;
        }
      }
    }
  }

  const total = matches + mismatches;
  return {
    overlaps,
    positions,
    matches,
    mismatches,
    identity: total > 0 ? matches / total : 0,
    mismatchRate: total > 0 ? mismatches / total : 0,
  };
}

async function main(): Promise<void> {
  console.log("=== yalumba GIAB Ashkenazi trio analysis ===\n");
  console.log("HG003 (Father) + HG004 (Mother) → HG002 (Son)\n");

  const MAX_READS = 2_000_000;

  // Load
  const sampleReads = new Map<string, string[]>();
  for (const sample of SAMPLES) {
    const start = performance.now();
    const reads = await loadReads(sample.file, MAX_READS);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    sampleReads.set(sample.id, reads);
    console.log(`    (${elapsed}s)`);
  }
  console.log();

  // Compare at different anchor lengths
  const TRIM = 10;

  for (const anchorLen of [36, 40, 50, 60]) {
    console.log(`━━━ Anchor: ${anchorLen}bp (trim ${TRIM}bp from each end) ━━━\n`);

    for (const pair of PAIRS) {
      const start = performance.now();
      const result = compareWithAnchor(
        sampleReads.get(pair.a)!,
        sampleReads.get(pair.b)!,
        anchorLen,
        TRIM,
      );
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);

      const overlapStr = result.overlaps.toLocaleString().padStart(8);
      const idStr = (result.identity * 100).toFixed(4).padStart(9);
      const mmStr = (result.mismatchRate * 100).toFixed(4).padStart(9);
      console.log(`  ${pair.a} ↔ ${pair.b}: overlaps=${overlapStr} identity=${idStr}% mismatch=${mmStr}%  (${pair.label}) [${elapsed}s]`);
    }
    console.log();
  }

  console.log("━━━ Expected ━━━");
  console.log("Parent-child: HIGHER identity (LOWER mismatch) than unrelated");
  console.log("Because child inherits 50% of genome from each parent → more IBS");
}

main().catch((err) => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
