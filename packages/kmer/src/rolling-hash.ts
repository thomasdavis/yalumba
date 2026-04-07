const BASE_PRIME = 31n;
const MODULUS = (1n << 61n) - 1n;

/**
 * Rolling polynomial hash for k-mer strings.
 * Uses a Rabin-Karp style hash with a Mersenne prime modulus.
 */
export class RollingHash {
  private readonly k: number;
  private readonly highPower: bigint;

  constructor(k: number) {
    this.k = k;
    this.highPower = modPow(BASE_PRIME, BigInt(k - 1), MODULUS);
  }

  /** Compute the hash of a k-mer string */
  hash(kmer: string): bigint {
    let h = 0n;
    for (let i = 0; i < kmer.length; i++) {
      h = modMul(h, BASE_PRIME, MODULUS);
      h = modAdd(h, BigInt(kmer.charCodeAt(i)), MODULUS);
    }
    return h;
  }

  /** Update hash by removing the leftmost character and adding a new right character */
  roll(prevHash: bigint, removedChar: string, addedChar: string): bigint {
    let h = prevHash;
    h = modSub(h, modMul(BigInt(removedChar.charCodeAt(0)), this.highPower, MODULUS), MODULUS);
    h = modMul(h, BASE_PRIME, MODULUS);
    h = modAdd(h, BigInt(addedChar.charCodeAt(0)), MODULUS);
    return h;
  }
}

function modAdd(a: bigint, b: bigint, m: bigint): bigint {
  return (a + b) % m;
}

function modSub(a: bigint, b: bigint, m: bigint): bigint {
  return ((a - b) % m + m) % m;
}

function modMul(a: bigint, b: bigint, m: bigint): bigint {
  return (a * b) % m;
}

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let result = 1n;
  base = base % m;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = modMul(result, base, m);
    }
    exp = exp >> 1n;
    base = modMul(base, base, m);
  }
  return result;
}
