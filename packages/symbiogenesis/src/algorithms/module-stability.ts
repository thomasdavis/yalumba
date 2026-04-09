/**
 * Algorithm Family 3: Module Clustering Stability
 *
 * Core question: Are modules REAL biological structures or sampling artifacts?
 *
 * Method: Bootstrap resampling of reads, rebuild modules each time,
 * measure which MOTIFS consistently appear in stable modules.
 * Related individuals share the same genomic subsystems, so the
 * same motifs should be stably organized into modules.
 *
 * Key insight (v2): Module fingerprints (exact member sets) are too
 * brittle — they almost never match across samples because module
 * boundary detection is noisy. Instead, track MOTIF-LEVEL stability:
 * for each motif, measure how often it appears in ANY module across
 * bootstrap iterations. Related individuals will have correlated
 * motif stability profiles because they inherited the same genomic
 * subsystems.
 *
 * v2 changes:
 * - Track per-motif stability instead of per-module fingerprints
 * - Drop countRatio (coverage proxy, not genetics proxy)
 * - Lower stability threshold for more signal
 * - More bootstraps for reliability
 * - Use stability-weighted motif Jaccard + cosine similarity
 *
 * This is genuinely symbiogenesis-native: the signal comes from
 * PERSISTENT SUBSYSTEM IDENTITY under perturbation, not sequence
 * continuity or token rarity.
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import { buildModules } from "@yalumba/modules";

const NUM_BOOTSTRAPS = 8;
const SUBSAMPLE_FRACTION = 0.6;
const STABILITY_THRESHOLD = 0.4; // Motif must be in a module in >40% of bootstraps

interface MotifStabilityProfile {
  /** Motif hash → fraction of bootstraps where it appeared in ANY module */
  motifStability: Map<number, number>;
  /** Motifs that pass the stability threshold */
  stableMotifs: Set<number>;
  /** Total unique motifs seen in modules across all bootstraps */
  totalMotifs: number;
  /** Fraction of motifs that are stable (for diagnostics) */
  stableFraction: number;
}

interface PreparedContext {
  profiles: Map<string, MotifStabilityProfile>;
  /** All motifs that are stable in at least one sample but not all */
  informativeMotifs: Set<number>;
  /** All motifs that are stable in at least one sample */
  allStableMotifs: Set<number>;
}

export const moduleStability: SymbioAlgorithm = {
  name: "Module clustering stability",
  version: 2,
  description: "Bootstrap module reconstruction — motif-level stability profiles reveal shared inheritance",
  family: "coalition-transfer",
  maxReadsPerSample: 30_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();

    console.log(`    [stability-v2] ${NUM_BOOTSTRAPS} bootstraps, ${(SUBSAMPLE_FRACTION * 100).toFixed(0)}% subsample, motif threshold=${STABILITY_THRESHOLD}`);

    // ── Build motif stability profiles per sample ──
    const profiles = new Map<string, MotifStabilityProfile>();

    for (const sample of samples) {
      const st = performance.now();
      console.log(`      ${sample.id}: bootstrapping...`);
      const profile = buildMotifStabilityProfile(sample.reads);
      profiles.set(sample.id, profile);
      console.log(`        ${profile.stableMotifs.size} stable motifs / ${profile.totalMotifs} total (${(profile.stableFraction * 100).toFixed(1)}% stable) (${((performance.now() - st) / 1000).toFixed(1)}s)`);
    }

    // ── Find informative stable motifs ──
    // A motif is "informative" if it is stable in at least one sample
    // but NOT stable in all samples (universal motifs don't distinguish)
    const stablePresence = new Map<number, number>();
    for (const [, profile] of profiles) {
      for (const motif of profile.stableMotifs) {
        stablePresence.set(motif, (stablePresence.get(motif) ?? 0) + 1);
      }
    }

    const allStableMotifs = new Set<number>();
    const informativeMotifs = new Set<number>();
    for (const [motif, count] of stablePresence) {
      allStableMotifs.add(motif);
      if (count < samples.length) {
        informativeMotifs.add(motif);
      }
    }

    console.log(`      Total unique stable motifs: ${allStableMotifs.size}`);
    console.log(`      Informative (not universal): ${informativeMotifs.size}`);
    console.log(`    [stability-v2] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);

    return { profiles, informativeMotifs, allStableMotifs };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const profA = ctx.profiles.get(a.id)!;
    const profB = ctx.profiles.get(b.id)!;

    // ── Score 1: Informative stable motif Jaccard ──
    // How many informative motifs are stably modular in BOTH samples?
    let sharedStable = 0;
    let unionStable = 0;
    for (const motif of ctx.informativeMotifs) {
      const inA = profA.stableMotifs.has(motif);
      const inB = profB.stableMotifs.has(motif);
      if (inA && inB) sharedStable++;
      if (inA || inB) unionStable++;
    }
    const motifJaccard = unionStable > 0 ? sharedStable / unionStable : 0;

    // ── Score 2: Stability cosine similarity ──
    // Compare HOW stable each motif is across the two samples.
    // Uses ALL informative motifs (not just those passing threshold),
    // since partial stability values carry signal.
    let dot = 0, normA = 0, normB = 0;
    for (const motif of ctx.informativeMotifs) {
      const sa = profA.motifStability.get(motif) ?? 0;
      const sb = profB.motifStability.get(motif) ?? 0;
      dot += sa * sb;
      normA += sa * sa;
      normB += sb * sb;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const stabCosine = denom > 0 ? dot / denom : 0;

    // ── Combined score ──
    // Jaccard captures shared module membership;
    // Cosine captures correlated stability patterns
    const score = motifJaccard * 0.55 + stabCosine * 0.45;

    return {
      score,
      detail: `motifJacc=${sharedStable}/${unionStable} (${(motifJaccard * 100).toFixed(1)}%) stabCos=${stabCosine.toFixed(4)} stableA=${profA.stableMotifs.size} stableB=${profB.stableMotifs.size}`,
    };
  },
};

/** Build a motif-level stability profile by bootstrapping */
function buildMotifStabilityProfile(reads: readonly string[]): MotifStabilityProfile {
  // Track: motif hash → how many bootstraps it appeared in a module
  const motifAppearances = new Map<number, number>();
  const allMotifs = new Set<number>();

  for (let b = 0; b < NUM_BOOTSTRAPS; b++) {
    const subsample = bootstrapSample(reads, SUBSAMPLE_FRACTION);

    const modules = buildModules(subsample, {
      motifK: 15,
      windowSize: 150,
      minSupport: 3,
      minCohesion: 0.25,
    });

    // Collect all unique motifs that appeared in ANY module this bootstrap
    const bootstrapMotifs = new Set<number>();
    for (const mod of modules) {
      for (const member of mod.members) {
        bootstrapMotifs.add(member);
        allMotifs.add(member);
      }
    }

    for (const motif of bootstrapMotifs) {
      motifAppearances.set(motif, (motifAppearances.get(motif) ?? 0) + 1);
    }
  }

  // Compute stability scores per motif
  const motifStability = new Map<number, number>();
  const stableMotifs = new Set<number>();

  for (const [motif, appearances] of motifAppearances) {
    const stability = appearances / NUM_BOOTSTRAPS;
    motifStability.set(motif, stability);
    if (stability >= STABILITY_THRESHOLD) {
      stableMotifs.add(motif);
    }
  }

  const totalMotifs = allMotifs.size;
  const stableFraction = totalMotifs > 0 ? stableMotifs.size / totalMotifs : 0;

  return {
    motifStability,
    stableMotifs,
    totalMotifs,
    stableFraction,
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
