import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/** v1 baseline: exact 60bp prefix anchor, compare remaining bases */
export const anchorOverlap: Experiment = {
  name: "Anchor overlap (60bp)",
  description: "Index reads by 60bp prefix (trim 10bp ends), compare identity of remaining bases",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const anchorLen = 60;
    const trim = 10;
    const index = new Map<string, number[]>();

    for (let i = 0; i < a.reads.length; i++) {
      const read = a.reads[i]!;
      if (read.length < anchorLen + trim * 2) continue;
      const key = read.slice(trim, trim + anchorLen);
      const existing = index.get(key);
      if (existing) { if (existing.length < 3) existing.push(i); }
      else { index.set(key, [i]); }
    }

    let overlaps = 0, matches = 0, mismatches = 0;
    for (const readB of b.reads) {
      if (readB.length < anchorLen + trim * 2) continue;
      const key = readB.slice(trim, trim + anchorLen);
      const hits = index.get(key);
      if (!hits) continue;
      for (const idx of hits) {
        const readA = a.reads[idx]!;
        overlaps++;
        const start = trim + anchorLen;
        const end = Math.min(readA.length, readB.length) - trim;
        for (let i = start; i < end; i++) {
          if (readA[i] === readB[i]) matches++; else mismatches++;
        }
      }
    }

    const total = matches + mismatches;
    const identity = total > 0 ? matches / total : 0;
    return {
      score: identity,
      detail: `${overlaps.toLocaleString()} overlaps, ${(identity * 100).toFixed(3)}% identity`,
    };
  },
};
