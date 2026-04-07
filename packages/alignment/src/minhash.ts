import { KmerExtractor } from "@yalumba/kmer";

const DEFAULT_NUM_HASHES = 128;

/**
 * MinHash signatures for approximate Jaccard similarity.
 * Much faster than exact Jaccard for large sequences.
 */
export class MinHash {
  private readonly numHashes: number;
  private readonly extractor: KmerExtractor;
  private readonly hashSeeds: bigint[];

  constructor(k: number = 21, numHashes: number = DEFAULT_NUM_HASHES) {
    this.numHashes = numHashes;
    this.extractor = new KmerExtractor({ k, canonical: true });
    this.hashSeeds = Array.from({ length: numHashes }, (_, i) => BigInt(i * 1000003 + 1));
  }

  /** Generate a MinHash signature for a sequence */
  signature(sequence: string): BigInt64Array {
    const sig = new BigInt64Array(this.numHashes);
    sig.fill(BigInt(Number.MAX_SAFE_INTEGER));

    for (const kmer of this.extractor.iterate(sequence)) {
      for (let i = 0; i < this.numHashes; i++) {
        const h = mixHash(kmer.hash, this.hashSeeds[i]!);
        if (h < sig[i]!) {
          sig[i] = h;
        }
      }
    }

    return sig;
  }

  /** Estimate Jaccard similarity from two MinHash signatures */
  estimateSimilarity(sigA: BigInt64Array, sigB: BigInt64Array): number {
    let matches = 0;
    for (let i = 0; i < this.numHashes; i++) {
      if (sigA[i] === sigB[i]) matches++;
    }
    return matches / this.numHashes;
  }
}

function mixHash(value: bigint, seed: bigint): bigint {
  let h = value ^ seed;
  h = (h ^ (h >> 33n)) * 0xff51afd7ed558ccdn;
  h = (h ^ (h >> 33n)) * 0xc4ceb9fe1a85ec53n;
  h = h ^ (h >> 33n);
  return h & 0x7fffffffffffffffn;
}
