import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

export const runProfileNcd: Experiment = {
  name: "Run profile NCD",
  version: 1,
  description: "Symbiogenesis: compression ratio of binary shared/unshared patterns — structured sharing = compressible",
  maxReadsPerSample: 50_000,
  compare(a: SampleData, b: SampleData): ExperimentScore {
    const k = 21;
    const setB = new Set<number>();
    for (const read of b.reads) {
      for (let i = 0; i <= read.length - k; i++) setB.add(canonicalHash(read, i, k));
    }
    let totalRatio = 0;
    let readCount = 0;
    const encoder = new TextEncoder();
    for (const read of a.reads) {
      if (read.length < k) continue;
      const bits: string[] = [];
      for (let i = 0; i <= read.length - k; i++) {
        bits.push(setB.has(canonicalHash(read, i, k)) ? "1" : "0");
      }
      const raw = encoder.encode(bits.join(""));
      const compressed = Bun.gzipSync(raw);
      totalRatio += compressed.length / raw.length;
      readCount++;
    }
    // Lower compression ratio = more structured = more related
    // Invert so higher = more related
    const avgRatio = readCount > 0 ? totalRatio / readCount : 1;
    const score = 1 - avgRatio;
    return { score, detail: `avgCompRatio=${avgRatio.toFixed(4)} reads=${readCount}` };
  },
};
