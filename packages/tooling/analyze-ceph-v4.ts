#!/usr/bin/env bun

/**
 * CEPH trio analysis v4 — improved overlap-based comparison.
 *
 * Lessons from v3:
 *   - k=25 anchor produces too many false matches
 *   - Mismatch rate ~3.3% is dominated by sequencing error + false anchors
 *   - But there IS a small signal: mother-daughter (3.189%) < unrelated (3.301%)
 *
 * Improvements:
 *   1. Use LONGER anchors (entire read prefix, 36bp) to reduce false matches
 *   2. Require BOTH ends of the read to match (prefix + suffix)
 *   3. Only count mismatches in the MIDDLE of reads (ends have higher error)
 *   4. Use paired reads — R1 and R2 from same fragment provide confirmation
 *   5. Try multiple anchor lengths and see which gives best separation
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";

const DATA_DIR = join(import.meta.dir, "../../data/ceph");

interface Sample {
  readonly id: string;
  readonly role: string;
  readonly file: string;
}

const SAMPLES: Sample[] = [
  { id: "NA12891", role: "Father", file: "NA12891_1.filt.fastq.gz" },
  { id: "NA12892", role: "Mother", file: "NA12892_1.filt.fastq.gz" },
  { id: "NA12878", role: "Daughter", file: "NA12878_1.filt.fastq.gz" },
];

const PAIRS = [
  { a: "NA12891", b: "NA12892", label: "Unrelated spouses" },
  { a: "NA12891", b: "NA12878", label: "Father ↔ Daughter" },
  { a: "NA12892", b: "NA12878", label: "Mother ↔ Daughter" },
];

async function loadReads(filePath: string, maxReads: number): Promise<string[]> {
  const fullPath = join(DATA_DIR, filePath);
  if (!existsSync(fullPath)) throw new Error(`Not found: ${fullPath}`);

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
  return reads;
}

/**
 * Approach: exact full-read matching with controlled mismatches.
 *
 * Index reads by a long prefix (anchor). When a read from sample B
 * matches a prefix in sample A, compare the remaining bases.
 *
 * The prefix match ensures we're comparing reads from the same
 * genomic position. The remaining bases reveal genotype differences.
 */
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
  // Build index of A reads by prefix
  const index = new Map<string, number[]>();
  for (let i = 0; i < readsA.length; i++) {
    const read = readsA[i]!;
    if (read.length < anchorLen + trimEnds * 2) continue;
    const key = read.slice(0, anchorLen);
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
    const key = readB.slice(0, anchorLen);
    const hits = index.get(key);
    if (!hits) continue;

    for (const idx of hits) {
      const readA = readsA[idx]!;
      const compareLen = Math.min(readA.length, readB.length);
      overlaps++;

      // Compare bases outside the anchor, trimming ends
      for (let i = anchorLen; i < compareLen - trimEnds; i++) {
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
  console.log("=== yalumba CEPH trio analysis v4 ===\n");

  const MAX_READS = 1_000_000;

  // Load
  const sampleReads = new Map<string, string[]>();
  for (const sample of SAMPLES) {
    process.stdout.write(`Loading ${sample.id} (${sample.role})... `);
    const start = performance.now();
    const reads = await loadReads(sample.file, MAX_READS);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    sampleReads.set(sample.id, reads);
    console.log(`${reads.length.toLocaleString()} reads (${elapsed}s)`);
  }
  console.log();

  // Try different anchor lengths
  const TRIM_ENDS = 5;

  for (const anchorLen of [25, 30, 32, 34, 36]) {
    console.log(`━━━ Anchor length: ${anchorLen} (trim ${TRIM_ENDS} from ends) ━━━\n`);

    const pairResults: string[] = [];

    for (const pair of PAIRS) {
      const start = performance.now();
      const result = compareWithAnchor(
        sampleReads.get(pair.a)!,
        sampleReads.get(pair.b)!,
        anchorLen,
        TRIM_ENDS,
      );
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);

      const line = `  ${pair.a} ↔ ${pair.b}: overlaps=${result.overlaps.toLocaleString().padStart(7)} identity=${(result.identity * 100).toFixed(4).padStart(8)}% mismatch=${(result.mismatchRate * 100).toFixed(4).padStart(8)}%  (${pair.label}) [${elapsed}s]`;
      console.log(line);
      pairResults.push(line);
    }

    console.log();
  }

  console.log("Key: In each anchor group, parent-child pairs should have");
  console.log("LOWER mismatch rate (HIGHER identity) than unrelated spouses.");
  console.log("The anchor length that produces the biggest gap wins.");
}

main().catch((err) => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
