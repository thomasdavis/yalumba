import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/** Seed-extend + variant-aware scoring hybrid */
export const seedExtendHybrid: Experiment = {
  name: "Seed-extend + info scoring",
  version: 1,
  description: "Find overlapping reads via 30bp seed, score by mismatch rarity — hybrid approach",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const seedLen = 30;
    const minIdentity = 0.90;

    // Build seed index from A
    const index = new Map<string, number[]>();
    for (let i = 0; i < a.reads.length; i++) {
      const read = a.reads[i]!;
      if (read.length < seedLen + 10) continue;
      const seed = read.slice(10, 10 + seedLen);
      const existing = index.get(seed);
      if (existing) { if (existing.length < 5) existing.push(i); }
      else { index.set(seed, [i]); }
    }

    // For each matched pair, count matches outside the seed
    // Weight mismatches MORE (they're informative) and compute match excess
    let totalExcess = 0;
    let verified = 0;

    for (const readB of b.reads) {
      if (readB.length < seedLen + 10) continue;
      const seed = readB.slice(10, 10 + seedLen);
      const hits = index.get(seed);
      if (!hits) continue;

      for (const idx of hits) {
        const readA = a.reads[idx]!;
        const len = Math.min(readA.length, readB.length);
        let matches = 0;
        let total = 0;
        // Compare outside seed region
        for (let i = 0; i < 10; i++) {
          if (readA[i] === readB[i]) matches++;
          total++;
        }
        for (let i = 10 + seedLen; i < len; i++) {
          if (readA[i] === readB[i]) matches++;
          total++;
        }
        const identity = total > 0 ? matches / total : 0;
        if (identity >= minIdentity) {
          // Excess identity above baseline (0.993 is approx population baseline)
          totalExcess += Math.max(0, identity - 0.993);
          verified++;
        }
      }
    }

    const score = verified > 0 ? totalExcess / verified : 0;
    return {
      score,
      detail: `avgExcess=${(score * 100).toFixed(4)}% verified=${verified.toLocaleString()}`,
    };
  },
};
