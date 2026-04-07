#!/usr/bin/env bun

/**
 * Generates synthetic FASTQ files for a small family with known relatedness.
 *
 * Family structure:
 *   Parent A ──┬── Parent B
 *              │
 *         ┌────┴────┐
 *       Child 1   Child 2 (full siblings)
 *
 * Genetics model:
 *   - A "reference genome" is generated as the shared ancestor backbone
 *   - Each parent gets ~50% of their genome from the reference + random mutations
 *   - Each child inherits ~50% from Parent A and ~50% from Parent B
 *   - Full siblings share ~50% IBD (some segments from same parent, some different)
 *
 * Output: one .fastq file per family member in data/synthetic/
 */

import { writeFileSync } from "fs";
import { join } from "path";

const BASES = ["A", "C", "G", "T"] as const;
const OUTPUT_DIR = join(import.meta.dir, "../data/synthetic");

interface FamilyConfig {
  /** Length of the simulated genome in bases */
  readonly genomeLength: number;
  /** Number of reads to generate per individual */
  readonly readsPerPerson: number;
  /** Length of each read */
  readonly readLength: number;
  /** Mutation rate per base (between parent genomes) */
  readonly mutationRate: number;
  /** Average recombination block size in bases */
  readonly blockSize: number;
  /** Base quality score (Phred) */
  readonly baseQuality: number;
  /** Sequencing error rate */
  readonly errorRate: number;
}

const DEFAULT_CONFIG: FamilyConfig = {
  genomeLength: 100_000,
  readsPerPerson: 2_000,
  readLength: 150,
  mutationRate: 0.001,
  blockSize: 5_000,
  baseQuality: 30,
  errorRate: 0.005,
};

function randomBase(): string {
  return BASES[Math.floor(Math.random() * 4)]!;
}

function mutateBase(base: string, rate: number): string {
  if (Math.random() < rate) {
    const others = BASES.filter((b) => b !== base);
    return others[Math.floor(Math.random() * 3)]!;
  }
  return base;
}

/** Generate a random reference genome */
function generateGenome(length: number): string {
  const bases: string[] = new Array(length);
  for (let i = 0; i < length; i++) {
    bases[i] = randomBase();
  }
  return bases.join("");
}

/** Create a diploid genome from two haplotypes */
interface DiploidGenome {
  readonly haplotype1: string;
  readonly haplotype2: string;
}

/** Generate a parent genome — two independent random haplotypes */
function generateParent(length: number): DiploidGenome {
  return {
    haplotype1: generateGenome(length),
    haplotype2: generateGenome(length),
  };
}

/** Simulate meiosis — pick blocks from haplotype 1 or 2 with crossovers */
function meiosis(parent: DiploidGenome, blockSize: number): string {
  const length = parent.haplotype1.length;
  const result: string[] = new Array(length);
  let useHap1 = Math.random() < 0.5;
  let nextCrossover = Math.floor(Math.random() * blockSize * 2);

  for (let i = 0; i < length; i++) {
    if (i >= nextCrossover) {
      useHap1 = !useHap1;
      nextCrossover = i + Math.floor(Math.random() * blockSize * 2);
    }
    result[i] = useHap1 ? parent.haplotype1[i]! : parent.haplotype2[i]!;
  }

  return result.join("");
}

/** Generate a child from two parents via simulated meiosis */
function generateChild(
  parentA: DiploidGenome,
  parentB: DiploidGenome,
  blockSize: number,
): DiploidGenome {
  return {
    haplotype1: meiosis(parentA, blockSize),
    haplotype2: meiosis(parentB, blockSize),
  };
}

/** Generate reads from a diploid genome */
function generateReads(
  genome: DiploidGenome,
  readCount: number,
  readLength: number,
  errorRate: number,
): string[] {
  const lines: string[] = [];
  const maxStart = genome.haplotype1.length - readLength;

  for (let i = 0; i < readCount; i++) {
    const hap = Math.random() < 0.5 ? genome.haplotype1 : genome.haplotype2;
    const start = Math.floor(Math.random() * maxStart);
    const read = hap.slice(start, start + readLength);

    const noisyRead = applyErrors(read, errorRate);
    const qual = qualityString(readLength, errorRate);

    lines.push(`@read_${i} pos=${start}`);
    lines.push(noisyRead);
    lines.push("+");
    lines.push(qual);
  }

  return lines;
}

/** Introduce sequencing errors into a read */
function applyErrors(read: string, errorRate: number): string {
  const chars: string[] = new Array(read.length);
  for (let i = 0; i < read.length; i++) {
    chars[i] = mutateBase(read[i]!, errorRate);
  }
  return chars.join("");
}

/** Generate a quality string */
function qualityString(length: number, errorRate: number): string {
  const basePhred = Math.round(-10 * Math.log10(Math.max(errorRate, 1e-10)));
  const chars: string[] = new Array(length);
  for (let i = 0; i < length; i++) {
    const jitter = Math.floor(Math.random() * 5) - 2;
    const phred = Math.max(2, Math.min(40, basePhred + jitter));
    chars[i] = String.fromCharCode(phred + 33);
  }
  return chars.join("");
}

/** Compute sequence similarity between two diploid genomes */
function computeSimilarity(a: DiploidGenome, b: DiploidGenome): number {
  const len = a.haplotype1.length;
  let identicalSites = 0;
  for (let i = 0; i < len; i++) {
    const aSet = new Set([a.haplotype1[i], a.haplotype2[i]]);
    const bSet = new Set([b.haplotype1[i], b.haplotype2[i]]);
    // Count sites where at least one allele is shared
    let shared = false;
    for (const allele of aSet) {
      if (bSet.has(allele)) { shared = true; break; }
    }
    if (shared) identicalSites++;
  }
  return identicalSites / len;
}

/** Compute k-mer based Jaccard similarity between consensus sequences */
function computeKmerSimilarity(a: DiploidGenome, b: DiploidGenome, k: number = 21): number {
  const seqA = a.haplotype1;
  const seqB = b.haplotype1;
  const setA = new Set<string>();
  const setB = new Set<string>();

  for (let i = 0; i <= seqA.length - k; i++) setA.add(seqA.slice(i, i + k));
  for (let i = 0; i <= seqB.length - k; i++) setB.add(seqB.slice(i, i + k));

  let shared = 0;
  for (const kmer of setA) {
    if (setB.has(kmer)) shared++;
  }
  const union = setA.size + setB.size - shared;
  return union > 0 ? shared / union : 0;
}

function writeFastq(name: string, lines: string[]): string {
  const path = join(OUTPUT_DIR, `${name}.fastq`);
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}

// --- Main ---

const config = DEFAULT_CONFIG;

console.log("=== yalumba synthetic family generator ===\n");
console.log(`Genome length: ${config.genomeLength.toLocaleString()} bp`);
console.log(`Reads per person: ${config.readsPerPerson.toLocaleString()}`);
console.log(`Read length: ${config.readLength} bp`);
console.log(`Mutation rate: ${config.mutationRate}`);
console.log(`Error rate: ${config.errorRate}`);
console.log(`Block size: ${config.blockSize.toLocaleString()} bp\n`);

console.log("Generating parents (unrelated individuals)...");
const parentA = generateParent(config.genomeLength);
const parentB = generateParent(config.genomeLength);

console.log("Generating children (full siblings)...");
const child1 = generateChild(parentA, parentB, config.blockSize);
const child2 = generateChild(parentA, parentB, config.blockSize);

console.log("Generating reads...\n");

const members = [
  { name: "parent_a", genome: parentA, label: "Parent A" },
  { name: "parent_b", genome: parentB, label: "Parent B" },
  { name: "child_1", genome: child1, label: "Child 1" },
  { name: "child_2", genome: child2, label: "Child 2" },
];

for (const member of members) {
  const reads = generateReads(
    member.genome,
    config.readsPerPerson,
    config.readLength,
    config.errorRate,
  );
  const path = writeFastq(member.name, reads);
  console.log(`  ${member.label}: ${path}`);
}

// Ground truth IBD
console.log("\n--- Ground truth relatedness ---\n");

const pairs = [
  ["Parent A", parentA, "Parent B", parentB],
  ["Parent A", parentA, "Child 1", child1],
  ["Parent A", parentA, "Child 2", child2],
  ["Parent B", parentB, "Child 1", child1],
  ["Parent B", parentB, "Child 2", child2],
  ["Child 1", child1, "Child 2", child2],
] as const;

for (const [nameA, genomeA, nameB, genomeB] of pairs) {
  const alleleSim = computeSimilarity(
    genomeA as DiploidGenome,
    genomeB as DiploidGenome,
  );
  const kmerSim = computeKmerSimilarity(
    genomeA as DiploidGenome,
    genomeB as DiploidGenome,
  );
  console.log(`  ${nameA} <-> ${nameB}: allele=${(alleleSim * 100).toFixed(1)}% kmer_jaccard=${(kmerSim * 100).toFixed(2)}%`);
}

console.log("\nDone. Files written to data/synthetic/");
