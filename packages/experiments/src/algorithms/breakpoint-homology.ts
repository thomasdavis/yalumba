import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash, isLowComplexity } from "../hash-utils.js";

/** Compare breakpoint homology patterns — shared SV breakpoints indicate ancestry */
export const breakpointHomology: Experiment = {
  name: "Breakpoint homology proxy",
  version: 1,
  description: "SV ecology: shared patterns of run-break-run at consistent gap lengths — SV breakpoint inheritance",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    const sampleSets = new Map<string, Set<number>>();
    for (const s of samples) {
      const kset = new Set<number>();
      for (const read of s.reads) {
        for (let i = 0; i <= read.length - k; i++) {
          if (isLowComplexity(read, i, k)) continue;
          kset.add(canonicalHash(read, i, k));
        }
      }
      sampleSets.set(s.id, kset);
    }
    return sampleSets;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const sampleSets = context as Map<string, Set<number>>;
    const k = 21;
    const setB = sampleSets.get(b.id)!;

    // Detect breakpoint signatures: run → gap(1-5) → run patterns
    // Hash the (pre-gap-kmer, gap-length, post-gap-kmer) tuple
    const breakpoints = new Map<number, number>(); // breakpoint hash → count

    for (const read of a.reads) {
      let runLen = 0;
      let gapStart = -1;

      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        const shared = setB.has(h);

        if (shared) {
          if (gapStart >= 0 && runLen >= 3) {
            // We had: run → gap → now resuming run
            const gapLen = i - gapStart;
            if (gapLen >= 1 && gapLen <= 10) {
              // Hash the breakpoint pattern
              const preGap = canonicalHash(read, gapStart - 1, k);
              const bpHash = ((preGap * 31 + gapLen) * 31 + h) >>> 0;
              breakpoints.set(bpHash, (breakpoints.get(bpHash) ?? 0) + 1);
            }
            gapStart = -1;
          }
          runLen++;
        } else {
          if (runLen >= 3 && gapStart < 0) {
            gapStart = i;
          }
          if (gapStart >= 0 && i - gapStart > 10) {
            gapStart = -1; // Gap too long, reset
          }
          runLen = 0;
        }
      }
    }

    // Now compare: how many of A's breakpoints also appear in B?
    // Re-scan B for the same breakpoint patterns
    const setA = sampleSets.get(a.id)!;
    const bpB = new Set<number>();

    for (const read of b.reads) {
      let runLen = 0;
      let gapStart = -1;

      for (let i = 0; i <= read.length - k; i++) {
        if (isLowComplexity(read, i, k)) continue;
        const h = canonicalHash(read, i, k);
        const shared = setA.has(h);

        if (shared) {
          if (gapStart >= 0 && runLen >= 3) {
            const gapLen = i - gapStart;
            if (gapLen >= 1 && gapLen <= 10) {
              const preGap = canonicalHash(read, gapStart - 1, k);
              const bpHash = ((preGap * 31 + gapLen) * 31 + h) >>> 0;
              bpB.add(bpHash);
            }
            gapStart = -1;
          }
          runLen++;
        } else {
          if (runLen >= 3 && gapStart < 0) gapStart = i;
          if (gapStart >= 0 && i - gapStart > 10) gapStart = -1;
          runLen = 0;
        }
      }
    }

    // Jaccard of breakpoint patterns
    let shared = 0;
    for (const bp of breakpoints.keys()) { if (bpB.has(bp)) shared++; }
    const union = breakpoints.size + bpB.size - shared;
    const jaccard = union > 0 ? shared / union : 0;

    return {
      score: jaccard,
      detail: `shared=${shared.toLocaleString()} A=${breakpoints.size.toLocaleString()} B=${bpB.size.toLocaleString()}`,
    };
  },
};
