#!/usr/bin/env bun

/**
 * Analyze the CEPH/Utah family trio from 1000 Genomes.
 *
 * Samples:
 *   NA12891 — Father
 *   NA12892 — Mother
 *   NA12878 — Daughter (child of NA12891 + NA12892)
 *
 * Expected relationships:
 *   NA12891 ↔ NA12892: unrelated spouses (~0 shared cM)
 *   NA12891 ↔ NA12878: father-daughter (~3400 cM, 50% IBD)
 *   NA12892 ↔ NA12878: mother-daughter (~3400 cM, 50% IBD)
 *
 * This script:
 *   1. Decompresses and parses gzipped FASTQ files
 *   2. Computes k-mer based Jaccard similarity for all pairs
 *   3. Runs segment detection
 *   4. Reports relatedness estimates
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";
import { JaccardSimilarity } from "@yalumba/alignment";
import { KmerIndex } from "@yalumba/kmer";

const DATA_DIR = join(import.meta.dir, "../../data/ceph");

interface Sample {
  readonly id: string;
  readonly role: string;
  readonly r1: string;
  readonly r2: string;
}

const SAMPLES: Sample[] = [
  { id: "NA12891", role: "Father", r1: "NA12891_1.filt.fastq.gz", r2: "NA12891_2.filt.fastq.gz" },
  { id: "NA12892", role: "Mother", r1: "NA12892_1.filt.fastq.gz", r2: "NA12892_2.filt.fastq.gz" },
  { id: "NA12878", role: "Daughter", r1: "NA12878_1.filt.fastq.gz", r2: "NA12878_2.filt.fastq.gz" },
];

async function loadGzippedFastq(filePath: string, maxReads: number): Promise<string[]> {
  const fullPath = join(DATA_DIR, filePath);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  console.log(`  Loading ${filePath}...`);
  const compressed = await Bun.file(fullPath).arrayBuffer();
  const decompressed = Bun.gunzipSync(new Uint8Array(compressed));
  const text = new TextDecoder().decode(decompressed);

  const parser = new FastqParser({ validateQuality: false, validateSequence: false });
  const records = parser.parse(text);
  const sequences: string[] = [];

  for (const rec of records) {
    if (sequences.length >= maxReads) break;
    sequences.push(rec.sequence);
  }

  return sequences;
}

function concatenateSequences(sequences: string[], maxBases: number): string {
  const parts: string[] = [];
  let total = 0;
  for (const seq of sequences) {
    if (total + seq.length > maxBases) break;
    parts.push(seq);
    total += seq.length;
  }
  return parts.join("");
}

async function main(): Promise<void> {
  console.log("=== yalumba CEPH trio analysis ===\n");
  console.log("Samples:");
  for (const s of SAMPLES) {
    console.log(`  ${s.id} — ${s.role}`);
  }
  console.log();

  // Check all files exist
  for (const s of SAMPLES) {
    const r1 = join(DATA_DIR, s.r1);
    if (!existsSync(r1)) {
      console.error(`Missing: ${r1}`);
      console.error("Run: bun run packages/tooling/download-ceph.ts");
      process.exit(1);
    }
  }

  // Configuration
  const MAX_READS = 50_000;
  const MAX_BASES = 5_000_000;
  const K = 21;

  console.log(`Config: max_reads=${MAX_READS} max_bases=${MAX_BASES} k=${K}\n`);

  // Load samples
  const sampleData = new Map<string, string>();

  for (const sample of SAMPLES) {
    console.log(`Loading ${sample.id} (${sample.role}):`);
    const start = performance.now();
    const sequences = await loadGzippedFastq(sample.r1, MAX_READS);
    const concatenated = concatenateSequences(sequences, MAX_BASES);
    sampleData.set(sample.id, concatenated);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`  ${sequences.length} reads, ${concatenated.length.toLocaleString()} bases (${elapsed}s)\n`);
  }

  // Pairwise comparison
  console.log("--- Pairwise Jaccard similarity (k=21) ---\n");

  const jaccard = new JaccardSimilarity(K);
  const pairs = [
    { a: "NA12891", b: "NA12892", expected: "Unrelated spouses" },
    { a: "NA12891", b: "NA12878", expected: "Father ↔ Daughter" },
    { a: "NA12892", b: "NA12878", expected: "Mother ↔ Daughter" },
  ];

  const results: { pair: string; score: number; shared: number; union: number; expected: string }[] = [];

  for (const pair of pairs) {
    const seqA = sampleData.get(pair.a)!;
    const seqB = sampleData.get(pair.b)!;

    const start = performance.now();
    const result = jaccard.compare(seqA, seqB);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);

    results.push({
      pair: `${pair.a} ↔ ${pair.b}`,
      score: result.score,
      shared: result.shared,
      union: result.union,
      expected: pair.expected,
    });

    console.log(`  ${pair.a} ↔ ${pair.b} (${pair.expected})`);
    console.log(`    Jaccard: ${result.score.toFixed(6)}`);
    console.log(`    Shared k-mers: ${result.shared.toLocaleString()}`);
    console.log(`    Union k-mers: ${result.union.toLocaleString()}`);
    console.log(`    Time: ${elapsed}s\n`);
  }

  // K-mer index stats
  console.log("--- K-mer index stats ---\n");

  for (const sample of SAMPLES) {
    const seq = sampleData.get(sample.id)!;
    const index = new KmerIndex({ k: K });
    index.add(seq);
    console.log(`  ${sample.id}: ${index.size.toLocaleString()} distinct k-mers`);
  }

  // Summary
  console.log("\n--- Summary ---\n");
  console.log("  Pair                     Jaccard    Relationship");
  console.log("  " + "─".repeat(55));
  for (const r of results) {
    const pad1 = r.pair.padEnd(25);
    const pad2 = r.score.toFixed(6).padStart(10);
    console.log(`  ${pad1}${pad2}    ${r.expected}`);
  }

  console.log("\nExpected pattern:");
  console.log("  • Parent ↔ Child should show HIGHER similarity than unrelated");
  console.log("  • Both parent-child pairs should be similar to each other");
  console.log("  • Unrelated spouses should show the LOWEST similarity");
}

main().catch((err) => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
