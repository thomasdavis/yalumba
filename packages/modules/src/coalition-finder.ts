/**
 * Find coalitions — specific combinations of modules that
 * are inherited together as a unit.
 *
 * A coalition is a set of modules that appear in the same reads.
 * Related individuals share coalitions because they inherited
 * the same haplotype blocks containing those module combinations.
 */

import type { Module, Coalition, ModuleGraph } from "./types.js";
import { extractMotifsWithPositions } from "./motif-extractor.js";

/**
 * Discover coalitions from reads and known modules.
 * A coalition = a set of module IDs that co-occur in the same reads.
 */
export function findCoalitions(
  reads: readonly string[],
  modules: readonly Module[],
  motifK: number = 15,
  minFrequency: number = 3,
): Coalition[] {
  // Build motif → module lookup
  const motifToModule = new Map<number, number>();
  for (const mod of modules) {
    for (const member of mod.members) {
      motifToModule.set(member, mod.id);
    }
  }

  // For each read, determine which modules are present
  const coalitionCounts = new Map<number, { ids: number[]; count: number; intact: number }>();

  for (const read of reads) {
    const motifs = extractMotifsWithPositions(read, motifK);
    const presentModules = new Set<number>();

    for (const m of motifs) {
      const moduleId = motifToModule.get(m.hash);
      if (moduleId !== undefined) presentModules.add(moduleId);
    }

    if (presentModules.size < 2) continue;

    // Coalition fingerprint = sorted module IDs hashed
    const sorted = [...presentModules].sort((a, b) => a - b);
    const fingerprint = hashCoalition(sorted);

    const existing = coalitionCounts.get(fingerprint);
    if (existing) {
      existing.count++;
      // Check integrity: are ALL members of the coalition present?
      const allPresent = existing.ids.every((id) => presentModules.has(id));
      if (allPresent) existing.intact++;
    } else {
      coalitionCounts.set(fingerprint, {
        ids: sorted,
        count: 1,
        intact: 1,
      });
    }
  }

  // Filter by minimum frequency
  const coalitions: Coalition[] = [];
  for (const [fingerprint, data] of coalitionCounts) {
    if (data.count < minFrequency) continue;
    coalitions.push({
      moduleIds: data.ids,
      fingerprint,
      frequency: data.count,
      integrityRate: data.count > 0 ? data.intact / data.count : 0,
    });
  }

  return coalitions.sort((a, b) => b.frequency - a.frequency);
}

function hashCoalition(ids: number[]): number {
  let h = 0x811c9dc5 | 0;
  for (const id of ids) {
    h ^= id;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
