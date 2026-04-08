import type { Experiment, SampleData, ExperimentScore } from "../types.js";
import { canonicalHash } from "../hash-utils.js";

/**
 * Symbiogenesis-inspired: SEGMENT COOPERATION model.
 *
 * Instead of comparing k-mers in isolation, measure whether
 * k-mer PAIRS co-occur at consistent distances in both genomes.
 *
 * If two k-mers appear N bases apart in person A AND also N bases
 * apart in person B, those segments "cooperate" — they were likely
 * inherited together from a common ancestor.
 *
 * This captures structural similarity beyond mere k-mer presence.
 */
export const segmentCooperation: Experiment = {
  name: "Segment cooperation",
  description: "Symbiogenesis: co-occurring k-mer pairs at consistent spacing — structural co-inheritance",
  maxReadsPerSample: 200_000,

  prepare(samples) {
    const cooccurrences = new Map<string, Set<number>>();
    for (const s of samples) {
      cooccurrences.set(s.id, buildCooccurrenceSet(s.reads, 15, 50));
    }
    return cooccurrences;
  },

  compare(a: SampleData, b: SampleData, context?: unknown): ExperimentScore {
    const cosets = context as Map<string, Set<number>>;
    const setA = cosets.get(a.id)!;
    const setB = cosets.get(b.id)!;

    let shared = 0;
    for (const h of setA) { if (setB.has(h)) shared++; }
    const union = setA.size + setB.size - shared;
    const jaccard = union > 0 ? shared / union : 0;

    return {
      score: jaccard,
      detail: `shared=${shared.toLocaleString()} A=${setA.size.toLocaleString()} B=${setB.size.toLocaleString()}`,
    };
  },
};

/**
 * Build set of co-occurrence fingerprints.
 * For each read, hash pairs of k-mers at different offsets.
 * The fingerprint encodes: (kmer1_hash, kmer2_hash, distance).
 */
function buildCooccurrenceSet(
  reads: readonly string[], k: number, maxDist: number,
): Set<number> {
  const coset = new Set<number>();
  const step = 10; // Check every 10bp for pairs

  for (const read of reads) {
    if (read.length < k * 2 + step) continue;
    for (let i = 0; i <= read.length - k; i += step) {
      const h1 = canonicalHash(read, i, k);
      for (let j = i + k; j <= Math.min(i + maxDist, read.length - k); j += step) {
        const h2 = canonicalHash(read, j, k);
        const dist = j - i;
        // Combine into co-occurrence fingerprint
        const fp = ((h1 * 31 + h2) * 31 + dist) >>> 0;
        coset.add(fp);
      }
    }
  }
  return coset;
}
