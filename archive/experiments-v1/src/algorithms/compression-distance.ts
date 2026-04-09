import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/**
 * Normalized Compression Distance — shared ancestry means
 * higher compressibility when sequences are concatenated.
 */
export const compressionDistance: Experiment = {
  name: "Compression distance (NCD)",
  version: 1,
  description: "Gzip-based NCD of concatenated read sequences — lower NCD = more related",
  maxReadsPerSample: 50_000,

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const encoder = new TextEncoder();
    const seqA = a.reads.slice(0, 10_000).join("");
    const seqB = b.reads.slice(0, 10_000).join("");

    const dataA = encoder.encode(seqA);
    const dataB = encoder.encode(seqB);
    const combined = new Uint8Array(dataA.length + dataB.length);
    combined.set(dataA, 0);
    combined.set(dataB, dataA.length);

    const cA = Bun.gzipSync(dataA).length;
    const cB = Bun.gzipSync(dataB).length;
    const cAB = Bun.gzipSync(combined).length;

    const ncd = (cAB - Math.min(cA, cB)) / Math.max(cA, cB);
    // Invert: lower NCD = more related → higher score
    const score = 1 - ncd;

    return {
      score,
      detail: `NCD=${ncd.toFixed(6)} C(A)=${cA} C(B)=${cB} C(AB)=${cAB}`,
    };
  },
};
