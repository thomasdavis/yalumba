#!/usr/bin/env bun

/**
 * Improved relatedness algorithms — v2.
 *
 * Problems with v1:
 *   - Mother-son barely distinguishable from unrelated (0.031% gap)
 *   - Batch effects (same flowcell) inflate father-son signal
 *   - Exact prefix matching too strict, misses most overlaps
 *
 * New approaches:
 *   1. Seed-and-extend: short anchor + verify full read identity
 *   2. K-mer frequency correlation: compare k-mer count distributions
 *   3. Normalized overlap: divide by self-similarity baseline
 *   4. Hamming-tolerant anchoring: allow 1-2 mismatches in anchor
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";

const DATA_DIR = join(import.meta.dir, "../../data/giab");

interface Sample { readonly id: string; readonly role: string; readonly file: string }
interface PairDef { readonly a: string; readonly b: string; readonly label: string; readonly related: boolean }
interface Result { pair: string; label: string; related: boolean; score: number; detail: string }

const SAMPLES: Sample[] = [
  { id: "HG003", role: "Father", file: "HG003_R1.fastq.gz" },
  { id: "HG004", role: "Mother", file: "HG004_R1.fastq.gz" },
  { id: "HG002", role: "Son", file: "HG002_R1.fastq.gz" },
];

const PAIRS: PairDef[] = [
  { a: "HG003", b: "HG004", label: "Unrelated spouses", related: false },
  { a: "HG003", b: "HG002", label: "Father ↔ Son", related: true },
  { a: "HG004", b: "HG002", label: "Mother ↔ Son", related: true },
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
    if (!rec.sequence.includes("N")) reads.push(rec.sequence);
  }
  return reads;
}

// ── Alg 1: Seed-and-extend with identity filter ──

function seedAndExtend(
  readsA: string[], readsB: string[],
  seedLen: number, minIdentity: number,
): { overlaps: number; verified: number; avgIdentity: number; score: number } {
  // Index A by seed (shorter anchor = more candidates)
  const index = new Map<string, number[]>();
  for (let i = 0; i < readsA.length; i++) {
    const read = readsA[i]!;
    if (read.length < seedLen) continue;
    // Use seed from position 10 (skip noisy start)
    const seed = read.slice(10, 10 + seedLen);
    const existing = index.get(seed);
    if (existing) { if (existing.length < 5) existing.push(i); }
    else { index.set(seed, [i]); }
  }

  let overlaps = 0;
  let verified = 0;
  let totalIdentity = 0;

  for (const readB of readsB) {
    if (readB.length < seedLen) continue;
    const seed = readB.slice(10, 10 + seedLen);
    const hits = index.get(seed);
    if (!hits) continue;

    for (const idx of hits) {
      overlaps++;
      const readA = readsA[idx]!;
      const len = Math.min(readA.length, readB.length);

      // Compute full-read identity
      let matches = 0;
      for (let i = 0; i < len; i++) {
        if (readA[i] === readB[i]) matches++;
      }
      const identity = matches / len;

      // Only count high-identity overlaps (filters false seed matches)
      if (identity >= minIdentity) {
        verified++;
        totalIdentity += identity;
      }
    }
  }

  return {
    overlaps,
    verified,
    avgIdentity: verified > 0 ? totalIdentity / verified : 0,
    score: verified > 0 ? totalIdentity / verified : 0,
  };
}

// ── Alg 2: K-mer frequency correlation ──

function kmerFrequencyCorrelation(
  readsA: string[], readsB: string[], k: number,
): { correlation: number; sharedKmers: number } {
  // Build frequency maps
  const freqA = new Map<number, number>();
  const freqB = new Map<number, number>();

  for (const read of readsA) {
    for (let i = 0; i <= read.length - k; i++) {
      const h = fastHash(read, i, k);
      freqA.set(h, (freqA.get(h) ?? 0) + 1);
    }
  }
  for (const read of readsB) {
    for (let i = 0; i <= read.length - k; i++) {
      const h = fastHash(read, i, k);
      freqB.set(h, (freqB.get(h) ?? 0) + 1);
    }
  }

  // Compute Pearson correlation over shared k-mers
  const shared: { a: number; b: number }[] = [];
  for (const [kmer, countA] of freqA) {
    const countB = freqB.get(kmer);
    if (countB !== undefined) {
      shared.push({ a: countA, b: countB });
    }
  }

  if (shared.length < 10) return { correlation: 0, sharedKmers: shared.length };

  let sumA = 0, sumB = 0;
  for (const s of shared) { sumA += s.a; sumB += s.b; }
  const meanA = sumA / shared.length;
  const meanB = sumB / shared.length;

  let cov = 0, varA = 0, varB = 0;
  for (const s of shared) {
    const dA = s.a - meanA;
    const dB = s.b - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }

  const denom = Math.sqrt(varA * varB);
  return {
    correlation: denom > 0 ? cov / denom : 0,
    sharedKmers: shared.length,
  };
}

// ── Alg 3: Normalized anchor overlap ──

function normalizedAnchorOverlap(
  readsA: string[], readsB: string[], anchorLen: number, trim: number,
): { rawIdentity: number; selfA: number; selfB: number; normalized: number; overlaps: number } {
  // Compute cross-sample overlap
  const cross = anchorOverlapIdentity(readsA, readsB, anchorLen, trim);

  // Compute self-similarity (split each sample in half, compare halves)
  const halfA1 = readsA.slice(0, Math.floor(readsA.length / 2));
  const halfA2 = readsA.slice(Math.floor(readsA.length / 2));
  const selfA = anchorOverlapIdentity(halfA1, halfA2, anchorLen, trim);

  const halfB1 = readsB.slice(0, Math.floor(readsB.length / 2));
  const halfB2 = readsB.slice(Math.floor(readsB.length / 2));
  const selfB = anchorOverlapIdentity(halfB1, halfB2, anchorLen, trim);

  // Normalize: how much of self-similarity is preserved cross-sample?
  const avgSelf = (selfA.identity + selfB.identity) / 2;
  const normalized = avgSelf > 0 ? cross.identity / avgSelf : 0;

  return {
    rawIdentity: cross.identity,
    selfA: selfA.identity,
    selfB: selfB.identity,
    normalized,
    overlaps: cross.overlaps,
  };
}

function anchorOverlapIdentity(
  readsA: string[], readsB: string[], anchorLen: number, trim: number,
): { identity: number; overlaps: number } {
  const index = new Map<string, number[]>();
  for (let i = 0; i < readsA.length; i++) {
    const read = readsA[i]!;
    if (read.length < anchorLen + trim * 2) continue;
    const key = read.slice(trim, trim + anchorLen);
    const existing = index.get(key);
    if (existing) { if (existing.length < 3) existing.push(i); }
    else { index.set(key, [i]); }
  }

  let overlaps = 0, matches = 0, mismatches = 0;
  for (const readB of readsB) {
    if (readB.length < anchorLen + trim * 2) continue;
    const key = readB.slice(trim, trim + anchorLen);
    const hits = index.get(key);
    if (!hits) continue;
    for (const idx of hits) {
      const readA = readsA[idx]!;
      overlaps++;
      const start = trim + anchorLen;
      const end = Math.min(readA.length, readB.length) - trim;
      for (let i = start; i < end; i++) {
        if (readA[i] === readB[i]) matches++; else mismatches++;
      }
    }
  }
  const total = matches + mismatches;
  return { identity: total > 0 ? matches / total : 0, overlaps };
}

// ── Alg 4: Multi-seed overlap with voting ──

function multiSeedVoting(
  readsA: string[], readsB: string[],
  seedLen: number, numSeeds: number, minIdentity: number,
): { overlaps: number; avgIdentity: number; score: number } {
  // Build multiple seed indices from A at different offsets
  const stride = Math.max(1, Math.floor((readsA[0]!.length - seedLen) / numSeeds));
  const indices: Map<string, number[]>[] = [];

  for (let s = 0; s < numSeeds; s++) {
    const offset = s * stride;
    const idx = new Map<string, number[]>();
    for (let i = 0; i < readsA.length; i++) {
      const read = readsA[i]!;
      if (offset + seedLen > read.length) continue;
      const seed = read.slice(offset, offset + seedLen);
      const existing = idx.get(seed);
      if (existing) { if (existing.length < 3) existing.push(i); }
      else { idx.set(seed, [i]); }
    }
    indices.push(idx);
  }

  // For each read in B, check all seed positions
  const verified = new Set<string>(); // "readA_idx:readB_idx"
  let totalIdentity = 0;

  for (let bi = 0; bi < readsB.length; bi++) {
    const readB = readsB[bi]!;

    for (let s = 0; s < numSeeds; s++) {
      const offset = s * stride;
      if (offset + seedLen > readB.length) continue;
      const seed = readB.slice(offset, offset + seedLen);
      const hits = indices[s]!.get(seed);
      if (!hits) continue;

      for (const ai of hits) {
        const key = `${ai}:${bi}`;
        if (verified.has(key)) continue;

        const readA = readsA[ai]!;
        const len = Math.min(readA.length, readB.length);
        let matches = 0;
        for (let i = 0; i < len; i++) {
          if (readA[i] === readB[i]) matches++;
        }
        const identity = matches / len;

        if (identity >= minIdentity) {
          verified.add(key);
          totalIdentity += identity;
        }
      }
    }
  }

  return {
    overlaps: verified.size,
    avgIdentity: verified.size > 0 ? totalIdentity / verified.size : 0,
    score: verified.size > 0 ? totalIdentity / verified.size : 0,
  };
}

// ── Alg 5: Overlap count ratio (simple but effective) ──

function overlapCountRatio(
  readsA: string[], readsB: string[], anchorLen: number,
): { overlaps: number; ratioA: number; ratioB: number; score: number } {
  const index = new Map<string, boolean>();
  for (const read of readsA) {
    if (read.length < anchorLen) continue;
    index.set(read.slice(10, 10 + anchorLen), true);
  }

  let overlaps = 0;
  for (const read of readsB) {
    if (read.length < anchorLen) continue;
    if (index.has(read.slice(10, 10 + anchorLen))) overlaps++;
  }

  return {
    overlaps,
    ratioA: overlaps / readsA.length,
    ratioB: overlaps / readsB.length,
    score: overlaps / Math.min(readsA.length, readsB.length),
  };
}

// ── Hash utility ──

function fastHash(str: string, offset: number, len: number): number {
  let h = 0x811c9dc5 | 0;
  for (let i = offset; i < offset + len; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── Runner ──

function runAlgorithm(
  name: string,
  description: string,
  sampleReads: Map<string, string[]>,
  fn: (readsA: string[], readsB: string[]) => { score: number; detail: string },
): void {
  console.log(`\n━━━ ${name} ━━━`);
  console.log(`    ${description}\n`);

  const results: Result[] = [];
  const t0 = performance.now();

  for (const pair of PAIRS) {
    const start = performance.now();
    const { score, detail } = fn(sampleReads.get(pair.a)!, sampleReads.get(pair.b)!);
    const ms = performance.now() - start;
    const marker = pair.related ? "►" : " ";
    results.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, related: pair.related, score, detail });
    console.log(`    ${marker} ${pair.a} ↔ ${pair.b}: ${score.toFixed(6).padStart(10)}  ${detail}  (${(ms/1000).toFixed(1)}s)  ${pair.label}`);
  }

  const totalMs = performance.now() - t0;
  const avgRelated = results.filter(r => r.related).reduce((s, r) => s + r.score, 0) / results.filter(r => r.related).length;
  const avgUnrelated = results.filter(r => !r.related).reduce((s, r) => s + r.score, 0) / Math.max(1, results.filter(r => !r.related).length);
  const sep = avgRelated - avgUnrelated;
  const works = avgRelated > avgUnrelated;
  const motherSon = results.find(r => r.label === "Mother ↔ Son")!;
  const unrelated = results.find(r => !r.related)!;
  const motherGap = motherSon.score - unrelated.score;

  console.log(`\n    Total: ${(totalMs/1000).toFixed(1)}s | Separation: ${sep >= 0 ? "+" : ""}${(sep * 100).toFixed(4)}% | ${works ? "✓ DETECTS" : "✗ FAILS"}`);
  console.log(`    Mother-son gap: ${motherGap >= 0 ? "+" : ""}${(motherGap * 100).toFixed(4)}% ${motherGap > 0 ? "✓" : "✗"}`);
}

// ── Main ──

async function main(): Promise<void> {
  console.log("=== yalumba algorithm benchmark v2 — improved algorithms ===\n");
  console.log("Goal: detect BOTH parent-child pairs, not just father-son.\n");

  const MAX_READS = 2_000_000;

  const sampleReads = new Map<string, string[]>();
  for (const sample of SAMPLES) {
    process.stdout.write(`Loading ${sample.id} (${sample.role})... `);
    const start = performance.now();
    const reads = await loadReads(sample.file, MAX_READS);
    sampleReads.set(sample.id, reads);
    console.log(`${reads.length.toLocaleString()} reads (${((performance.now() - start) / 1000).toFixed(1)}s)`);
  }

  const SUB = 100_000;
  const subReads = new Map<string, string[]>();
  for (const s of SAMPLES) subReads.set(s.id, sampleReads.get(s.id)!.slice(0, SUB));

  // ── Baseline: v1 anchor overlap ──
  runAlgorithm(
    "Baseline: Anchor overlap (60bp)",
    "v1 winner — exact 60bp prefix match, compare remaining bases",
    sampleReads,
    (a, b) => {
      const r = anchorOverlapIdentity(a, b, 60, 10);
      return { score: r.identity, detail: `${r.overlaps.toLocaleString()} overlaps` };
    },
  );

  // ── NEW Alg 1a: Seed-and-extend (identity score) ──
  runAlgorithm(
    "NEW: Seed-extend identity (30bp, >95%)",
    "Shorter seed, full-read identity filter — scored by avg identity",
    sampleReads,
    (a, b) => {
      const r = seedAndExtend(a, b, 30, 0.95);
      return { score: r.avgIdentity, detail: `${r.verified.toLocaleString()} verified / ${r.overlaps.toLocaleString()} candidates` };
    },
  );

  // ── NEW Alg 1b: Seed-and-extend (overlap rate score) ──
  runAlgorithm(
    "NEW: Seed-extend overlap rate (30bp, >95%)",
    "Same algorithm but scored by VERIFIED OVERLAP COUNT per million reads",
    sampleReads,
    (a, b) => {
      const r = seedAndExtend(a, b, 30, 0.95);
      const rate = r.verified / Math.min(a.length, b.length);
      return { score: rate, detail: `${r.verified.toLocaleString()} verified (rate=${(rate*100).toFixed(4)}%)` };
    },
  );

  // ── NEW Alg 2: K-mer frequency correlation ──
  runAlgorithm(
    "NEW: K-mer frequency correlation (k=21)",
    "Pearson correlation of k-mer count vectors over shared k-mers",
    subReads,
    (a, b) => {
      const r = kmerFrequencyCorrelation(a, b, 21);
      return { score: r.correlation, detail: `${r.sharedKmers.toLocaleString()} shared k-mers` };
    },
  );

  // ── NEW Alg 3: Normalized anchor overlap ──
  runAlgorithm(
    "NEW: Normalized anchor overlap (60bp)",
    "Cross-sample identity / self-similarity baseline — controls for batch effects",
    sampleReads,
    (a, b) => {
      const r = normalizedAnchorOverlap(a, b, 60, 10);
      return { score: r.normalized, detail: `raw=${(r.rawIdentity*100).toFixed(3)}% selfA=${(r.selfA*100).toFixed(3)}% selfB=${(r.selfB*100).toFixed(3)}%` };
    },
  );

  // ── NEW Alg 4: Multi-seed voting ──
  runAlgorithm(
    "NEW: Multi-seed voting (25bp ×5 seeds, >95% filter)",
    "Five 25bp seeds at different positions, verify full-read identity, deduplicate",
    sampleReads,
    (a, b) => {
      const r = multiSeedVoting(a, b, 25, 5, 0.95);
      return { score: r.avgIdentity, detail: `${r.overlaps.toLocaleString()} verified overlaps` };
    },
  );

  // ── NEW Alg 5: Overlap count ratio ──
  runAlgorithm(
    "NEW: Overlap count ratio (50bp anchor)",
    "Simply count how many reads share a 50bp anchor — ratio = relatedness proxy",
    sampleReads,
    (a, b) => {
      const r = overlapCountRatio(a, b, 50);
      return { score: r.score, detail: `${r.overlaps.toLocaleString()} overlaps, ratio=${(r.score*100).toFixed(4)}%` };
    },
  );

  // ── NEW Alg 6: Seed-and-extend with lower threshold ──
  runAlgorithm(
    "NEW: Seed-and-extend (30bp seed, >90% identity filter)",
    "Relaxed threshold captures more true overlaps with some noise",
    sampleReads,
    (a, b) => {
      const r = seedAndExtend(a, b, 30, 0.90);
      return { score: r.avgIdentity, detail: `${r.verified.toLocaleString()} verified / ${r.overlaps.toLocaleString()} candidates` };
    },
  );

  // ── NEW Alg 7: K-mer frequency correlation k=15 ──
  runAlgorithm(
    "NEW: K-mer frequency correlation (k=15)",
    "Shorter k-mers = more shared, stronger frequency signal",
    subReads,
    (a, b) => {
      const r = kmerFrequencyCorrelation(a, b, 15);
      return { score: r.correlation, detail: `${r.sharedKmers.toLocaleString()} shared k-mers` };
    },
  );

  console.log("\n\n═══ KEY: Mother-son gap must be positive for the algorithm to work ═══");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
