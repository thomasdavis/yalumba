/**
 * Algorithm Family 3: Module Clustering Stability
 *
 * Core question: Are modules REAL biological structures or sampling artifacts?
 *
 * Method: Bootstrap resampling of reads, rebuild modules each time,
 * measure which modules reconstruct consistently. True inheritance
 * subsystems should be stable under resampling because they're
 * backed by real genomic structure. Noise modules will fluctuate.
 *
 * Scoring: For each pair of individuals, compare their STABLE module
 * sets (modules that survive resampling). Related individuals should
 * share more stable modules because they inherited the same genomic
 * subsystems from common ancestors.
 *
 * This is genuinely symbiogenesis-native: the signal comes from
 * PERSISTENT SUBSYSTEM IDENTITY under perturbation, not sequence
 * continuity or token rarity.
 *
 * Addresses the critique: "module definition instability" — this
 * algorithm explicitly measures and exploits stability.
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import { buildModules } from "@yalumba/modules";
import type { Module } from "@yalumba/modules";

const NUM_BOOTSTRAPS = 5;
const SUBSAMPLE_FRACTION = 0.6; // Use 60% of reads per bootstrap
const STABILITY_THRESHOLD = 0.6; // Module must appear in >60% of bootstraps

interface StabilityProfile {
  /** Module fingerprints that appear in >60% of bootstrap iterations */
  stableModules: Set<number>;
  /** Module fingerprint → fraction of bootstraps where it appeared */
  moduleStability: Map<number, number>;
  /** Total unique modules across all bootstraps */
  totalModules: number;
  /** Number that pass stability threshold */
  stableCount: number;
}

interface PreparedContext {
  profiles: Map<string, StabilityProfile>;
  /** Stable modules shared across <all samples (informative) */
  informativeStable: Set<number>;
}

export const moduleStability: SymbioAlgorithm = {
  name: "Module clustering stability",
  version: 1,
  description: "Bootstrap module reconstruction — stable modules indicate real inheritance subsystems",
  family: "coalition-transfer",
  maxReadsPerSample: 30_000, // Lower because we run multiple bootstraps

  prepare(samples): PreparedContext {
    const t0 = performance.now();

    console.log(`    [stability] ${NUM_BOOTSTRAPS} bootstrap iterations, ${(SUBSAMPLE_FRACTION * 100).toFixed(0)}% subsample, threshold=${STABILITY_THRESHOLD}`);

    // ── Build stability profiles per sample ──
    const profiles = new Map<string, StabilityProfile>();

    for (const sample of samples) {
      const st = performance.now();
      console.log(`      ${sample.id}: bootstrapping...`);
      const profile = buildStabilityProfile(sample.reads);
      profiles.set(sample.id, profile);
      console.log(`        ${profile.stableCount} stable / ${profile.totalModules} total modules (${((performance.now() - st) / 1000).toFixed(1)}s)`);
    }

    // ── Find informative stable modules (not in all samples) ──
    const stablePresence = new Map<number, number>();
    for (const [, profile] of profiles) {
      for (const fp of profile.stableModules) {
        stablePresence.set(fp, (stablePresence.get(fp) ?? 0) + 1);
      }
    }

    const informativeStable = new Set<number>();
    for (const [fp, count] of stablePresence) {
      if (count < samples.length) {
        informativeStable.add(fp);
      }
    }

    const totalStable = new Set<number>();
    for (const [, p] of profiles) {
      for (const fp of p.stableModules) totalStable.add(fp);
    }

    console.log(`      Total unique stable modules: ${totalStable.size}`);
    console.log(`      Informative (not universal): ${informativeStable.size}`);
    console.log(`    [stability] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);

    return { profiles, informativeStable };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const profA = ctx.profiles.get(a.id)!;
    const profB = ctx.profiles.get(b.id)!;

    // ── Score 1: Informative stable module Jaccard ──
    let sharedStable = 0;
    let unionStable = 0;
    for (const fp of ctx.informativeStable) {
      const inA = profA.stableModules.has(fp);
      const inB = profB.stableModules.has(fp);
      if (inA && inB) sharedStable++;
      if (inA || inB) unionStable++;
    }
    const stableJaccard = unionStable > 0 ? sharedStable / unionStable : 0;

    // ── Score 2: Stability correlation ──
    // For shared stable modules, compare HOW stable they are in each sample
    let stabDot = 0, stabNormA = 0, stabNormB = 0;
    for (const fp of ctx.informativeStable) {
      const sa = profA.moduleStability.get(fp) ?? 0;
      const sb = profB.moduleStability.get(fp) ?? 0;
      stabDot += sa * sb;
      stabNormA += sa * sa;
      stabNormB += sb * sb;
    }
    const stabDenom = Math.sqrt(stabNormA) * Math.sqrt(stabNormB);
    const stabilityCosine = stabDenom > 0 ? stabDot / stabDenom : 0;

    // ── Score 3: Stable module count ratio ──
    // Related individuals should have similar numbers of stable modules
    const countRatio = Math.min(profA.stableCount, profB.stableCount) /
                       Math.max(profA.stableCount, profB.stableCount);

    // ── Combined score ──
    const score = stableJaccard * 0.45 + stabilityCosine * 0.35 + countRatio * 0.20;

    return {
      score,
      detail: `stableShared=${sharedStable}/${unionStable} (${(stableJaccard * 100).toFixed(1)}%) stabCos=${stabilityCosine.toFixed(4)} countRatio=${countRatio.toFixed(3)} stA=${profA.stableCount} stB=${profB.stableCount}`,
    };
  },
};

/** Build a stability profile by bootstrapping module extraction */
function buildStabilityProfile(reads: readonly string[]): StabilityProfile {
  const moduleAppearances = new Map<number, number>(); // fp → count of bootstraps where it appeared
  const allModuleFps = new Set<number>();

  for (let b = 0; b < NUM_BOOTSTRAPS; b++) {
    // Subsample reads (random 60%)
    const subsample = bootstrapSample(reads, SUBSAMPLE_FRACTION);

    // Build modules on this subsample
    const modules = buildModules(subsample, {
      motifK: 15,
      windowSize: 150,
      minSupport: 3,
      minCohesion: 0.25,
    });

    // Record which modules appeared in this bootstrap
    const bootstrapFps = new Set<number>();
    for (const mod of modules) {
      const fp = hashMembers(mod.members);
      bootstrapFps.add(fp);
      allModuleFps.add(fp);
    }

    for (const fp of bootstrapFps) {
      moduleAppearances.set(fp, (moduleAppearances.get(fp) ?? 0) + 1);
    }
  }

  // Compute stability scores
  const moduleStability = new Map<number, number>();
  const stableModules = new Set<number>();

  for (const [fp, appearances] of moduleAppearances) {
    const stability = appearances / NUM_BOOTSTRAPS;
    moduleStability.set(fp, stability);
    if (stability >= STABILITY_THRESHOLD) {
      stableModules.add(fp);
    }
  }

  return {
    stableModules,
    moduleStability,
    totalModules: allModuleFps.size,
    stableCount: stableModules.size,
  };
}

/** Random subsample of reads */
function bootstrapSample(reads: readonly string[], fraction: number): string[] {
  const n = Math.floor(reads.length * fraction);
  const indices = new Set<number>();
  while (indices.size < n) {
    indices.add(Math.floor(Math.random() * reads.length));
  }
  return [...indices].map((i) => reads[i]!);
}

function hashMembers(members: readonly number[]): number {
  const sorted = [...members].sort((a, b) => a - b);
  let h = 0x811c9dc5 | 0;
  for (const m of sorted) {
    h ^= m;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
