/**
 * Algorithm Family 2: Coalition Transfer (v2)
 *
 * Core idea: measure how often COMBINATIONS of modules are inherited
 * together as a unit. Related individuals share not just modules but
 * specific COALITIONS — sets of modules that co-occur in reads.
 *
 * v2 changes:
 *   - Drop integrityCosine (was always 1.0 — not discriminative)
 *   - Primary signal: IDF-weighted rarity score (best separation)
 *   - Secondary signal: coalition frequency correlation (shared coalitions
 *     should have correlated read counts in related individuals)
 *   - Tertiary signal: exclusive coalition ratio (fraction of informative
 *     coalitions that are ONLY shared between these two samples)
 *
 * This is genuinely symbiogenesis-native: the signal comes from
 * COMPOSITE INHERITANCE UNITS, not individual markers.
 */

import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";
import { buildModules, buildModuleGraph } from "@yalumba/modules";
import type { Module } from "@yalumba/modules";

interface CoalitionProfile {
  /** Coalition fingerprint → frequency (read count) in this sample */
  coalitions: Map<number, number>;
  /** Total reads analyzed */
  readCount: number;
}

interface PreparedContext {
  sharedModules: Module[];
  motifToModule: Map<number, number>;
  profiles: Map<string, CoalitionProfile>;
  /** Coalitions present in fewer than all samples */
  informativeCoalitions: Set<number>;
  /** Coalition fingerprint → how many samples contain it */
  coalitionPresence: Map<number, number>;
  numSamples: number;
}

export const coalitionTransfer: SymbioAlgorithm = {
  name: "Coalition transfer",
  version: 2,
  description: "Rarity-focused coalition scoring with frequency correlation — composite inheritance units",
  family: "coalition-transfer",
  maxReadsPerSample: 50_000,

  prepare(samples): PreparedContext {
    const t0 = performance.now();

    // ── Step 1: Build shared module vocabulary with LARGER windows ──
    console.log("    [coalition] Step 1: Build modules (window=150bp)...");
    const allModules: Module[] = [];
    const fpToId = new Map<number, number>();
    let nextId = 0;

    for (const sample of samples) {
      const st = performance.now();
      const modules = buildModules(sample.reads, {
        motifK: 15,
        windowSize: 150,   // 3x larger than v1 — better haplotype coverage
        minSupport: 5,     // higher support threshold for stability
        minCohesion: 0.25, // slightly lower cohesion to find larger modules
      });

      for (const mod of modules) {
        const fp = hashMembers(mod.members);
        if (!fpToId.has(fp)) {
          fpToId.set(fp, nextId);
          allModules.push({ ...mod, id: nextId++ });
        }
      }
      console.log(`      ${sample.id}: ${modules.length} modules (${((performance.now() - st) / 1000).toFixed(1)}s)`);
    }
    console.log(`      Shared vocabulary: ${allModules.length} unique modules`);

    // ── Step 2: Build motif → module lookup ──
    const motifToModule = new Map<number, number>();
    for (const mod of allModules) {
      for (const member of mod.members) {
        motifToModule.set(member, mod.id);
      }
    }

    // ── Step 3: Build coalition profiles per sample ──
    console.log("    [coalition] Step 2: Build coalition profiles...");
    const profiles = new Map<string, CoalitionProfile>();

    for (const sample of samples) {
      const st = performance.now();
      const profile = buildCoalitionProfile(sample.reads, motifToModule, 15);
      profiles.set(sample.id, profile);
      console.log(`      ${sample.id}: ${profile.coalitions.size} unique coalitions (${((performance.now() - st) / 1000).toFixed(1)}s)`);
    }

    // ── Step 4: Identify informative coalitions ──
    console.log("    [coalition] Step 3: Filter informative coalitions...");
    const coalitionPresence = new Map<number, number>();
    for (const [, profile] of profiles) {
      for (const fp of profile.coalitions.keys()) {
        coalitionPresence.set(fp, (coalitionPresence.get(fp) ?? 0) + 1);
      }
    }

    const informativeCoalitions = new Set<number>();
    for (const [fp, count] of coalitionPresence) {
      if (count < samples.length) {
        informativeCoalitions.add(fp);
      }
    }
    console.log(`      ${informativeCoalitions.size} informative coalitions (of ${coalitionPresence.size} total)`);
    console.log(`    [coalition] Total prep: ${((performance.now() - t0) / 1000).toFixed(1)}s`);

    return {
      sharedModules: allModules,
      motifToModule,
      profiles,
      informativeCoalitions,
      coalitionPresence,
      numSamples: samples.length,
    };
  },

  compare(a: SampleReads, b: SampleReads, context: unknown): ComparisonScore {
    const ctx = context as PreparedContext;
    const profA = ctx.profiles.get(a.id)!;
    const profB = ctx.profiles.get(b.id)!;

    // ── Score 1: Rarity-weighted coalition overlap (IDF) ──
    // Coalitions in fewer samples get exponentially higher weight
    let weightedShared = 0;
    let weightedTotal = 0;
    for (const fp of ctx.informativeCoalitions) {
      const presence = ctx.coalitionPresence.get(fp) ?? ctx.numSamples;
      const weight = Math.log2(ctx.numSamples / presence);
      const inA = profA.coalitions.has(fp);
      const inB = profB.coalitions.has(fp);
      if (inA || inB) {
        weightedTotal += weight;
        if (inA && inB) weightedShared += weight;
      }
    }
    const rarityScore = weightedTotal > 0 ? weightedShared / weightedTotal : 0;

    // ── Score 2: Exclusive pair coalition ratio ──
    // Coalitions shared by ONLY these two samples (presence == 2, both have it)
    // These are the strongest signal of shared inheritance
    let exclusiveShared = 0;
    let totalPairRelevant = 0;
    for (const fp of ctx.informativeCoalitions) {
      const presence = ctx.coalitionPresence.get(fp) ?? ctx.numSamples;
      const inA = profA.coalitions.has(fp);
      const inB = profB.coalitions.has(fp);
      if (inA || inB) {
        totalPairRelevant++;
        if (inA && inB && presence === 2) {
          exclusiveShared++;
        }
      }
    }
    const exclusiveRatio = totalPairRelevant > 0
      ? exclusiveShared / totalPairRelevant
      : 0;

    // ── Score 3: Coalition frequency correlation ──
    // For shared informative coalitions, how correlated are their read counts?
    // Related individuals should have similar coalition frequency profiles.
    const sharedFps: number[] = [];
    for (const fp of ctx.informativeCoalitions) {
      if (profA.coalitions.has(fp) && profB.coalitions.has(fp)) {
        sharedFps.push(fp);
      }
    }

    let freqCorr = 0;
    if (sharedFps.length >= 3) {
      // Normalize frequencies to proportions within each sample
      const totalA = sharedFps.reduce((s, fp) => s + (profA.coalitions.get(fp) ?? 0), 0);
      const totalB = sharedFps.reduce((s, fp) => s + (profB.coalitions.get(fp) ?? 0), 0);

      if (totalA > 0 && totalB > 0) {
        let dot = 0, normA = 0, normB = 0;
        for (const fp of sharedFps) {
          const fa = (profA.coalitions.get(fp) ?? 0) / totalA;
          const fb = (profB.coalitions.get(fp) ?? 0) / totalB;
          dot += fa * fb;
          normA += fa * fa;
          normB += fb * fb;
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        freqCorr = denom > 0 ? dot / denom : 0;
      }
    }

    // ── Combined score ──
    // Best combo: rarity + exclusive + frequency, balanced
    const score = rarityScore * 0.40 + exclusiveRatio * 0.40 + freqCorr * 0.20;

    return {
      score,
      detail: `rarity=${(rarityScore * 100).toFixed(1)}% excl=${exclusiveShared}/${totalPairRelevant} (${(exclusiveRatio * 100).toFixed(2)}%) freqCorr=${freqCorr.toFixed(4)} shared=${sharedFps.length}`,
    };
  },
};

/** Build coalition profile from reads */
function buildCoalitionProfile(
  reads: readonly string[],
  motifToModule: Map<number, number>,
  k: number,
): CoalitionProfile {
  const coalitionCounts = new Map<number, number>();

  for (const read of reads) {
    // Find all modules present in this read
    const presentModules = new Set<number>();
    for (let i = 0; i <= read.length - k; i++) {
      const h = canonicalHash(read, i, k);
      const modId = motifToModule.get(h);
      if (modId !== undefined) presentModules.add(modId);
    }

    if (presentModules.size < 2) continue;

    // Coalition = sorted set of module IDs → fingerprint
    const sorted = [...presentModules].sort((a, b) => a - b);
    const fp = hashCoalition(sorted);

    coalitionCounts.set(fp, (coalitionCounts.get(fp) ?? 0) + 1);
  }

  return {
    coalitions: coalitionCounts,
    readCount: reads.length,
  };
}

function hashCoalition(ids: number[]): number {
  let h = 0x811c9dc5 | 0;
  for (const id of ids) {
    h ^= id;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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

function canonicalHash(seq: string, offset: number, k: number): number {
  let fwd = 0x811c9dc5 | 0;
  for (let i = offset; i < offset + k; i++) {
    fwd ^= seq.charCodeAt(i);
    fwd = Math.imul(fwd, 0x01000193);
  }
  fwd = fwd >>> 0;
  let rev = 0x811c9dc5 | 0;
  for (let i = offset + k - 1; i >= offset; i--) {
    const c = seq.charCodeAt(i);
    const comp = c === 65 ? 84 : c === 84 ? 65 : c === 67 ? 71 : c === 71 ? 67 : c;
    rev ^= comp;
    rev = Math.imul(rev, 0x01000193);
  }
  rev = rev >>> 0;
  return fwd < rev ? fwd : rev;
}
