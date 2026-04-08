/**
 * Information-theoretic measures for comparing distributions.
 * Used by relatedness algorithms that treat k-mer frequency
 * profiles as probability distributions.
 */
export class InformationTheory {
  /** Shannon entropy: H(P) = -Σ p_i * log2(p_i) */
  static entropy(probs: readonly number[]): number {
    let h = 0;
    for (const p of probs) {
      if (p > 0) h -= p * Math.log2(p);
    }
    return h;
  }

  /** Shannon entropy from raw counts (normalizes internally) */
  static entropyFromCounts(counts: readonly number[]): number {
    let total = 0;
    for (const c of counts) total += c;
    if (total === 0) return 0;
    const probs = counts.map((c) => c / total);
    return InformationTheory.entropy(probs);
  }

  /**
   * KL divergence: D_KL(P || Q) = Σ p_i * log2(p_i / q_i)
   * Requires P and Q to have same length.
   * Uses Laplace smoothing to handle zeros in Q.
   */
  static klDivergence(p: readonly number[], q: readonly number[]): number {
    const epsilon = 1e-10;
    let kl = 0;
    for (let i = 0; i < p.length; i++) {
      const pi = p[i]!;
      const qi = (q[i] ?? 0) + epsilon;
      if (pi > 0) {
        kl += pi * Math.log2(pi / qi);
      }
    }
    return kl;
  }

  /**
   * Jensen-Shannon divergence: symmetric version of KL.
   * JSD(P, Q) = 0.5 * KL(P || M) + 0.5 * KL(Q || M) where M = (P+Q)/2
   * Returns value in [0, 1] (using log2).
   */
  static jsDivergence(p: readonly number[], q: readonly number[]): number {
    const m: number[] = new Array(p.length);
    for (let i = 0; i < p.length; i++) {
      m[i] = ((p[i] ?? 0) + (q[i] ?? 0)) / 2;
    }
    return 0.5 * InformationTheory.klDivergence(p, m) + 0.5 * InformationTheory.klDivergence(q, m);
  }

  /** JS divergence from count maps (normalizes and aligns internally) */
  static jsDivergenceFromMaps(
    countsA: ReadonlyMap<number, number>,
    countsB: ReadonlyMap<number, number>,
  ): number {
    const allKeys = new Set<number>();
    for (const k of countsA.keys()) allKeys.add(k);
    for (const k of countsB.keys()) allKeys.add(k);

    let totalA = 0, totalB = 0;
    for (const v of countsA.values()) totalA += v;
    for (const v of countsB.values()) totalB += v;
    if (totalA === 0 || totalB === 0) return 1;

    const p: number[] = [];
    const q: number[] = [];
    for (const k of allKeys) {
      p.push((countsA.get(k) ?? 0) / totalA);
      q.push((countsB.get(k) ?? 0) / totalB);
    }

    return InformationTheory.jsDivergence(p, q);
  }

  /**
   * Mutual information between two discrete variables.
   * I(X;Y) = Σ_x Σ_y p(x,y) * log2(p(x,y) / (p(x) * p(y)))
   */
  static mutualInformation(
    joint: ReadonlyMap<string, number>,
    marginalA: ReadonlyMap<string, number>,
    marginalB: ReadonlyMap<string, number>,
    total: number,
  ): number {
    if (total === 0) return 0;
    let mi = 0;
    for (const [key, count] of joint) {
      const pxy = count / total;
      const [a, b] = key.split(",");
      const px = (marginalA.get(a!) ?? 0) / total;
      const py = (marginalB.get(b!) ?? 0) / total;
      if (pxy > 0 && px > 0 && py > 0) {
        mi += pxy * Math.log2(pxy / (px * py));
      }
    }
    return mi;
  }

  /** Cosine similarity: dot(a,b) / (|a| * |b|) */
  static cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    let dot = 0, normA = 0, normB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) * (a[i] ?? 0);
      normB += (b[i] ?? 0) * (b[i] ?? 0);
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /** Cosine similarity from count maps (aligns keys internally) */
  static cosineSimilarityFromMaps(
    countsA: ReadonlyMap<number, number>,
    countsB: ReadonlyMap<number, number>,
  ): number {
    let dot = 0, normA = 0, normB = 0;
    for (const [k, va] of countsA) {
      normA += va * va;
      const vb = countsB.get(k);
      if (vb !== undefined) dot += va * vb;
    }
    for (const vb of countsB.values()) normB += vb * vb;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Normalized Compression Distance: NCD(x,y) = (C(xy) - min(C(x),C(y))) / max(C(x),C(y))
   * Lower NCD = more similar. Uses provided compress function.
   */
  static normalizedCompressionDistance(
    dataA: Uint8Array,
    dataB: Uint8Array,
    compress: (data: Uint8Array) => Uint8Array,
  ): number {
    const cA = compress(dataA).length;
    const cB = compress(dataB).length;
    const combined = new Uint8Array(dataA.length + dataB.length);
    combined.set(dataA, 0);
    combined.set(dataB, dataA.length);
    const cAB = compress(combined).length;
    const denom = Math.max(cA, cB);
    return denom > 0 ? (cAB - Math.min(cA, cB)) / denom : 0;
  }
}
