/**
 * Algorithm Family 1: Module Persistence Graph (v3)
 *
 * Key fix from v1: build a SHARED module vocabulary across all samples,
 * then map each sample's reads to that vocabulary. This ensures the same
 * biological module gets the same ID across all samples.
 *
 * v3 changes from v2:
 *   - Removed edgeJaccard (86-89% for ALL pairs — not discriminative)
 *   - Primary signal: informative module Jaccard (modules not in all samples)
 *   - Added rarity-weighted overlap: shared modules weighted by inverse
 *     sample frequency (rare shared modules = stronger relatedness signal)
 *   - Support cosine retained but reweighted
 *
 * Compare samples by:
 *   1. Informative module overlap (Jaccard) — ancestry signal
 *   2. Rarity-weighted module overlap — rare shared modules score higher
 *   3. Module support correlation (cosine similarity)
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import { buildModules } from "@yalumba/modules";
import type { Module } from "@yalumba/modules";

interface PreparedContext {
  /** Shared module vocabulary (union across all samples) */
  sharedModules: Module[];
  /** Per-sample: which shared modules are present + their local support */
  samplePresence: Map<string, Map<number, number>>;
  /** Modules present in fewer than all samples (informative) */
  informativeModuleIds: Set<number>;
  /** How many samples each module appears in (for rarity weighting) */
  modulePresenceCount: Map<number, number>;
  /** Total number of samples */
  sampleCount: number;
}

export const modulePersistence: SymbioAlgorithm = {
  name: "Module persistence graph",
  version: 3,
  description: "Rarity-weighted informative module overlap — rare shared modules carry strongest ancestry signal",
  family: "module-persistence",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();

    // ── Step 1: Build modules per sample ──
    console.log("    [v3] Step 1: Extract modules per sample...");
    const perSampleModules = new Map<string, Module[]>();

    for (const sample of samples) {
      const st = performance.now();
      const modules = buildModules(sample.reads, {
        motifK: 15,
        windowSize: 50,
        minSupport: 3,
        minCohesion: 0.3,
      });
      perSampleModules.set(sample.id, modules);
      console.log(`      ${sample.id}: ${modules.length} modules (${((performance.now() - st) / 1000).toFixed(1)}s)`);
    }

    // ── Step 2: Build shared module vocabulary ──
    // Union all modules, deduplicate by member fingerprint
    console.log("    [v3] Step 2: Building shared module vocabulary...");
    const fpToModule = new Map<number, Module>();
    let sharedId = 0;

    for (const [, modules] of perSampleModules) {
      for (const mod of modules) {
        const fp = moduleFingerprint(mod.members);
        if (!fpToModule.has(fp)) {
          fpToModule.set(fp, { ...mod, id: sharedId++ });
        }
      }
    }

    const sharedModules = [...fpToModule.values()];
    console.log(`      ${sharedModules.length} unique modules in shared vocabulary`);

    // ── Step 3: Map each sample to shared vocabulary ──
    console.log("    [v3] Step 3: Mapping samples to shared vocabulary...");
    const samplePresence = new Map<string, Map<number, number>>();

    for (const [sampleId, modules] of perSampleModules) {
      const presence = new Map<number, number>();
      for (const mod of modules) {
        const fp = moduleFingerprint(mod.members);
        const sharedMod = fpToModule.get(fp);
        if (sharedMod) {
          presence.set(sharedMod.id, mod.support);
        }
      }
      samplePresence.set(sampleId, presence);
      console.log(`      ${sampleId}: ${presence.size} shared modules present`);
    }

    // ── Step 4: Identify informative modules (not universal) ──
    const modulePresenceCount = new Map<number, number>();
    for (const [, presence] of samplePresence) {
      for (const modId of presence.keys()) {
        modulePresenceCount.set(modId, (modulePresenceCount.get(modId) ?? 0) + 1);
      }
    }

    const informativeModuleIds = new Set<number>();
    for (const [modId, count] of modulePresenceCount) {
      // Informative = not in ALL samples (like rare k-mers)
      if (count < samples.length) {
        informativeModuleIds.add(modId);
      }
    }
    console.log(`      ${informativeModuleIds.size} informative modules (of ${sharedModules.length} total)`);

    console.log(`    [v3] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { sharedModules, samplePresence, informativeModuleIds, modulePresenceCount, sampleCount: samples.length };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const presA = ctx.samplePresence.get(a.id)!;
    const presB = ctx.samplePresence.get(b.id)!;

    // ── Score 1: Informative module overlap (Jaccard) ──
    let sharedInformative = 0;
    let unionInformative = 0;
    for (const modId of ctx.informativeModuleIds) {
      const inA = presA.has(modId);
      const inB = presB.has(modId);
      if (inA && inB) sharedInformative++;
      if (inA || inB) unionInformative++;
    }
    const infoJaccard = unionInformative > 0 ? sharedInformative / unionInformative : 0;

    // ── Score 2: Rarity-weighted overlap ──
    // Shared modules weighted by log(N / count) — rarer modules score higher
    let rarityNumer = 0;
    let rarityDenom = 0;
    for (const modId of ctx.informativeModuleIds) {
      const inA = presA.has(modId);
      const inB = presB.has(modId);
      const count = ctx.modulePresenceCount.get(modId) ?? ctx.sampleCount;
      const weight = Math.log(ctx.sampleCount / count);
      if (inA && inB) rarityNumer += weight;
      if (inA || inB) rarityDenom += weight;
    }
    const rarityJaccard = rarityDenom > 0 ? rarityNumer / rarityDenom : 0;

    // ── Score 3: Module support correlation (informative only) ──
    let dot = 0, normA = 0, normB = 0;
    for (const modId of ctx.informativeModuleIds) {
      const va = presA.get(modId) ?? 0;
      const vb = presB.get(modId) ?? 0;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const supportCosine = denom > 0 ? dot / denom : 0;

    // Rarity + cosine (no Jaccard — it has overlap between groups)
    const score = rarityJaccard * 0.55 + supportCosine * 0.45;

    return {
      score,
      detail: `infoMod=${sharedInformative}/${unionInformative} (${(infoJaccard * 100).toFixed(1)}%) rarity=${(rarityJaccard * 100).toFixed(1)}% cosine=${supportCosine.toFixed(4)}`,
    };
  },
};

function moduleFingerprint(members: readonly number[]): number {
  const sorted = [...members].sort((a, b) => a - b);
  let h = 0x811c9dc5 | 0;
  for (const m of sorted) {
    h ^= m;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
