import type { Experiment, SampleData, ExperimentScore } from "../types.js";

function anchorIdentity(
  readsA: readonly string[], readsB: readonly string[],
  anchorLen: number, trim: number,
): { identity: number; overlaps: number } {
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
  return { identity: total > 0 ? matches / total : 0, overlaps };
}

/** Anchor overlap normalized by self-similarity — removes batch effects */
export const normalizedAnchorOverlap: Experiment = {
  name: "Normalized anchor overlap",
  description: "Cross-sample identity / self-similarity baseline — controls for sequencing batch effects",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const anchorLen = 60;
    const trim = 10;
    const cross = anchorIdentity(a.reads, b.reads, anchorLen, trim);

    const halfA1 = a.reads.slice(0, Math.floor(a.reads.length / 2));
    const halfA2 = a.reads.slice(Math.floor(a.reads.length / 2));
    const selfA = anchorIdentity(halfA1, halfA2, anchorLen, trim);

    const halfB1 = b.reads.slice(0, Math.floor(b.reads.length / 2));
    const halfB2 = b.reads.slice(Math.floor(b.reads.length / 2));
    const selfB = anchorIdentity(halfB1, halfB2, anchorLen, trim);

    const avgSelf = (selfA.identity + selfB.identity) / 2;
    const normalized = avgSelf > 0 ? cross.identity / avgSelf : 0;

    return {
      score: normalized,
      detail: `raw=${(cross.identity * 100).toFixed(3)}% selfA=${(selfA.identity * 100).toFixed(3)}% selfB=${(selfB.identity * 100).toFixed(3)}% norm=${normalized.toFixed(6)}`,
    };
  },
};
