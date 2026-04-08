import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { fastHash } from "../hash-utils.js";

/**
 * Symbiogenesis-inspired: GENOME MODULARITY comparison.
 *
 * Instead of treating reads as linear sequences, cluster them
 * into "modules" by sequence similarity (using short anchors).
 * Then compare the module structure between two genomes.
 *
 * Like comparing two ecosystems by their species community structure
 * rather than individual organism counts.
 *
 * Modules that appear in both genomes at similar frequencies
 * suggest shared genomic architecture from common ancestry.
 */
export const genomeModularity: Experiment = {
  name: "Genome modularity",
  version: 1,
  description: "Symbiogenesis: cluster reads into modules, compare module frequency distributions",
  maxReadsPerSample: 500_000,

  prepare(samples) {
    const moduleProfiles = new Map<string, Map<number, number>>();
    for (const s of samples) {
      moduleProfiles.set(s.id, buildModuleProfile(s.reads, 25));
    }
    return moduleProfiles;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const profiles = context as Map<string, Map<number, number>>;
    const modA = profiles.get(a.id)!;
    const modB = profiles.get(b.id)!;

    // Bray-Curtis on module frequency profiles
    let totalA = 0, totalB = 0, sharedMin = 0;
    for (const c of modA.values()) totalA += c;
    for (const c of modB.values()) totalB += c;

    for (const [mod, countA] of modA) {
      const countB = modB.get(mod);
      if (countB !== undefined) {
        sharedMin += Math.min(countA, countB);
      }
    }

    const brayCurtis = 1 - (2 * sharedMin) / (totalA + totalB);
    const similarity = 1 - brayCurtis;

    // Module overlap stats
    let sharedModules = 0;
    for (const k of modA.keys()) { if (modB.has(k)) sharedModules++; }
    const totalModules = new Set([...modA.keys(), ...modB.keys()]).size;

    return {
      score: similarity,
      detail: `BC=${brayCurtis.toFixed(6)} modules=${sharedModules}/${totalModules} A=${modA.size} B=${modB.size}`,
    };
  },
};

/**
 * Assign each read to a "module" based on its content.
 * Module = hash of the read's central 25bp region.
 * Count how many reads belong to each module.
 */
function buildModuleProfile(reads: readonly string[], moduleLen: number): Map<number, number> {
  const profile = new Map<number, number>();
  for (const read of reads) {
    if (read.length < moduleLen) continue;
    // Use the central region as the module identifier
    const center = Math.floor((read.length - moduleLen) / 2);
    const moduleHash = fastHash(read, center, moduleLen);
    profile.set(moduleHash, (profile.get(moduleHash) ?? 0) + 1);
  }
  return profile;
}
