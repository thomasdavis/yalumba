import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { fastHash, canonicalHash } from "../hash-utils.js";

/** Score based on shared "cargo" — unique sequences adjacent to repeat contexts */
export const cargoTransferScore: Experiment = {
  name: "Cargo transfer score",
  version: 1,
  description: "SV ecology: shared unique sequences flanking repeat modules — mobile element cargo inheritance",
  maxReadsPerSample: 100_000,

  prepare(samples) {
    const k = 21;
    const cargoSets = new Map<string, Set<number>>();

    for (const s of samples) {
      const cargo = new Set<number>();
      for (const read of s.reads) {
        if (read.length < k * 3) continue;
        // Scan for repeat→unique transitions within reads
        // A "repeat" k-mer appears >1x in the read; the adjacent k-mer is "cargo"
        const readKmers = new Map<number, number>();
        for (let i = 0; i <= read.length - k; i++) {
          const h = fastHash(read, i, k);
          readKmers.set(h, (readKmers.get(h) ?? 0) + 1);
        }

        for (let i = 0; i < read.length - k * 2; i++) {
          const h1 = fastHash(read, i, k);
          const h2 = fastHash(read, i + k, k);
          const c1 = readKmers.get(h1) ?? 0;
          const c2 = readKmers.get(h2) ?? 0;
          // Repeat→unique transition = cargo
          if (c1 >= 2 && c2 === 1) {
            cargo.add(canonicalHash(read, i + k, k));
          }
          // Unique→repeat transition = cargo (other direction)
          if (c1 === 1 && c2 >= 2) {
            cargo.add(canonicalHash(read, i, k));
          }
        }
      }
      cargoSets.set(s.id, cargo);
    }

    return cargoSets;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const cargoSets = context as Map<string, Set<number>>;
    const cargoA = cargoSets.get(a.id)!;
    const cargoB = cargoSets.get(b.id)!;

    let shared = 0;
    for (const h of cargoA) { if (cargoB.has(h)) shared++; }
    const union = cargoA.size + cargoB.size - shared;
    const jaccard = union > 0 ? shared / union : 0;

    return {
      score: jaccard,
      detail: `shared=${shared.toLocaleString()} A=${cargoA.size.toLocaleString()} B=${cargoB.size.toLocaleString()}`,
    };
  },
};
