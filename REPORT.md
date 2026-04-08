# yalumba — Relatedness Detection Algorithm Report

> 21 algorithms benchmarked on real genomic data. Symbiogenesis-inspired
> recombination distance produces 83x stronger signal than any classical approach.

---

## Dataset

**GIAB Ashkenazi Trio** — Genome in a Bottle project, 300x whole-genome sequencing.

| Sample | Role | Reads | Read length |
|--------|------|-------|-------------|
| HG003 | Father | 2,000,000 | 148bp |
| HG004 | Mother | 2,000,000 | 148bp |
| HG002 | Son | 2,000,000 | 148bp |

**Pedigree:** HG003 (father) + HG004 (mother) → HG002 (son)

**Challenge:** Father and son were sequenced on the same flowcell. Mother was sequenced in a different batch. Algorithms must detect both parent-child relationships despite sequencing batch effects.

**Pairs tested:**

| Pair | Relationship | Expected |
|------|-------------|----------|
| HG003 ↔ HG004 | Unrelated spouses | Baseline (lowest) |
| HG003 ↔ HG002 | Father ↔ Son | ~50% IBD |
| HG004 ↔ HG002 | Mother ↔ Son | ~50% IBD |

---

## Leaderboard

**Separation** = avg(related scores) - avg(unrelated scores). Higher is better.
**Mother gap** = mother-son score - unrelated score. Must be positive.

| # | Algorithm | Time | Separation | Mother gap | Father | Mother | Category |
|---|-----------|------|-----------|------------|--------|--------|----------|
| **1** | **Recombination distance** | **37.5s** | **+88.586%** | **+32.802%** | **yes** | **yes** | **Symbiogenesis** |
| 2 | K-mer spectrum cosine (k=21) | 27.0s | +1.073% | +1.232% | yes | yes | Distribution |
| 3 | K-mer Morisita-Horn index | 47.3s | +0.989% | +1.184% | yes | yes | Symbiogenesis |
| 4 | Normalized anchor overlap | 18.5s | +0.802% | +1.010% | yes | yes | Position-based |
| 5 | Jensen-Shannon divergence (k=21) | 55.5s | +0.630% | +0.294% | yes | yes | Info theory |
| 6 | Anchor overlap (60bp) | 9.0s | +0.619% | +0.031% | yes | yes | Position-based |
| 7 | Seed-extend overlap rate | 13.9s | +0.618% | +0.202% | yes | yes | Position-based |
| 8 | K-mer ecosystem (Bray-Curtis) | 25.2s | +0.540% | +0.303% | yes | yes | Symbiogenesis |
| 9 | Overlap count ratio | 8.7s | +0.315% | +0.127% | yes | yes | Position-based |
| 10 | Genome modularity | 1.7s | +0.140% | +0.060% | yes | yes | Symbiogenesis |
| 11 | Segment cooperation | 15.2s | +0.125% | +0.033% | yes | yes | Symbiogenesis |
| 12 | MinHash bottom-sketch (k=21) | 12.8s | +0.089% | +0.136% | yes | yes | Sketch |
| 13 | K-mer entropy similarity (k=21) | 22.8s | +0.076% | +0.011% | yes | yes | Info theory |
| 14 | Containment index (k=21) | 23.6s | +0.065% | +0.009% | yes | yes | Set-based |
| 15 | Shared unique reads | 8.9s | +0.061% | +0.012% | yes | yes | Exact match |
| 16 | K-mer Jaccard (k=21) | 45.8s | +0.034% | +0.005% | yes | yes | Set-based |
| 17 | K-mer graph similarity (k=21) | 18.7s | +0.028% | +0.018% | yes | yes | Graph |
| 18 | Compression distance (NCD) | 1.5s | +0.007% | +0.003% | yes | yes | Algorithmic |
| 19 | Multi-anchor overlap (40bp x3) | 38.7s | +0.482% | -0.177% | yes | no | Position-based |
| 20 | Mutual information (k=21) | 34.3s | -0.344% | -0.121% | no | no | Info theory |
| 21 | HMM-IBD (2-state) | 11.1s | +0.000% | +0.000% | no | no | Classical |

**18/21** detect father-son. **18/21** detect both parent-child pairs.

---

## Key findings

### 1. Recombination distance dominates

The symbiogenesis-inspired recombination distance algorithm produces **88.6% separation** — 83x stronger than the next best algorithm (k-mer spectrum cosine at 1.07%). It also detects mother-son with a **32.8% gap**, compared to 1.2% for cosine.

The algorithm measures the average length of consecutive shared k-mer runs between two samples. Related individuals share long inherited haplotype segments, producing long runs of matching k-mers. Unrelated individuals share only short, scattered random matches.

This directly approximates IBD (Identity By Descent) segment detection without reference alignment, phasing, or genotype calling.

### 2. Symbiogenesis framing produces the strongest algorithms

Five symbiogenesis-inspired algorithms were implemented. All five detect both parent-child pairs. Three rank in the top 11:

| Algorithm | Rank | Insight |
|-----------|------|---------|
| Recombination distance | #1 | Fewer evolutionary breakpoints = closer relationship |
| K-mer Morisita-Horn | #3 | Ecological diversity index for k-mer communities |
| K-mer ecosystem (Bray-Curtis) | #8 | Genome as ecosystem, compare species abundance |
| Genome modularity | #10 | Cluster reads into modules, compare community structure |
| Segment cooperation | #11 | Co-occurring k-mer pairs at consistent spacing |

The core idea — treating the genome as an **ecosystem of interacting elements** rather than a flat string — produces algorithms that capture structural similarity beyond what set intersection or identity scores can measure.

### 3. Distribution-based methods beat position-based methods

Algorithms that compare **frequency distributions** of k-mers consistently outperform those that compare **individual positions**:

| Category | Best separation | Best mother gap |
|----------|----------------|----------------|
| Symbiogenesis | +88.586% | +32.802% |
| Distribution (cosine, JSD) | +1.073% | +1.232% |
| Position-based (anchor overlap) | +0.802% | +1.010% |
| Set-based (Jaccard) | +0.065% | +0.009% |

Distribution methods are inherently more robust to batch effects because they aggregate over all k-mers rather than depending on specific read positions matching.

### 4. Normalization is essential for cross-batch detection

Raw anchor overlap barely detects mother-son (+0.031% gap). Normalizing by self-similarity baseline increases this to +1.010%. The batch effect where father and son share a flowcell inflates their raw overlap, masking the mother-son signal. Self-similarity normalization corrects for this.

### 5. Read length determines feasibility

The 1000 Genomes CEPH trio (36bp reads, Illumina GA-I circa 2008) produced **no usable signal** with any algorithm. The GIAB data (148bp reads) works with 18 out of 21 algorithms. Longer reads provide more k-mers per read, more unique anchors, and more sequence for comparison after anchoring.

### 6. Two algorithms fail completely

**Mutual information (k=21)** produces negative separation — it scores unrelated pairs higher than related pairs. The MI computation on k-mer presence/absence captures set size correlation (batch effect) rather than genetic similarity.

**HMM-IBD (2-state)** produces zero signal. The emission probability gap between IBD (99.5% match) and non-IBD (99.3% match) is too narrow for the forward algorithm to distinguish states given sequencing error noise. The emission parameters need calibration against training data.

---

## Algorithm descriptions

### Recombination distance (Symbiogenesis)

For each read in sample A, scan its k-mers against sample B's k-mer set. Count consecutive matching k-mers (runs). The average run length is the score. Longer runs indicate larger inherited segments with fewer recombination breakpoints.

- k=21, canonical k-mers
- 100,000 reads per sample (subsampled for memory)
- Score: average consecutive shared k-mer run length
- Father-son: avg run 4.58, Mother-son: avg run 3.42, Unrelated: avg run 2.09

### K-mer spectrum cosine

Build k-mer frequency vectors for each sample. Compute cosine similarity (angle between vectors). Unlike Pearson correlation, cosine similarity is robust to outliers and naturally normalized by vector magnitude.

- k=21, canonical k-mers, 100,000 reads
- Father-son: 0.910, Mother-son: 0.913, Unrelated: 0.901

### K-mer Morisita-Horn index (Symbiogenesis)

Ecological diversity index designed for comparing species abundance distributions. Applied to k-mer frequencies, it measures abundance-weighted overlap that is robust to sample size differences.

- k=21, 100,000 reads
- Father-son: 0.909, Mother-son: 0.913, Unrelated: 0.901

### Normalized anchor overlap

Index reads by 60bp prefix. Compare base identity at matched positions. Normalize by self-similarity (split each sample in half, compare halves). Division by self-similarity removes batch effects.

- anchor=60bp, trim=10bp, 2,000,000 reads
- Father-son: 0.997, Mother-son: 1.001, Unrelated: 0.991

### Jensen-Shannon divergence

Symmetric information-theoretic divergence between k-mer frequency distributions. JSD is bounded [0,1] and satisfies the triangle inequality, making it a proper metric.

- k=21, 100,000 reads
- Score: 1 - JSD (higher = more similar)
- Father-son: 0.147, Mother-son: 0.140, Unrelated: 0.137

### K-mer ecosystem / Bray-Curtis (Symbiogenesis)

Treats the genome as an ecosystem of k-mer species. Computes Bray-Curtis dissimilarity of abundance profiles — a standard ecological beta-diversity metric. Also tracks Shannon diversity, Simpson diversity, and evenness.

- k=21, 100,000 reads
- Father-son: 0.125, Mother-son: 0.121, Unrelated: 0.118

---

## Failed approaches documented during development

| Attempt | Problem |
|---------|---------|
| CEPH 36bp reads, any algorithm | Reads too short for anchor-based comparison, k-mer overlap dominated by batch effects |
| MinHash with N hash functions | O(reads x kmers x N) — killed after 30+ minutes, bottom-sketch is correct approach |
| k=25 anchor on 36bp reads | 15% mismatch rate from false anchor matches |
| k=30+ anchor on 36bp reads | Zero overlaps — reads only 36bp long |
| K-mer frequency Pearson correlation | Captures batch effect, not genetics — father-son scores lower than unrelated |
| Raw identity without normalization | Detects father-son (same batch) but not mother-son (different batch) |

---

## Framework

All algorithms are implemented as pluggable experiments in the `@yalumba/experiments` package.

### Adding a new algorithm

```typescript
// packages/experiments/src/algorithms/my-algorithm.ts
import type { Experiment, SampleData, ExperimentScore } from "../types.js";

export const myAlgorithm: Experiment = {
  name: "My algorithm",
  description: "What it does",
  maxReadsPerSample: 100_000, // optional subsampling

  prepare(samples) {
    // Optional: preprocess all samples once
    return precomputedData;
  },

  compare(a, b, context) {
    // Compare two samples, return { score, detail }
    // Higher score = more related
    return { score: 0.95, detail: "some metrics" };
  },
};
```

Add to `algorithms/index.ts` and run: `bun run packages/experiments/src/run-giab.ts`

### Running the benchmark

```bash
# Full benchmark (all 21 algorithms)
bun run packages/experiments/src/run-giab.ts

# Generate synthetic test data
bun run packages/tooling/generate-family.ts

# Download GIAB data (~1.3GB)
# See packages/tooling/download-ceph.ts for URLs
```

---

## Repository

- **Source:** https://github.com/thomasdavis/yalumba
- **Live docs:** https://yalumba.vercel.app
- **Results page:** https://yalumba.vercel.app/results

---

## Technical details

- **Runtime:** Bun 1.1+
- **Language:** TypeScript (strict mode, no external bioinformatics libraries)
- **Data:** GIAB Ashkenazi trio, 148bp Illumina HiSeq reads
- **Hardware:** Apple Silicon (M-series), single-threaded execution
- **Total benchmark time:** ~8 minutes for all 21 algorithms
