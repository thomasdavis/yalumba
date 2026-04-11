#!/usr/bin/env bun

/**
 * Representation Audit — the experiment that should have come before v11.
 *
 * For each sample, generate controlled perturbations:
 *   - Coverage ladder: 100%, 80%, 60%, 40% of reads
 *   - Shuffle: randomize read order (tests ordering artifacts)
 *
 * For each perturbation, extract the full feature set:
 *   - Module count
 *   - Triangle count
 *   - Mean/std curvature
 *   - Curvature P50, P90
 *   - Edge density
 *   - Mean/max degree
 *   - Role distribution (5 values)
 *
 * Then compute:
 *   - Self-consistency: how stable is each feature under perturbation?
 *   - Cross-sample variance: how much does each feature vary between samples?
 *   - Signal-to-nuisance ratio: cross-sample kinship effect / self-perturbation variance
 *
 * A feature earns its place only if:
 *   self-consistency > parent-child similarity gain > unrelated similarity gain
 */

import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";
import {
  buildInteractionGraph,
  normalizedLaplacian,
  eigenDecomposition,
  assignRoles,
  extractPatches,
  computeCurvatureProfile,
} from "@yalumba/ecology";
import type { ModuleExtractionOptions } from "@yalumba/modules";

const ROOT = join(import.meta.dir, "../../../");
const DATA_DIR = join(ROOT, "data/ceph-6");

const EXTRACT_OPTS: ModuleExtractionOptions = {
  motifK: 15,
  windowSize: 150,
  minSupport: 3,
  minCohesion: 0.25,
};

const SAMPLES = [
  { id: "NA12889", role: "Pat. grandfather", file: "NA12889_R1.fastq.gz" },
  { id: "NA12890", role: "Pat. grandmother", file: "NA12890_R1.fastq.gz" },
  { id: "NA12891", role: "Mat. grandfather", file: "NA12891_R1.fastq.gz" },
  { id: "NA12892", role: "Mat. grandmother", file: "NA12892_R1.fastq.gz" },
  { id: "NA12877", role: "Father", file: "NA12877_R1.fastq.gz" },
  { id: "NA12878", role: "Mother", file: "NA12878_R1.fastq.gz" },
];

const COVERAGE_LEVELS = [1.0, 0.8, 0.6, 0.4];
const MAX_READS = 50_000;

/** Feature vector extracted from a graph */
interface FeatureVector {
  moduleCount: number;
  triangleCount: number;
  edgeCount: number;
  edgeDensity: number;
  meanDegree: number;
  maxDegree: number;
  curvatureMean: number;
  curvatureStd: number;
  curvatureP50: number;
  curvatureP90: number;
  roleCounts: number[]; // 5 roles
}

async function loadReads(file: string, maxReads: number): Promise<string[]> {
  const fullPath = join(DATA_DIR, file);
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

function subsample(reads: string[], fraction: number): string[] {
  const n = Math.floor(reads.length * fraction);
  // Deterministic subsample: take every 1/fraction-th read
  const step = Math.max(1, Math.floor(1 / fraction));
  const result: string[] = [];
  for (let i = 0; i < reads.length && result.length < n; i += step) {
    result.push(reads[i]!);
  }
  return result;
}

function shuffle(reads: string[], seed: number): string[] {
  const arr = [...reads];
  let rng = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
    const j = rng % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function extractFeatures(reads: string[], sampleId: string): FeatureVector {
  const graph = buildInteractionGraph(reads, EXTRACT_OPTS);
  const n = graph.n;
  const A = graph.adjacency.data;

  // Count edges and degrees
  let edgeCount = 0;
  const degrees = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (A[i * n + j]! > 1e-12) {
        edgeCount++;
        degrees[i]!++;
        degrees[j]!++;
      }
    }
  }

  const meanDegree = n > 0 ? [...degrees].reduce((s, v) => s + v, 0) / n : 0;
  const maxDegree = n > 0 ? Math.max(...degrees) : 0;
  const edgeDensity = n > 1 ? (2 * edgeCount) / (n * (n - 1)) : 0;

  // Count triangles
  let triangleCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (A[i * n + j]! < 1e-12) continue;
      for (let k = j + 1; k < n; k++) {
        if (A[j * n + k]! < 1e-12) continue;
        if (A[i * n + k]! < 1e-12) continue;
        triangleCount++;
      }
    }
  }

  // Roles
  const laplacian = normalizedLaplacian(graph.adjacency);
  const eigen = eigenDecomposition(laplacian);
  const roles = assignRoles(graph, eigen);
  const roleCounts = [0, 0, 0, 0, 0]; // core, satellite, bridge, scaffold, boundary
  for (const r of roles) {
    const idx = ["core", "satellite", "bridge", "scaffold", "boundary"].indexOf(r.role);
    if (idx >= 0) roleCounts[idx]!++;
  }

  // Curvature
  const patches = extractPatches(sampleId, graph, roles);
  const curvProfile = computeCurvatureProfile(patches);

  return {
    moduleCount: n,
    triangleCount,
    edgeCount,
    edgeDensity,
    meanDegree,
    maxDegree,
    curvatureMean: curvProfile.mean,
    curvatureStd: curvProfile.std,
    curvatureP50: curvProfile.p50,
    curvatureP90: curvProfile.p90,
    roleCounts,
  };
}

function featureToArray(f: FeatureVector): number[] {
  return [
    f.moduleCount, f.triangleCount, f.edgeCount, f.edgeDensity,
    f.meanDegree, f.maxDegree,
    f.curvatureMean, f.curvatureStd, f.curvatureP50, f.curvatureP90,
    ...f.roleCounts,
  ];
}

const FEATURE_NAMES = [
  "moduleCount", "triangleCount", "edgeCount", "edgeDensity",
  "meanDegree", "maxDegree",
  "curvMean", "curvStd", "curvP50", "curvP90",
  "role_core", "role_satellite", "role_bridge", "role_scaffold", "role_boundary",
];

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║              REPRESENTATION AUDIT                            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log("Testing feature stability under coverage perturbation.\n");

  // ── Phase 1: Load all reads ──
  const allReads = new Map<string, string[]>();
  for (const sample of SAMPLES) {
    process.stdout.write(`Loading ${sample.id}... `);
    const reads = await loadReads(sample.file, MAX_READS);
    allReads.set(sample.id, reads);
    console.log(`${reads.length} reads`);
  }
  console.log();

  // ── Phase 2: Extract features at each coverage level ──
  const featuresByLevel = new Map<string, Map<number, FeatureVector>>(); // sample → coverage → features

  for (const sample of SAMPLES) {
    const reads = allReads.get(sample.id)!;
    const sampleFeatures = new Map<number, FeatureVector>();

    for (const level of COVERAGE_LEVELS) {
      const subReads = level >= 1.0 ? reads : subsample(reads, level);
      process.stdout.write(`  ${sample.id} @ ${(level * 100).toFixed(0)}% (${subReads.length} reads)... `);
      const t0 = performance.now();
      const features = extractFeatures(subReads, sample.id);
      console.log(`${features.moduleCount} mod, ${features.triangleCount} tri (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
      sampleFeatures.set(level, features);
    }

    // Also test shuffle at 100%
    const shuffled = shuffle(reads, 42);
    process.stdout.write(`  ${sample.id} @ shuffled... `);
    const t0 = performance.now();
    const shuffledFeatures = extractFeatures(shuffled, sample.id);
    console.log(`${shuffledFeatures.moduleCount} mod, ${shuffledFeatures.triangleCount} tri (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
    sampleFeatures.set(-1, shuffledFeatures); // -1 = shuffled

    featuresByLevel.set(sample.id, sampleFeatures);
    console.log();
  }

  // ── Phase 3: Compute self-perturbation variance ──
  console.log("\n═══ SELF-PERTURBATION ANALYSIS ═══\n");
  console.log("How much does each feature change when we subsample the SAME individual?\n");

  const selfVariances = new Map<string, number[]>(); // feature → per-sample CV values

  for (let fi = 0; fi < FEATURE_NAMES.length; fi++) {
    const cvs: number[] = [];

    for (const sample of SAMPLES) {
      const features = featuresByLevel.get(sample.id)!;
      const values = COVERAGE_LEVELS.map(lev => featureToArray(features.get(lev)!)[fi]!);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
      const cv = mean > 1e-10 ? std / mean : 0;
      cvs.push(cv);
    }

    selfVariances.set(FEATURE_NAMES[fi]!, cvs);
  }

  // Print table
  console.log(`${"Feature".padEnd(18)} ${"Mean CV".padStart(8)} ${"Min CV".padStart(8)} ${"Max CV".padStart(8)}  Stable?`);
  console.log("─".repeat(65));

  for (const [name, cvs] of selfVariances) {
    const mean = cvs.reduce((s, v) => s + v, 0) / cvs.length;
    const min = Math.min(...cvs);
    const max = Math.max(...cvs);
    const stable = mean < 0.15 ? "✓ STABLE" : mean < 0.30 ? "~ MODERATE" : "✗ UNSTABLE";
    console.log(`${name.padEnd(18)} ${mean.toFixed(4).padStart(8)} ${min.toFixed(4).padStart(8)} ${max.toFixed(4).padStart(8)}  ${stable}`);
  }

  // ── Phase 4: Cross-sample variance at 100% ──
  console.log("\n\n═══ CROSS-SAMPLE VARIANCE (at 100% coverage) ═══\n");
  console.log("How much does each feature vary BETWEEN individuals?\n");

  const fullFeatures = SAMPLES.map(s => featureToArray(featuresByLevel.get(s.id)!.get(1.0)!));

  console.log(`${"Feature".padEnd(18)} ${"Mean".padStart(10)} ${"Std".padStart(10)} ${"CV".padStart(8)}  ${"Range".padStart(12)}`);
  console.log("─".repeat(65));

  for (let fi = 0; fi < FEATURE_NAMES.length; fi++) {
    const values = fullFeatures.map(f => f[fi]!);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const cv = mean > 1e-10 ? std / mean : 0;
    const range = `${Math.min(...values).toFixed(1)}-${Math.max(...values).toFixed(1)}`;
    console.log(`${FEATURE_NAMES[fi]!.padEnd(18)} ${mean.toFixed(2).padStart(10)} ${std.toFixed(2).padStart(10)} ${cv.toFixed(4).padStart(8)}  ${range.padStart(12)}`);
  }

  // ── Phase 5: Signal-to-nuisance ratio ──
  console.log("\n\n═══ SIGNAL-TO-NUISANCE RATIO ═══\n");
  console.log("For each feature: cross-sample CV / mean self-perturbation CV\n");
  console.log("High ratio = feature varies MORE between samples than within.\n");

  console.log(`${"Feature".padEnd(18)} ${"Self CV".padStart(8)} ${"Cross CV".padStart(9)} ${"Ratio".padStart(8)}  Verdict`);
  console.log("─".repeat(65));

  for (let fi = 0; fi < FEATURE_NAMES.length; fi++) {
    const selfCVs = selfVariances.get(FEATURE_NAMES[fi]!)!;
    const meanSelfCV = selfCVs.reduce((s, v) => s + v, 0) / selfCVs.length;

    const values = fullFeatures.map(f => f[fi]!);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const crossCV = mean > 1e-10 ? std / mean : 0;

    const ratio = meanSelfCV > 1e-10 ? crossCV / meanSelfCV : Infinity;
    const verdict = ratio > 3 ? "✓ SIGNAL > NOISE" : ratio > 1 ? "~ MARGINAL" : "✗ NOISE > SIGNAL";

    console.log(`${FEATURE_NAMES[fi]!.padEnd(18)} ${meanSelfCV.toFixed(4).padStart(8)} ${crossCV.toFixed(4).padStart(9)} ${ratio.toFixed(2).padStart(8)}  ${verdict}`);
  }

  // ── Phase 6: Shuffle test ──
  console.log("\n\n═══ SHUFFLE TEST ═══\n");
  console.log("Does randomizing read order change features? (Tests ordering artifacts)\n");

  console.log(`${"Sample".padEnd(10)} ${"Feature".padEnd(18)} ${"Original".padStart(10)} ${"Shuffled".padStart(10)} ${"Change%".padStart(10)}`);
  console.log("─".repeat(65));

  for (const sample of SAMPLES) {
    const orig = featureToArray(featuresByLevel.get(sample.id)!.get(1.0)!);
    const shuf = featureToArray(featuresByLevel.get(sample.id)!.get(-1)!);

    for (let fi = 0; fi < Math.min(6, FEATURE_NAMES.length); fi++) { // First 6 features
      const o = orig[fi]!;
      const s = shuf[fi]!;
      const change = o > 1e-10 ? ((s - o) / o * 100) : 0;
      console.log(`${sample.id.padEnd(10)} ${FEATURE_NAMES[fi]!.padEnd(18)} ${o.toFixed(1).padStart(10)} ${s.toFixed(1).padStart(10)} ${change.toFixed(1).padStart(9)}%`);
    }
  }

  console.log("\n\n═══ CONCLUSION ═══\n");
  console.log("Features with ratio > 3 are candidates for kinship scoring.");
  console.log("Features with ratio < 1 are dominated by coverage noise.");
  console.log("The representation audit tells us WHAT to score, not HOW.\n");
}

main().catch(console.error);
