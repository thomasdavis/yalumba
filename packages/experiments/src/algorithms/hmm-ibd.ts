import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/**
 * Two-state HMM for IBD segment detection.
 * States: IBD (shared ancestry) and non-IBD.
 * Observations: match/mismatch at overlapping k-mer positions.
 * Uses forward algorithm to compute total IBD probability.
 */
export const hmmIbd: Experiment = {
  name: "HMM-IBD (2-state)",
  description: "Hidden Markov Model with IBD/non-IBD states over anchor-matched positions",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    // Build observations from anchor-matched reads
    const anchorLen = 40;
    const trim = 10;
    const observations = buildObservations(a.reads, b.reads, anchorLen, trim);

    if (observations.length < 100) {
      return { score: 0, detail: `only ${observations.length} observations` };
    }

    // HMM parameters
    const transIBD_IBD = 0.95;     // Stay in IBD
    const transIBD_nonIBD = 0.05;  // Leave IBD
    const transNon_IBD = 0.02;     // Enter IBD
    const transNon_non = 0.98;     // Stay non-IBD

    // Emission: P(match | IBD) is high, P(match | non-IBD) is lower
    const emitMatch_IBD = 0.995;    // IBD → almost all matches (only seq error)
    const emitMatch_nonIBD = 0.993; // non-IBD → slightly more mismatches
    const emitMismatch_IBD = 1 - emitMatch_IBD;
    const emitMismatch_nonIBD = 1 - emitMatch_nonIBD;

    // Forward algorithm
    const prior_IBD = 0.25; // 50% for parent-child, use 25% as prior
    let fwd_IBD = Math.log(prior_IBD);
    let fwd_non = Math.log(1 - prior_IBD);

    let ibdPositions = 0;

    for (const obs of observations) {
      const emit_IBD = obs ? Math.log(emitMatch_IBD) : Math.log(emitMismatch_IBD);
      const emit_non = obs ? Math.log(emitMatch_nonIBD) : Math.log(emitMismatch_nonIBD);

      const new_IBD = logAdd(
        fwd_IBD + Math.log(transIBD_IBD),
        fwd_non + Math.log(transNon_IBD),
      ) + emit_IBD;

      const new_non = logAdd(
        fwd_IBD + Math.log(transIBD_nonIBD),
        fwd_non + Math.log(transNon_non),
      ) + emit_non;

      fwd_IBD = new_IBD;
      fwd_non = new_non;

      // Track posterior
      const total = logAdd(fwd_IBD, fwd_non);
      if (fwd_IBD - total > Math.log(0.5)) ibdPositions++;
    }

    const ibdFraction = ibdPositions / observations.length;
    return {
      score: ibdFraction,
      detail: `${ibdPositions}/${observations.length} IBD positions (${(ibdFraction * 100).toFixed(2)}%)`,
    };
  },
};

function buildObservations(
  readsA: readonly string[], readsB: readonly string[],
  anchorLen: number, trim: number,
): boolean[] {
  const index = new Map<string, number[]>();
  for (let i = 0; i < readsA.length; i++) {
    const read = readsA[i]!;
    if (read.length < anchorLen + trim * 2) continue;
    const key = read.slice(trim, trim + anchorLen);
    const existing = index.get(key);
    if (existing) { if (existing.length < 2) existing.push(i); }
    else { index.set(key, [i]); }
  }

  const obs: boolean[] = [];
  for (const readB of readsB) {
    if (readB.length < anchorLen + trim * 2) continue;
    const key = readB.slice(trim, trim + anchorLen);
    const hits = index.get(key);
    if (!hits) continue;
    for (const idx of hits) {
      const readA = readsA[idx]!;
      const start = trim + anchorLen;
      const end = Math.min(readA.length, readB.length) - trim;
      for (let i = start; i < end; i++) {
        obs.push(readA[i] === readB[i]);
      }
    }
  }
  return obs;
}

function logAdd(a: number, b: number): number {
  if (a > b) return a + Math.log1p(Math.exp(b - a));
  return b + Math.log1p(Math.exp(a - b));
}
