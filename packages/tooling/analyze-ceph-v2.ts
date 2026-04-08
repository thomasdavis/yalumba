#!/usr/bin/env bun

/**
 * CEPH trio analysis v2 — fast approaches for low-coverage data.
 *
 * Strategy 1: Bottom-sketch MinHash (single hash, keep S smallest)
 *   - Like mash/sourmash: hash every k-mer once, keep bottom-S
 *   - O(reads * k-mers_per_read) — no inner hash loop
 *
 * Strategy 2: Read fingerprint overlap (36-bp prefix matching)
 *   - Two reads starting at the same genomic position share a prefix
 *   - Count how many read-starts appear in both samples
 *
 * Strategy 3: Canonical k-mer set intersection at varying k
 *   - Smaller k = more chance of overlap but less specificity
 *   - Try k=11, k=15, k=21 to find the sweet spot
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

// --- Load reads ---

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
    reads.push(rec.sequence);
  }
  return reads;
}

// --- Fast hash (FNV-1a 64-bit) ---

function fnv1a(str: string, offset: number, len: number): bigint {
  let h = 0xcbf29ce484222325n;
  for (let i = offset; i < offset + len; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h;
}

/** Canonical k-mer: min(kmer_hash, revcomp_hash) */
function canonicalHash(seq: string, offset: number, k: number): bigint {
  const fwd = fnv1a(seq, offset, k);
  // Quick reverse complement hash
  let h = 0xcbf29ce484222325n;
  for (let i = offset + k - 1; i >= offset; i--) {
    const c = seq.charCodeAt(i);
    // A↔T (65↔84), C↔G (67↔71)
    const comp = c === 65 ? 84 : c === 84 ? 65 : c === 67 ? 71 : c === 71 ? 67 : c;
    h ^= BigInt(comp);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return fwd < h ? fwd : h;
}

// --- Strategy 1: Bottom-sketch MinHash ---

function bottomSketch(reads: string[], k: number, sketchSize: number): Set<bigint> {
  // Collect all hashes, keep the smallest S
  // Use a max-heap approach: maintain set of size S, track max
  const sketch = new Set<bigint>();
  let maxInSketch = 0n;
  const arr: bigint[] = [];

  for (const read of reads) {
    if (read.length < k) continue;
    for (let i = 0; i <= read.length - k; i++) {
      const h = canonicalHash(read, i, k);
      if (arr.length < sketchSize) {
        if (!sketch.has(h)) {
          sketch.add(h);
          arr.push(h);
          if (h > maxInSketch) maxInSketch = h;
        }
      } else if (h < maxInSketch && !sketch.has(h)) {
        // Remove max, add this
        sketch.delete(maxInSketch);
        const idx = arr.indexOf(maxInSketch);
        arr[idx] = h;
        sketch.add(h);
        // Find new max
        maxInSketch = 0n;
        for (const v of arr) {
          if (v > maxInSketch) maxInSketch = v;
        }
      }
    }
  }

  return sketch;
}

function sketchJaccard(a: Set<bigint>, b: Set<bigint>): number {
  let shared = 0;
  for (const h of a) {
    if (b.has(h)) shared++;
  }
  const union = new Set([...a, ...b]).size;
  return union > 0 ? shared / union : 0;
}

// --- Strategy 2: Read prefix fingerprints ---

function readPrefixes(reads: string[], prefixLen: number): Set<string> {
  const prefixes = new Set<string>();
  for (const read of reads) {
    if (read.length >= prefixLen) {
      prefixes.add(read.slice(0, prefixLen));
    }
  }
  return prefixes;
}

function prefixJaccard(a: Set<string>, b: Set<string>): { shared: number; jaccard: number } {
  let shared = 0;
  for (const p of a) {
    if (b.has(p)) shared++;
  }
  const union = a.size + b.size - shared;
  return { shared, jaccard: union > 0 ? shared / union : 0 };
}

// --- Strategy 3: K-mer set intersection at varying k ---

function kmerSet(reads: string[], k: number): Set<bigint> {
  const kmers = new Set<bigint>();
  for (const read of reads) {
    if (read.length < k) continue;
    for (let i = 0; i <= read.length - k; i++) {
      kmers.add(canonicalHash(read, i, k));
    }
  }
  return kmers;
}

function setJaccard(a: Set<bigint>, b: Set<bigint>): { shared: number; union: number; jaccard: number } {
  let shared = 0;
  for (const h of a) {
    if (b.has(h)) shared++;
  }
  const union = a.size + b.size - shared;
  return { shared, union, jaccard: union > 0 ? shared / union : 0 };
}

// --- Main ---

async function main(): Promise<void> {
  console.log("=== yalumba CEPH trio analysis v2 ===\n");

  const MAX_READS = 500_000;

  // Load samples
  const sampleReads = new Map<string, string[]>();
  for (const sample of SAMPLES) {
    process.stdout.write(`Loading ${sample.id} (${sample.role})... `);
    const start = performance.now();
    const reads = await loadReads(sample.file, MAX_READS);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    sampleReads.set(sample.id, reads);
    console.log(`${reads.length.toLocaleString()} reads (${elapsed}s)`);
  }

  // ── Strategy 1: Bottom-sketch MinHash ──
  console.log("\n━━━ Strategy 1: Bottom-sketch MinHash (k=21, sketch=10000) ━━━\n");

  const SKETCH_SIZE = 10_000;
  const sketches = new Map<string, Set<bigint>>();
  for (const sample of SAMPLES) {
    process.stdout.write(`  ${sample.id}: building sketch... `);
    const start = performance.now();
    const sketch = bottomSketch(sampleReads.get(sample.id)!, 21, SKETCH_SIZE);
    console.log(`done (${((performance.now() - start) / 1000).toFixed(1)}s)`);
    sketches.set(sample.id, sketch);
  }
  console.log();
  for (const pair of PAIRS) {
    const j = sketchJaccard(sketches.get(pair.a)!, sketches.get(pair.b)!);
    console.log(`  ${pair.a} ↔ ${pair.b}: ${j.toFixed(6)}  (${pair.label})`);
  }

  // ── Strategy 2: Read prefix fingerprints ──
  console.log("\n━━━ Strategy 2: Read prefix fingerprints ━━━\n");

  for (const prefixLen of [30, 36, 50]) {
    console.log(`  Prefix length: ${prefixLen}`);
    const prefixes = new Map<string, Set<string>>();
    for (const sample of SAMPLES) {
      prefixes.set(sample.id, readPrefixes(sampleReads.get(sample.id)!, prefixLen));
    }
    for (const pair of PAIRS) {
      const result = prefixJaccard(prefixes.get(pair.a)!, prefixes.get(pair.b)!);
      console.log(`    ${pair.a} ↔ ${pair.b}: shared=${result.shared} jaccard=${result.jaccard.toFixed(6)}  (${pair.label})`);
    }
    console.log();
  }

  // ── Strategy 3: K-mer set intersection at varying k ──
  console.log("━━━ Strategy 3: K-mer intersection at varying k ━━━\n");

  for (const k of [11, 15, 21, 31]) {
    console.log(`  k=${k}`);
    const start = performance.now();
    const kmerSets = new Map<string, Set<bigint>>();
    for (const sample of SAMPLES) {
      kmerSets.set(sample.id, kmerSet(sampleReads.get(sample.id)!, k));
    }
    console.log(`    Built sets in ${((performance.now() - start) / 1000).toFixed(1)}s`);

    for (const pair of PAIRS) {
      const result = setJaccard(kmerSets.get(pair.a)!, kmerSets.get(pair.b)!);
      console.log(`    ${pair.a} ↔ ${pair.b}: jaccard=${result.jaccard.toFixed(6)} shared=${result.shared.toLocaleString()}  (${pair.label})`);
    }
    console.log();
  }

  console.log("━━━ Summary ━━━");
  console.log("Parent-child pairs should show HIGHER values than unrelated spouses.");
}

main().catch((err) => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
