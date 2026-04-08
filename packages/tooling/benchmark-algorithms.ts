#!/usr/bin/env bun

/**
 * Benchmark all relatedness detection algorithms on GIAB data.
 * Reports timing, accuracy, and separation quality for each approach.
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";
import { JaccardSimilarity } from "@yalumba/alignment";
import { KmerIndex } from "@yalumba/kmer";

const DATA_DIR = join(import.meta.dir, "../../data/giab");

interface Sample { readonly id: string; readonly role: string; readonly file: string; }
interface PairDef { readonly a: string; readonly b: string; readonly label: string; readonly related: boolean; }
interface AlgorithmResult {
  readonly name: string;
  readonly description: string;
  readonly pairs: { pair: string; label: string; related: boolean; score: number; detail: string }[];
  readonly totalTimeMs: number;
  readonly separation: number; // avg related score - avg unrelated score
  readonly correct: boolean;   // related > unrelated?
}

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

// ── Load data ──

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

// ── Hash utilities (fast, no bigint) ──

function fastHash(str: string, offset: number, len: number): number {
  let h = 0x811c9dc5 | 0;
  for (let i = offset; i < offset + len; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Two hashes combined for less collision: pack into a single bigint for Set storage */
function dualHash(str: string, offset: number, len: number): number {
  let h1 = 0x811c9dc5 | 0;
  let h2 = 0x9e3779b9 | 0;
  for (let i = offset; i < offset + len; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193);
    h2 ^= c; h2 = Math.imul(h2, 0x1000033);
  }
  // Combine into single 52-bit safe integer
  return ((h1 >>> 0) * 0x100000 + ((h2 >>> 0) & 0xfffff)) | 0;
}

function canonicalHash(seq: string, offset: number, k: number): number {
  const fwd = fastHash(seq, offset, k);
  // Reverse complement hash
  let h = 0x811c9dc5 | 0;
  for (let i = offset + k - 1; i >= offset; i--) {
    const c = seq.charCodeAt(i);
    const comp = c === 65 ? 84 : c === 84 ? 65 : c === 67 ? 71 : c === 71 ? 67 : c;
    h ^= comp;
    h = Math.imul(h, 0x01000193);
  }
  const rev = h >>> 0;
  return fwd < rev ? fwd : rev;
}

// ── Algorithm 1: K-mer Jaccard (exact) ──

function kmerJaccard(readsA: string[], readsB: string[], k: number): { score: number; shared: number; union: number } {
  const setA = new Set<number>();
  for (const read of readsA) {
    for (let i = 0; i <= read.length - k; i++) {
      setA.add(canonicalHash(read, i, k));
    }
  }
  const setB = new Set<number>();
  for (const read of readsB) {
    for (let i = 0; i <= read.length - k; i++) {
      setB.add(canonicalHash(read, i, k));
    }
  }
  let shared = 0;
  for (const h of setA) { if (setB.has(h)) shared++; }
  const union = setA.size + setB.size - shared;
  return { score: union > 0 ? shared / union : 0, shared, union };
}

// ── Algorithm 2: Bottom-sketch MinHash ──

function bottomSketch(reads: string[], k: number, size: number): number[] {
  const heap: number[] = [];
  const seen = new Set<number>();
  let maxVal = 0;

  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      const h = canonicalHash(read, i, k);
      if (seen.has(h)) continue;
      if (heap.length < size) {
        heap.push(h);
        seen.add(h);
        if (h > maxVal) maxVal = h;
      } else if (h < maxVal) {
        const maxIdx = heap.indexOf(maxVal);
        seen.delete(maxVal);
        heap[maxIdx] = h;
        seen.add(h);
        maxVal = 0;
        for (const v of heap) { if (v > maxVal) maxVal = v; }
      }
    }
  }
  return heap;
}

function sketchSimilarity(a: number[], b: number[]): number {
  const setB = new Set(b);
  let shared = 0;
  for (const h of a) { if (setB.has(h)) shared++; }
  const union = new Set([...a, ...b]).size;
  return union > 0 ? shared / union : 0;
}

// ── Algorithm 3: Anchor-based overlap (the one that works) ──

function anchorCompare(
  readsA: string[], readsB: string[], anchorLen: number, trim: number,
): { overlaps: number; identity: number; mismatchRate: number } {
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
  return { overlaps, identity: total > 0 ? matches / total : 0, mismatchRate: total > 0 ? mismatches / total : 0 };
}

// ── Algorithm 4: Shared unique reads (exact read dedup + intersection) ──

function sharedUniqueReads(readsA: string[], readsB: string[]): { shared: number; totalA: number; totalB: number; jaccard: number } {
  const setA = new Set(readsA);
  const setB = new Set(readsB);
  let shared = 0;
  for (const r of setA) { if (setB.has(r)) shared++; }
  const union = setA.size + setB.size - shared;
  return { shared, totalA: setA.size, totalB: setB.size, jaccard: union > 0 ? shared / union : 0 };
}

// ── Algorithm 5: Containment index (asymmetric — what fraction of A's k-mers are in B) ──

function containmentIndex(readsA: string[], readsB: string[], k: number): { abContainment: number; baContainment: number; avg: number } {
  const setA = new Set<number>();
  for (const read of readsA) {
    for (let i = 0; i <= read.length - k; i++) setA.add(canonicalHash(read, i, k));
  }
  const setB = new Set<number>();
  for (const read of readsB) {
    for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
  }
  let shared = 0;
  for (const h of setA) { if (setB.has(h)) shared++; }
  return {
    abContainment: setA.size > 0 ? shared / setA.size : 0,
    baContainment: setB.size > 0 ? shared / setB.size : 0,
    avg: (setA.size + setB.size) > 0 ? shared / ((setA.size + setB.size) / 2) : 0,
  };
}

// ── Algorithm 6: Multi-anchor overlap (use multiple anchor positions per read) ──

function multiAnchorCompare(
  readsA: string[], readsB: string[], anchorLen: number, trim: number, numAnchors: number,
): { overlaps: number; identity: number; mismatchRate: number } {
  const index = new Map<string, { readIdx: number; anchorOffset: number }[]>();
  const stride = Math.max(1, Math.floor((readsA[0]!.length - trim * 2 - anchorLen) / (numAnchors - 1)));

  for (let i = 0; i < readsA.length; i++) {
    const read = readsA[i]!;
    if (read.length < anchorLen + trim * 2) continue;
    for (let a = 0; a < numAnchors; a++) {
      const offset = trim + a * stride;
      if (offset + anchorLen > read.length - trim) break;
      const key = read.slice(offset, offset + anchorLen);
      const existing = index.get(key);
      if (existing) { if (existing.length < 3) existing.push({ readIdx: i, anchorOffset: offset }); }
      else { index.set(key, [{ readIdx: i, anchorOffset: offset }]); }
    }
  }

  let overlaps = 0, matches = 0, mismatches = 0;
  for (const readB of readsB) {
    if (readB.length < anchorLen + trim * 2) continue;
    for (let a = 0; a < numAnchors; a++) {
      const offset = trim + a * stride;
      if (offset + anchorLen > readB.length - trim) break;
      const key = readB.slice(offset, offset + anchorLen);
      const hits = index.get(key);
      if (!hits) continue;
      for (const hit of hits) {
        const readA = readsA[hit.readIdx]!;
        overlaps++;
        // Compare bases outside anchor
        const aStart = hit.anchorOffset + anchorLen;
        const aEnd = Math.min(readA.length, readB.length) - trim;
        for (let i = aStart; i < aEnd; i++) {
          if (readA[i] === readB[i]) matches++; else mismatches++;
        }
        // Also compare before anchor
        for (let i = trim; i < hit.anchorOffset; i++) {
          if (readA[i] === readB[i]) matches++; else mismatches++;
        }
      }
    }
  }
  const total = matches + mismatches;
  return { overlaps, identity: total > 0 ? matches / total : 0, mismatchRate: total > 0 ? mismatches / total : 0 };
}

// ── Run all ──

async function main(): Promise<void> {
  console.log("=== yalumba algorithm benchmark — GIAB Ashkenazi trio ===\n");
  console.log("HG003 (Father) + HG004 (Mother) → HG002 (Son)\n");

  const MAX_READS = 2_000_000;

  const sampleReads = new Map<string, string[]>();
  for (const sample of SAMPLES) {
    process.stdout.write(`Loading ${sample.id} (${sample.role})... `);
    const start = performance.now();
    const reads = await loadReads(sample.file, MAX_READS);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    sampleReads.set(sample.id, reads);
    console.log(`${reads.length.toLocaleString()} reads, ${reads[0]?.length}bp (${elapsed}s)`);
  }
  console.log();

  const results: AlgorithmResult[] = [];

  // Subsample for expensive k-mer algorithms (careful with memory)
  const SUBSAMPLE = 100_000;
  const subReads = new Map<string, string[]>();
  for (const s of SAMPLES) {
    subReads.set(s.id, sampleReads.get(s.id)!.slice(0, SUBSAMPLE));
  }

  // ── Alg 1: K-mer Jaccard (k=21, subsampled) ──
  {
    const name = "K-mer Jaccard (k=21)";
    const desc = `Exact set intersection of canonical 21-mers. ${SUBSAMPLE.toLocaleString()} reads/sample.`;
    console.log(`Running: ${name}...`);
    const pairs: AlgorithmResult["pairs"] = [];
    const t0 = performance.now();
    for (const pair of PAIRS) {
      const start = performance.now();
      const r = kmerJaccard(subReads.get(pair.a)!, subReads.get(pair.b)!, 21);
      const ms = performance.now() - start;
      pairs.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, related: pair.related, score: r.score, detail: `shared=${r.shared.toLocaleString()} union=${r.union.toLocaleString()} (${(ms/1000).toFixed(1)}s)` });
    }
    const totalMs = performance.now() - t0;
    const avgRelated = pairs.filter(p => p.related).reduce((s, p) => s + p.score, 0) / pairs.filter(p => p.related).length;
    const avgUnrelated = pairs.filter(p => !p.related).reduce((s, p) => s + p.score, 0) / Math.max(1, pairs.filter(p => !p.related).length);
    results.push({ name, description: desc, pairs, totalTimeMs: totalMs, separation: avgRelated - avgUnrelated, correct: avgRelated > avgUnrelated });
    console.log(`  Done in ${(totalMs/1000).toFixed(1)}s\n`);
  }

  // ── Alg 2: Bottom-sketch MinHash (k=21, sketch=5000) ──
  {
    const SKETCH = 5000;
    const name = `MinHash bottom-sketch (k=21, s=${SKETCH})`;
    const desc = `Keep ${SKETCH} smallest canonical 21-mer hashes per sample. ${SUBSAMPLE.toLocaleString()} reads.`;
    console.log(`Running: ${name}...`);
    const t0 = performance.now();
    const sketches = new Map<string, number[]>();
    for (const s of SAMPLES) {
      sketches.set(s.id, bottomSketch(subReads.get(s.id)!, 21, SKETCH));
    }
    const pairs: AlgorithmResult["pairs"] = [];
    for (const pair of PAIRS) {
      const start = performance.now();
      const sim = sketchSimilarity(sketches.get(pair.a)!, sketches.get(pair.b)!);
      const ms = performance.now() - start;
      pairs.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, related: pair.related, score: sim, detail: `(${(ms/1000).toFixed(3)}s compare)` });
    }
    const totalMs = performance.now() - t0;
    const avgRelated = pairs.filter(p => p.related).reduce((s, p) => s + p.score, 0) / pairs.filter(p => p.related).length;
    const avgUnrelated = pairs.filter(p => !p.related).reduce((s, p) => s + p.score, 0) / Math.max(1, pairs.filter(p => !p.related).length);
    results.push({ name, description: desc, pairs, totalTimeMs: totalMs, separation: avgRelated - avgUnrelated, correct: avgRelated > avgUnrelated });
    console.log(`  Done in ${(totalMs/1000).toFixed(1)}s\n`);
  }

  // ── Alg 3: Containment index (k=21) ──
  {
    const name = "Containment index (k=21)";
    const desc = `Fraction of one sample's 21-mers found in the other. ${SUBSAMPLE.toLocaleString()} reads.`;
    console.log(`Running: ${name}...`);
    const pairs: AlgorithmResult["pairs"] = [];
    const t0 = performance.now();
    for (const pair of PAIRS) {
      const start = performance.now();
      const r = containmentIndex(subReads.get(pair.a)!, subReads.get(pair.b)!, 21);
      const ms = performance.now() - start;
      pairs.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, related: pair.related, score: r.avg, detail: `A→B=${(r.abContainment*100).toFixed(2)}% B→A=${(r.baContainment*100).toFixed(2)}% (${(ms/1000).toFixed(1)}s)` });
    }
    const totalMs = performance.now() - t0;
    const avgRelated = pairs.filter(p => p.related).reduce((s, p) => s + p.score, 0) / pairs.filter(p => p.related).length;
    const avgUnrelated = pairs.filter(p => !p.related).reduce((s, p) => s + p.score, 0) / Math.max(1, pairs.filter(p => !p.related).length);
    results.push({ name, description: desc, pairs, totalTimeMs: totalMs, separation: avgRelated - avgUnrelated, correct: avgRelated > avgUnrelated });
    console.log(`  Done in ${(totalMs/1000).toFixed(1)}s\n`);
  }

  // ── Alg 4: Shared unique reads ──
  {
    const name = "Shared unique reads";
    const desc = `Count reads appearing identically in both samples. Full ${MAX_READS.toLocaleString()} reads.`;
    console.log(`Running: ${name}...`);
    const pairs: AlgorithmResult["pairs"] = [];
    const t0 = performance.now();
    for (const pair of PAIRS) {
      const start = performance.now();
      const r = sharedUniqueReads(sampleReads.get(pair.a)!, sampleReads.get(pair.b)!);
      const ms = performance.now() - start;
      pairs.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, related: pair.related, score: r.jaccard, detail: `shared=${r.shared.toLocaleString()} A=${r.totalA.toLocaleString()} B=${r.totalB.toLocaleString()} (${(ms/1000).toFixed(1)}s)` });
    }
    const totalMs = performance.now() - t0;
    const avgRelated = pairs.filter(p => p.related).reduce((s, p) => s + p.score, 0) / pairs.filter(p => p.related).length;
    const avgUnrelated = pairs.filter(p => !p.related).reduce((s, p) => s + p.score, 0) / Math.max(1, pairs.filter(p => !p.related).length);
    results.push({ name, description: desc, pairs, totalTimeMs: totalMs, separation: avgRelated - avgUnrelated, correct: avgRelated > avgUnrelated });
    console.log(`  Done in ${(totalMs/1000).toFixed(1)}s\n`);
  }

  // ── Alg 5: Anchor overlap (60bp, single anchor) ──
  {
    const name = "Anchor overlap (60bp)";
    const desc = `Index reads by 60bp prefix, compare remaining bases at matched positions. Full reads.`;
    console.log(`Running: ${name}...`);
    const pairs: AlgorithmResult["pairs"] = [];
    const t0 = performance.now();
    for (const pair of PAIRS) {
      const start = performance.now();
      const r = anchorCompare(sampleReads.get(pair.a)!, sampleReads.get(pair.b)!, 60, 10);
      const ms = performance.now() - start;
      pairs.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, related: pair.related, score: r.identity, detail: `overlaps=${r.overlaps.toLocaleString()} mismatch=${(r.mismatchRate*100).toFixed(3)}% (${(ms/1000).toFixed(1)}s)` });
    }
    const totalMs = performance.now() - t0;
    const avgRelated = pairs.filter(p => p.related).reduce((s, p) => s + p.score, 0) / pairs.filter(p => p.related).length;
    const avgUnrelated = pairs.filter(p => !p.related).reduce((s, p) => s + p.score, 0) / Math.max(1, pairs.filter(p => !p.related).length);
    results.push({ name, description: desc, pairs, totalTimeMs: totalMs, separation: avgRelated - avgUnrelated, correct: avgRelated > avgUnrelated });
    console.log(`  Done in ${(totalMs/1000).toFixed(1)}s\n`);
  }

  // ── Alg 6: Multi-anchor overlap (40bp, 3 anchors) ──
  {
    const name = "Multi-anchor overlap (40bp ×3)";
    const desc = `Three 40bp anchors per read at different offsets, compare non-anchor bases.`;
    console.log(`Running: ${name}...`);
    const pairs: AlgorithmResult["pairs"] = [];
    const t0 = performance.now();
    for (const pair of PAIRS) {
      const start = performance.now();
      const r = multiAnchorCompare(sampleReads.get(pair.a)!, sampleReads.get(pair.b)!, 40, 10, 3);
      const ms = performance.now() - start;
      pairs.push({ pair: `${pair.a} ↔ ${pair.b}`, label: pair.label, related: pair.related, score: r.identity, detail: `overlaps=${r.overlaps.toLocaleString()} mismatch=${(r.mismatchRate*100).toFixed(3)}% (${(ms/1000).toFixed(1)}s)` });
    }
    const totalMs = performance.now() - t0;
    const avgRelated = pairs.filter(p => p.related).reduce((s, p) => s + p.score, 0) / pairs.filter(p => p.related).length;
    const avgUnrelated = pairs.filter(p => !p.related).reduce((s, p) => s + p.score, 0) / Math.max(1, pairs.filter(p => !p.related).length);
    results.push({ name, description: desc, pairs, totalTimeMs: totalMs, separation: avgRelated - avgUnrelated, correct: avgRelated > avgUnrelated });
    console.log(`  Done in ${(totalMs/1000).toFixed(1)}s\n`);
  }

  // ── Summary ──
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║                        ALGORITHM COMPARISON                             ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  for (const alg of results) {
    const status = alg.correct ? "✓ DETECTS" : "✗ FAILS";
    console.log(`── ${alg.name} ── ${status} ── ${(alg.totalTimeMs/1000).toFixed(1)}s total ──`);
    console.log(`   ${alg.description}`);
    for (const p of alg.pairs) {
      const marker = p.related ? "►" : " ";
      console.log(`   ${marker} ${p.pair.padEnd(16)} ${p.score.toFixed(6).padStart(10)}  ${p.detail}`);
    }
    console.log(`   Separation: ${alg.separation >= 0 ? "+" : ""}${(alg.separation * 100).toFixed(4)}%  ${alg.correct ? "(related > unrelated)" : "(WRONG DIRECTION)"}`);
    console.log();
  }

  // ── Leaderboard ──
  console.log("── LEADERBOARD (sorted by separation) ──\n");
  const sorted = [...results].sort((a, b) => {
    if (a.correct !== b.correct) return a.correct ? -1 : 1;
    return Math.abs(b.separation) - Math.abs(a.separation);
  });
  console.log("  Rank  Algorithm                        Time     Sep     Works?");
  console.log("  " + "─".repeat(70));
  sorted.forEach((alg, i) => {
    const rank = `${i + 1}.`.padEnd(4);
    const name = alg.name.padEnd(33);
    const time = `${(alg.totalTimeMs/1000).toFixed(1)}s`.padStart(7);
    const sep = `${alg.separation >= 0 ? "+" : ""}${(alg.separation * 100).toFixed(4)}%`.padStart(10);
    const works = alg.correct ? "  ✓" : "  ✗";
    console.log(`  ${rank}${name}${time}  ${sep}${works}`);
  });
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
