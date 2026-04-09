import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/** Seed-and-extend scored by overlap rate (not identity) — detects mother-son */
export const seedExtendOverlapRate: Experiment = {
  name: "Seed-extend overlap rate",
  version: 1,
  description: "30bp seed match, verify full-read identity >95%, score by verified overlap count per read",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const seedLen = 30;
    const minIdentity = 0.95;

    const index = new Map<string, number[]>();
    for (let i = 0; i < a.reads.length; i++) {
      const read = a.reads[i]!;
      if (read.length < seedLen + 10) continue;
      const seed = read.slice(10, 10 + seedLen);
      const existing = index.get(seed);
      if (existing) { if (existing.length < 5) existing.push(i); }
      else { index.set(seed, [i]); }
    }

    let candidates = 0;
    let verified = 0;

    for (const readB of b.reads) {
      if (readB.length < seedLen + 10) continue;
      const seed = readB.slice(10, 10 + seedLen);
      const hits = index.get(seed);
      if (!hits) continue;
      for (const idx of hits) {
        candidates++;
        const readA = a.reads[idx]!;
        const len = Math.min(readA.length, readB.length);
        let matches = 0;
        for (let i = 0; i < len; i++) {
          if (readA[i] === readB[i]) matches++;
        }
        if (matches / len >= minIdentity) verified++;
      }
    }

    const rate = verified / Math.min(a.reads.length, b.reads.length);
    return {
      score: rate,
      detail: `${verified.toLocaleString()} verified / ${candidates.toLocaleString()} candidates (${(rate * 100).toFixed(4)}%)`,
    };
  },
};
