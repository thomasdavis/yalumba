#!/usr/bin/env bun

/**
 * CEPH trio analysis v3 — genotype-based relatedness.
 *
 * The key insight from v1/v2: raw k-mer comparison doesn't work on
 * low-coverage shotgun data because reads from different samples
 * rarely overlap the same positions. K-mer overlap is dominated by
 * sequencing batch effects, not genetics.
 *
 * Real relatedness estimation requires comparing GENOTYPES at the
 * SAME POSITIONS across samples. Without a reference genome, we
 * can still do this:
 *
 * 1. Build a "pseudo-reference" from one sample's reads
 * 2. Map all samples' reads against it by finding shared k-mer anchors
 * 3. At positions where reads from multiple samples overlap,
 *    compare the actual base calls
 * 4. Compute IBS (Identity By State) at overlapping positions
 *
 * IBS0 = both homozygous for different alleles (e.g., AA vs TT)
 * IBS1 = one shared allele (e.g., AT vs AA)
 * IBS2 = identical genotype (e.g., AA vs AA)
 *
 * Parent-child pairs have IBS0 ≈ 0 (child must inherit one allele)
 * Unrelated pairs have IBS0 > 0
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

// --- Build anchor index: k-mer → (readIdx, offset) ---

interface ReadPosition {
  readonly readIdx: number;
  readonly offset: number;
}

function buildAnchorIndex(
  reads: string[],
  k: number,
  stride: number,
): Map<string, ReadPosition[]> {
  const index = new Map<string, ReadPosition[]>();

  for (let ri = 0; ri < reads.length; ri++) {
    const read = reads[ri]!;
    if (read.length < k) continue;

    // Only index every `stride`-th k-mer to keep memory manageable
    for (let i = 0; i <= read.length - k; i += stride) {
      const kmer = read.slice(i, i + k);
      if (kmer.includes("N")) continue;

      const existing = index.get(kmer);
      if (existing) {
        if (existing.length < 5) { // Cap to prevent huge lists
          existing.push({ readIdx: ri, offset: i });
        }
      } else {
        index.set(kmer, [{ readIdx: ri, offset: i }]);
      }
    }
  }

  return index;
}

// --- Find overlapping positions and compare bases ---

interface OverlapResult {
  /** Total positions compared */
  readonly positionsCompared: number;
  /** Positions where bases match */
  readonly matching: number;
  /** Positions where bases differ */
  readonly mismatching: number;
  /** Identity ratio */
  readonly identity: number;
  /** Number of read-read overlaps found */
  readonly overlapsFound: number;
}

function compareAtOverlaps(
  readsA: string[],
  readsB: string[],
  indexA: Map<string, ReadPosition[]>,
  k: number,
  maxOverlaps: number,
): OverlapResult {
  let matching = 0;
  let mismatching = 0;
  let overlapsFound = 0;
  let positionsCompared = 0;

  // For each read in B, look up its k-mers in index A
  for (let ri = 0; ri < readsB.length && overlapsFound < maxOverlaps; ri++) {
    const readB = readsB[ri]!;
    if (readB.length < k) continue;

    // Try the first k-mer as anchor
    const anchor = readB.slice(0, k);
    if (anchor.includes("N")) continue;

    const hits = indexA.get(anchor);
    if (!hits) continue;

    // Found overlap — compare all bases in the overlapping region
    for (const hit of hits) {
      const readA = readsA[hit.readIdx]!;
      const offsetA = hit.offset;
      const offsetB = 0;

      // How many bases can we compare?
      const lenA = readA.length - offsetA;
      const lenB = readB.length - offsetB;
      const compareLen = Math.min(lenA, lenB);

      for (let i = 0; i < compareLen; i++) {
        const baseA = readA[offsetA + i];
        const baseB = readB[offsetB + i];
        if (baseA === "N" || baseB === "N") continue;

        positionsCompared++;
        if (baseA === baseB) {
          matching++;
        } else {
          mismatching++;
        }
      }

      overlapsFound++;
      if (overlapsFound >= maxOverlaps) break;
    }
  }

  const total = matching + mismatching;
  return {
    positionsCompared,
    matching,
    mismatching,
    identity: total > 0 ? matching / total : 0,
    overlapsFound,
  };
}

// --- IBS estimation from base comparison ---

interface IbsResult {
  /** Fraction of compared sites that are identical */
  readonly ibs: number;
  /** Estimated IBS0 (both different) — approximated from mismatch clusters */
  readonly mismatchRate: number;
  /** Estimated kinship from IBS */
  readonly kinship: number;
  /** Predicted relationship */
  readonly relationship: string;
}

function estimateRelationship(overlap: OverlapResult): IbsResult {
  const mismatchRate = overlap.positionsCompared > 0
    ? overlap.mismatching / overlap.positionsCompared
    : 0;

  // At overlapping positions, related individuals share more bases.
  // Human genome heterozygosity is ~0.1%. Sequencing error rate ~0.5%.
  // Background mismatch rate between any two humans: ~0.1%
  // Sequencing errors add ~0.5% on top.
  // Related individuals at shared IBD segments: only seq error mismatches.
  //
  // Kinship ≈ (background_mismatch - observed_mismatch) / background_mismatch
  // This is a rough approximation.

  const identity = overlap.identity;

  // Empirical thresholds based on IBS
  let relationship: string;
  let kinship: number;

  // Higher identity = more related
  // These thresholds will be calibrated against the data
  if (identity > 0.998) {
    relationship = "identical/self";
    kinship = 0.5;
  } else if (identity > 0.996) {
    relationship = "parent-child or full-sibling";
    kinship = 0.25;
  } else if (identity > 0.994) {
    relationship = "2nd degree (grandparent, half-sib)";
    kinship = 0.125;
  } else {
    relationship = "unrelated or distant";
    kinship = mismatchRate > 0 ? Math.max(0, (0.006 - mismatchRate) / 0.012) * 0.25 : 0;
  }

  return { ibs: identity, mismatchRate, kinship, relationship };
}

// --- Main ---

async function main(): Promise<void> {
  console.log("=== yalumba CEPH trio analysis v3: genotype-based ===\n");

  const MAX_READS = 500_000;
  const K = 25;
  const STRIDE = 5;
  const MAX_OVERLAPS = 100_000;

  console.log(`Config: reads=${MAX_READS.toLocaleString()} k=${K} stride=${STRIDE} max_overlaps=${MAX_OVERLAPS.toLocaleString()}\n`);

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
  console.log();

  // Build anchor indices
  console.log("Building anchor indices...");
  const indices = new Map<string, Map<string, ReadPosition[]>>();
  for (const sample of SAMPLES) {
    process.stdout.write(`  ${sample.id}... `);
    const start = performance.now();
    const index = buildAnchorIndex(sampleReads.get(sample.id)!, K, STRIDE);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    indices.set(sample.id, index);
    console.log(`${index.size.toLocaleString()} anchors (${elapsed}s)`);
  }
  console.log();

  // Compare all pairs
  console.log("━━━ Pairwise comparison at overlapping positions ━━━\n");

  const results: { pair: string; label: string; overlap: OverlapResult; ibs: IbsResult }[] = [];

  for (const pair of PAIRS) {
    process.stdout.write(`  ${pair.a} ↔ ${pair.b} (${pair.label})... `);
    const start = performance.now();

    const overlap = compareAtOverlaps(
      sampleReads.get(pair.a)!,
      sampleReads.get(pair.b)!,
      indices.get(pair.a)!,
      K,
      MAX_OVERLAPS,
    );

    const ibs = estimateRelationship(overlap);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`done (${elapsed}s)`);

    results.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, overlap, ibs });

    console.log(`    Overlaps found: ${overlap.overlapsFound.toLocaleString()}`);
    console.log(`    Positions compared: ${overlap.positionsCompared.toLocaleString()}`);
    console.log(`    Matching: ${overlap.matching.toLocaleString()} (${(overlap.identity * 100).toFixed(3)}%)`);
    console.log(`    Mismatching: ${overlap.mismatching.toLocaleString()} (${(overlap.mismatching / Math.max(1, overlap.positionsCompared) * 100).toFixed(3)}%)`);
    console.log(`    IBS identity: ${ibs.ibs.toFixed(6)}`);
    console.log(`    Mismatch rate: ${ibs.mismatchRate.toFixed(6)}`);
    console.log(`    Predicted: ${ibs.relationship}`);
    console.log();
  }

  // Summary table
  console.log("━━━ Summary ━━━\n");
  console.log("  Pair                     Overlaps    Identity    Mismatch    Prediction");
  console.log("  " + "─".repeat(80));
  for (const r of results) {
    const p = r.pair.padEnd(25);
    const o = r.overlap.overlapsFound.toLocaleString().padStart(8);
    const id = (r.ibs.ibs * 100).toFixed(3).padStart(10) + "%";
    const mm = (r.ibs.mismatchRate * 100).toFixed(3).padStart(10) + "%";
    console.log(`  ${p}${o}  ${id}  ${mm}    ${r.ibs.relationship}`);
  }

  console.log("\nKey: parent-child should have LOWER mismatch rate than unrelated.");
  console.log("(Children inherit one allele from each parent → fewer IBS0 sites)");
}

main().catch((err) => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
