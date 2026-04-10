/**
 * Algorithm Family 3: Module Clustering Stability (v3)
 *
 * Core question: Are modules REAL biological structures or artifacts?
 *
 * Method: Bootstrap resampling of reads, rebuild modules each time,
 * measure which MOTIFS consistently appear in modules. Related
 * individuals share the same genomic subsystems, so the same motifs
 * should be stably organized into modules.
 *
 * v3 insight: Use stability as a CONTINUOUS WEIGHT, not a binary
 * filter. The generalized Jaccard sum(min(stab_A, stab_B) * rarity)
 * / sum(max(stab_A, stab_B) * rarity) naturally suppresses noise
 * (unstable motifs contribute less) while preserving signal.
 *
 * Combined with rarity weighting (log(N/count)), motifs that are
 * stable in both samples AND rare provide the strongest signal.
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import { buildModules } from "@yalumba/modules";

const NUM_BOOTSTRAPS = 8;
const SUBSAMPLE_FRACTION = 0.7;

interface MotifStabilityProfile {
  /** Motif hash → fraction of bootstraps where it appeared in ANY module */
  motifStability: Map<number, number>;
  /** Motif hash → cumulative module support across all bootstraps */
  motifSupport: Map<number, number>;
}

interface PreparedContext {
  profiles: Map<string, MotifStabilityProfile>;
  /** All motifs seen in modules across any sample */
  allModuleMotifs: Set<number>;
  /** Motif → number of samples where stability > 0.25 */
  motifPresenceCount: Map<number, number>;
  sampleCount: number;
}

export const moduleStability: SymbioAlgorithm = {
  name: "Module clustering stability",
  version: 4,
  description: "Continuous stability-weighted rarity Jaccard — soft bootstrap filtering for genetic signal",
  family: "coalition-transfer",
  maxReadsPerSample: 30_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();
    console.log(`    [stability-v3] ${NUM_BOOTSTRAPS} bootstraps, ${(SUBSAMPLE_FRACTION * 100).toFixed(0)}% subsample`);

    const profiles = new Map<string, MotifStabilityProfile>();

    for (const sample of samples) {
      const st = performance.now();
      console.log(`      ${sample.id}: bootstrapping...`);
      const profile = buildMotifStabilityProfile(sample.reads);
      profiles.set(sample.id, profile);
      const stableCount = [...profile.motifStability.values()].filter(s => s >= 0.5).length;
      console.log(`        ${stableCount} stable motifs / ${profile.motifStability.size} total (${((performance.now() - st) / 1000).toFixed(1)}s)`);
    }

    // ── Collect all module motifs and their population frequency ──
    // A motif "counts" in a sample if it has stability > 0.25
    const motifPresenceCount = new Map<number, number>();
    const allModuleMotifs = new Set<number>();
    for (const [, profile] of profiles) {
      for (const [motif, stability] of profile.motifStability) {
        allModuleMotifs.add(motif);
        if (stability > 0.25) {
          motifPresenceCount.set(motif, (motifPresenceCount.get(motif) ?? 0) + 1);
        }
      }
    }

    // Keep only informative motifs (not in all samples)
    const informative = new Set<number>();
    for (const [motif, count] of motifPresenceCount) {
      if (count < samples.length) informative.add(motif);
    }

    console.log(`      ${allModuleMotifs.size} total module motifs, ${informative.size} informative`);
    console.log(`    [stability-v3] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);

    return { profiles, allModuleMotifs: informative, motifPresenceCount, sampleCount: samples.length };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const profA = ctx.profiles.get(a.id)!;
    const profB = ctx.profiles.get(b.id)!;

    // ── Score 1: Generalized rarity-weighted Jaccard ──
    // sum(min(stab_A, stab_B) * rarity) / sum(max(stab_A, stab_B) * rarity)
    // Stability acts as continuous weight: unstable motifs contribute less
    let minSum = 0;
    let maxSum = 0;
    for (const motif of ctx.allModuleMotifs) {
      const count = ctx.motifPresenceCount.get(motif) ?? ctx.sampleCount;
      const rarity = Math.log(ctx.sampleCount / count);
      const sa = profA.motifStability.get(motif) ?? 0;
      const sb = profB.motifStability.get(motif) ?? 0;
      minSum += Math.min(sa, sb) * rarity;
      maxSum += Math.max(sa, sb) * rarity;
    }
    const genJaccard = maxSum > 0 ? minSum / maxSum : 0;

    // ── Score 2: Rarity-weighted stability product ──
    // For each informative motif, score = stability_A * stability_B * rarity
    // This rewards motifs that are both stable AND rare AND shared
    let prodScore = 0;
    let prodMax = 0;
    for (const motif of ctx.allModuleMotifs) {
      const count = ctx.motifPresenceCount.get(motif) ?? ctx.sampleCount;
      const rarity = Math.log(ctx.sampleCount / count);
      const sa = profA.motifStability.get(motif) ?? 0;
      const sb = profB.motifStability.get(motif) ?? 0;
      prodScore += sa * sb * rarity;
      prodMax += Math.max(sa, sb) * Math.max(sa, sb) * rarity;
    }
    const prodRatio = prodMax > 0 ? prodScore / prodMax : 0;

    // Mirror Module Persistence: rarity Jaccard + product ratio
    const score = genJaccard * 0.55 + prodRatio * 0.45;

    return {
      score,
      detail: `genJacc=${(genJaccard * 100).toFixed(1)}% prodRatio=${(prodRatio * 100).toFixed(2)}%`,
    };
  },
};

/** Build a motif-level stability profile by bootstrapping */
function buildMotifStabilityProfile(reads: readonly string[]): MotifStabilityProfile {
  const motifAppearances = new Map<number, number>();
  const motifSupportAccum = new Map<number, number>();

  for (let b = 0; b < NUM_BOOTSTRAPS; b++) {
    const subsample = bootstrapSample(reads, SUBSAMPLE_FRACTION);
    const modules = buildModules(subsample, {
      motifK: 15,
      windowSize: 150,
      minSupport: 3,
      minCohesion: 0.25,
    });

    const bootstrapMotifSupport = new Map<number, number>();
    for (const mod of modules) {
      for (const member of mod.members) {
        const prev = bootstrapMotifSupport.get(member) ?? 0;
        if (mod.support > prev) {
          bootstrapMotifSupport.set(member, mod.support);
        }
      }
    }

    for (const [motif, support] of bootstrapMotifSupport) {
      motifAppearances.set(motif, (motifAppearances.get(motif) ?? 0) + 1);
      motifSupportAccum.set(motif, (motifSupportAccum.get(motif) ?? 0) + support);
    }
  }

  const motifStability = new Map<number, number>();
  const motifSupport = new Map<number, number>();

  for (const [motif, appearances] of motifAppearances) {
    motifStability.set(motif, appearances / NUM_BOOTSTRAPS);
    motifSupport.set(motif, motifSupportAccum.get(motif) ?? 0);
  }

  return { motifStability, motifSupport };
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
