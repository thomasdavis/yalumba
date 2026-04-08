import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/** Simply count reads sharing a 50bp anchor — ratio as relatedness proxy */
export const overlapCountRatio: Experiment = {
  name: "Overlap count ratio",
  version: 1,
  description: "Count reads sharing a 50bp anchor (offset 10bp) — ratio of shared to total reads",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const anchorLen = 50;
    const offset = 10;

    const index = new Set<string>();
    for (const read of a.reads) {
      if (read.length >= anchorLen + offset) {
        index.add(read.slice(offset, offset + anchorLen));
      }
    }

    let overlaps = 0;
    for (const read of b.reads) {
      if (read.length >= anchorLen + offset && index.has(read.slice(offset, offset + anchorLen))) {
        overlaps++;
      }
    }

    const rate = overlaps / Math.min(a.reads.length, b.reads.length);
    return {
      score: rate,
      detail: `${overlaps.toLocaleString()} overlaps (${(rate * 100).toFixed(4)}%)`,
    };
  },
};
