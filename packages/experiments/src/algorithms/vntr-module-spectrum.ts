import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { fastHash } from "../hash-utils.js";

/** Compare VNTR-like repeat module abundance spectra between samples */
export const vntrModuleSpectrum: Experiment = {
  name: "VNTR module spectrum",
  version: 1,
  description: "SV ecology: cosine similarity of within-read repeat module abundance — VNTR signatures",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 15; // Shorter k for repeat detection
    const spectra = new Map<string, Map<number, number>>();

    for (const s of samples) {
      const spectrum = new Map<number, number>();
      for (const read of s.reads) {
        // Find k-mers that appear >1 time within this read (repeat modules)
        const readKmers = new Map<number, number>();
        for (let i = 0; i <= read.length - k; i++) {
          const h = fastHash(read, i, k);
          readKmers.set(h, (readKmers.get(h) ?? 0) + 1);
        }
        // Only count k-mers seen multiple times (tandem-repeat-like)
        for (const [kmer, count] of readKmers) {
          if (count >= 2) {
            spectrum.set(kmer, (spectrum.get(kmer) ?? 0) + count);
          }
        }
      }
      spectra.set(s.id, spectrum);
    }

    return spectra;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const spectra = context as Map<string, Map<number, number>>;
    const spA = spectra.get(a.id)!;
    const spB = spectra.get(b.id)!;

    // Cosine similarity of repeat module spectra
    let dot = 0, normA = 0, normB = 0;
    for (const [kmer, va] of spA) {
      normA += va * va;
      const vb = spB.get(kmer);
      if (vb !== undefined) dot += va * vb;
    }
    for (const vb of spB.values()) normB += vb * vb;

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const cosine = denom > 0 ? dot / denom : 0;

    return {
      score: cosine,
      detail: `cosine=${cosine.toFixed(6)} modulesA=${spA.size.toLocaleString()} modulesB=${spB.size.toLocaleString()}`,
    };
  },
};
