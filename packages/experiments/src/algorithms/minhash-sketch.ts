import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

const SKETCH_SIZE = 5000;
const K = 21;

/** Bottom-sketch MinHash — keep S smallest k-mer hashes */
export const minhashSketch: Experiment = {
  name: "MinHash bottom-sketch (k=21)",
  version: 1,
  description: `Keep ${SKETCH_SIZE} smallest canonical 21-mer hashes, compare sketch overlap`,
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const sketches = new Map<string, Set<number>>();
    for (const sample of samples) {
      sketches.set(sample.id, buildSketch(sample.reads, K, SKETCH_SIZE));
    }
    return sketches;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const sketches = context as Map<string, Set<number>>;
    const sketchA = sketches.get(a.id)!;
    const sketchB = sketches.get(b.id)!;

    let shared = 0;
    for (const h of sketchA) { if (sketchB.has(h)) shared++; }
    const union = new Set([...sketchA, ...sketchB]).size;
    const sim = union > 0 ? shared / union : 0;

    return { score: sim, detail: `shared=${shared} sketch=${SKETCH_SIZE}` };
  },
};

function buildSketch(reads: readonly string[], k: number, size: number): Set<number> {
  const sketch = new Set<number>();
  const arr: number[] = [];
  let maxVal = 0;

  for (const read of reads) {
    for (let i = 0; i <= read.length - k; i++) {
      const h = canonicalHash(read, i, k);
      if (sketch.has(h)) continue;
      if (arr.length < size) {
        sketch.add(h); arr.push(h);
        if (h > maxVal) maxVal = h;
      } else if (h < maxVal) {
        const maxIdx = arr.indexOf(maxVal);
        sketch.delete(maxVal);
        arr[maxIdx] = h;
        sketch.add(h);
        maxVal = 0;
        for (const v of arr) { if (v > maxVal) maxVal = v; }
      }
    }
  }
  return sketch;
}
