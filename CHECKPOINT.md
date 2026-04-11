# Checkpoint — Spectral Ecology Research Program

**Date:** 2026-04-11
**Branch:** main
**Latest commit:** spectral ecology v6 — persistence fields, best gap -3.21%

---

## 1. What yalumba is

A from-scratch genomics compute engine in TypeScript. Takes raw FASTQ reads and detects biological relatedness without a reference genome, alignment, or variant calling. No external bioinformatics libraries — every parser, k-mer hasher, eigendecomposition solver, and heat kernel is hand-written.

**Thesis:** Human inheritance can be modeled as the transmission of resilient, interacting genomic ecosystems whose structure can be inferred from raw reads. Close kinship is one observable of this deeper system.

---

## 2. The benchmark

**CEPH 1463 pedigree** — 6 members of a 3-generation family from the Illumina Platinum Pedigree (100bp paired-end, ~30x WGS):

```
Generation 1:  NA12889 (Pat.GF) + NA12890 (Pat.GM)    NA12891 (Mat.GF) + NA12892 (Mat.GM)
                            |                                      |
Generation 2:          NA12877 (Father)    ──────    NA12878 (Mother)
```

- 50,000 reads per sample, k=15
- 10 pairwise comparisons: 4 parent-child, 6 unrelated/in-law/spousal
- **Success criterion:** all 4 parent-child pairs score higher than all 6 unrelated pairs (positive "weakest gap")
- Data source: `data/ceph-6/*.fastq.gz` streamed from EBI SRA (Illumina Platinum Pedigree ERR194146-ERR194161)

---

## 3. Algorithm families (Track A + Track B)

### Track A — Practical baseline (complete)

| Algorithm | Separation | Weakest Gap | Status |
|-----------|-----------|-------------|--------|
| **Rare-Run P90** | +583% | +300% | **GOLD STANDARD** |

Run-based method. Contiguous runs of rare k-mers. Works. Not the research direction.

### Track B — Symbiogenesis program (active)

| Algorithm | Separation | Weakest Gap | Status |
|-----------|-----------|-------------|--------|
| Module Persistence v3 | +3.36% | +0.13% | **PASSES** |
| Coalition Transfer v3 | +1.97% | +0.06% | **PASSES** |
| Module Stability v4 | +4.90% | -1.04% | Fails (coverage confound) |
| Spectral Ecology v1 | -0.74% | -26.87% | Fails (graph collapse) |
| Spectral Ecology v2 | +1.55% | -22.53% | Fails (within-sample ceiling) |
| Spectral Ecology v3 | +4.93% | -54.67% | Fails (indiscriminate matching) |
| Spectral Ecology v4 | +0.02% | -4.99% | Fails (spouse #8 — **confound broken**) |
| Spectral Ecology v5 | -0.74% | -11.29% | Fails (outlier dominance) |
| **Spectral Ecology v6** | **-0.51%** | **-3.21%** | **Fails (best gap ever)** |

---

## 4. The spectral ecology trajectory

### v1 — Sequential adjacency (FAILED)
- Used `buildModuleGraph()` which creates edges from sequential module ordering on reads
- Produced 2-5 edges from 300-450 modules (>99% disconnected)
- Spectral gap = 0, all eigenvalues 0 or 1, roles trivially satellite
- **Lesson:** graphs must be dense

### v2 — Statistical co-occurrence (within-sample ceiling)
- Replaced sequential adjacency with read-level co-occurrence: for each read, all module pairs get an edge
- Edge weight: `cooccur(A,B) / sqrt(freq(A) * freq(B))`
- 600-1,400 edges (280x improvement)
- Heat kernel + eigenvalue density + role assignment + localization + diffusion distances
- Five sub-experiments: kNN kernel (backfired), eigenvalue filtering (+1.89%), node HKS distributions, mean normalization
- **Lesson:** within-sample spectral summaries hit a ceiling at ~1.5-1.9% because they measure ecosystem SHAPE, which correlates with coverage

### v3 — Cross-sample bipartite transport (+4.93% separation)
- 20D enriched node features (support, cohesion, motif count, degree, clustering coeff, HKS×5, spectral position×4, role one-hot×5)
- Gaussian similarity kernel with auto-bandwidth
- Mutual top-5 matching
- Transport affinity + topology preservation + unmatched penalty
- All 4 parent-child pairs ranked above all 4 pure unrelated pairs (first time)
- **Lesson:** cross-sample structure is the missing ingredient, but matching must be selective (spouses still #1 with 1,400 indiscriminate matches)

### v4 — Symbiogenetic coherence fields (**spouse confound broken**)
- 2-hop ecological patches: local Laplacian spectrum (8D) + role composition (5D) + edge stats + density + size + diffusion distance = 17D patch tensor
- Continuous field Φ: M_A → M_B via kernel regression over patch tensors
- Distortion energy + curvature mismatch + cooperative stability
- **Spouse pair dropped from rank #1 to rank #8** — first time in any spectral method
- Gap improved 11x from -54.67% to -4.99%
- **Lesson:** local neighbourhood geometry carries more inheritance signal than global graph statistics; the coverage confound is breakable

### v5 — Multi-scale field curvature
- Patches at 3 scales (1-hop/2-hop/3-hop, capped at 20/40/60 nodes)
- Coherence field per scale, then measure scale consistency
- Scale consistency: do the fields agree across scales? (Second-order invariant)
- Spouse stayed at #6, dynamic range improved 1.85x
- But cooperative stability collapsed when averaged across scales (range shrank from 0.162 to 0.038)
- NA12891 outlier dominance worsened
- **Lesson:** multi-scale is the right idea but averaging kills the cooperative stability signal; scale variance > scale mean

### v6 — Symbiogenetic persistence fields (**best gap: -3.21%**)
- Built on v4's architecture (which had the best gap)
- Three targeted fixes:
  1. **Symmetrized field:** Φ(A→B) and Φ(B→A), measure round-trip consistency
  2. **Perturbation coherence:** 5 trials with 10% edge noise, measure field persistence
  3. **Robust aggregation:** trimmed mean (drop top/bottom 10%) to resist outliers
- Weights: 0.30 perturbation coherence + 0.25 symmetry + 0.25 cooperative stability + 0.10 curvature + 0.10 distortion
- Gap improved to -3.21% (from -4.99% in v4)
- Perturbation coherence: 0.95-0.98 for all pairs (fields are noise-resistant but this doesn't discriminate)
- Symmetry agreement: near-zero for all pairs (round-trip always fails — this is the bottleneck)

---

## 5. Current state of the code

### Package: `@yalumba/ecology` (12 source files)

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 171 | Core type definitions |
| `motif-graph.ts` | 107 | Co-occurrence graph construction (v2) |
| `laplacian.ts` | 175 | Normalized Laplacian + Jacobi eigendecomposition |
| `heat-kernel.ts` | 100 | Multi-scale heat kernel signatures (10 timescales) |
| `role-assignment.ts` | 161 | Spectral ecological role classification |
| `spectral-invariants.ts` | 254 | Eigenvalue density, localization, curvature, diffusion |
| `null-model.ts` | 142 | Chung-Lu null model (broken — z-scores 100K+) |
| `module-embedding.ts` | 188 | 7D intrinsic module feature vectors |
| `ecosystem-signature.ts` | 155 | Per-sample ecosystem signature aggregation |
| `compare.ts` | 162 | Within-sample ecosystem comparison (v2) |
| `node-features.ts` | 192 | 20D enriched node features for cross-sample matching |
| `pair-transport.ts` | 310 | v3 bipartite transport scoring |
| `patch-tensor.ts` | 225 | 2-hop ecological patch extraction (17D tensors) |
| `coherence-field.ts` | 338 | v4 coherence field solver |
| `multiscale-field.ts` | 440 | v5 multi-scale field curvature |
| `persistence-field.ts` | ~420 | v6 symmetrized + perturbation persistence |
| `ecology.test.ts` | 205 | 10 tests (all passing) |
| `index.ts` | 52 | Barrel exports |

### Package: `@yalumba/symbiogenesis`

- `spectral-ecology.ts` — currently v6, registered as `spectral-ecology` in the runner
- `module-persistence.ts` — v3, PASSES
- `coalition-transfer.ts` — v3, PASSES
- `module-stability.ts` — v4, fails
- `run.ts` — experiment runner, CEPH 1463 benchmark

### LaTeX papers (all compiled to PDF)

| Paper | Lines | Location |
|-------|-------|----------|
| Module Stability v4 | 948 | `apps/docs/latex/reports/module-stability-v4-2026-04.tex` |
| Spectral Ecology v2 | 1,079 | `apps/docs/latex/reports/spectral-ecology-v2-2026-04.tex` |
| Spectral Ecology v3 | 713 | `apps/docs/latex/reports/spectral-ecology-v3-2026-04.tex` |
| Spectral Ecology v4 | 653 | `apps/docs/latex/reports/spectral-ecology-v4-2026-04.tex` |
| Spectral Ecology v5 | 672 | `apps/docs/latex/reports/spectral-ecology-v5-2026-04.tex` |

PDFs served from `apps/docs/public/reports/`.

---

## 6. Key findings

### What works
1. **Co-occurrence graphs** produce spectrally rich structures (600-1,400 edges vs 2-5 from sequential adjacency)
2. **Cross-sample bipartite transport** triples separation vs within-sample methods (+4.93% vs +1.55%)
3. **Coherence fields over ecological patches** break the spouse confound (spouse dropped from #1 to #8 in v4, holds in v5/v6)
4. **Cooperative stability** (field smoothness) has the widest dynamic range and most inheritance-like behaviour
5. **Perturbation coherence** confirms fields are noise-resistant (0.95-0.98) — the structural correspondences are robust
6. **Trimmed mean aggregation** reduces outlier module impact

### What doesn't work
1. **Exact token identity** — shared modules, shared coalitions, shared k-mers. Related individuals produce related-but-not-identical structures. Exact matching can't detect the similarity.
2. **Within-sample spectral summaries** — eigenvalue density, heat trace, role spectrum. These measure ecosystem SHAPE which correlates with coverage.
3. **Chung-Lu null model** — produces numerically unstable z-scores (65K-240K). Needs a proper configuration model or degree-preserving rewiring.
4. **kNN support-similarity kernel** — connects modules by size (a coverage proxy), amplifying the confound instead of fixing it.
5. **Averaging cooperative stability across scales** — destroys discriminative power (range collapses from 0.162 to 0.038).
6. **Symmetry agreement via round-trip nearest-neighbor** — near-zero for all pairs. The round-trip through nearest-neighbor lookup loses too much information.

### Persistent data issues
- **NA12891 (Mat.GF) is a structural outlier:** 449 modules, 1,410 edges, 356 bridges (every other sample has 0). This sample dominates all comparisons involving it. May be a sequencing library artifact or genuine biological difference.
- **Father and Mother (spouses) have nearly identical module counts** (444 vs 443) — global statistics see them as twins. Local patch geometry correctly distinguishes them.

---

## 7. Distance to passing

**Current best gap:** -3.21% (v6)
**Passing threshold:** >0% (Module Persistence v3 passes at +0.13%, Coalition Transfer v3 at +0.06%)
**Distance:** 3.21 percentage points

### Three orthogonal improvements that could close the gap:

1. **Fix symmetry metric (~1-2pp).** Current round-trip via nearest-neighbor always fails. Use soft coupling (Sinkhorn) instead of hard nearest-neighbor for the return mapping. Or measure directional agreement through kernel alignment rather than point-to-point round-trip.

2. **Increase cooperative stability weight (~1pp).** It has the widest range (0.05-0.21) but only gets 25% weight. At 40-50% weight it would contribute more discrimination. The perturbation coherence (0.95-0.98, range 0.03) contributes almost nothing and could be reduced.

3. **NA12891-robust scoring (~1pp).** The outlier sample inflates in-law scores. Options: (a) normalize patch tensors per sample before cross-sample comparison, (b) use rank-based aggregation instead of trimmed mean, (c) detect and downweight modules with atypical role distributions.

---

## 8. The conceptual hierarchy

The research has traversed five paradigms, each more powerful than the last:

```
Tokens (k-mers, modules)
  → exact identity, brittle to heterozygosity

Summaries (spectra, traces, role distributions)
  → identity-free but coverage-limited

Matchings (bipartite transport)
  → cross-sample but indiscriminate

Fields (coherence deformations)
  → selective, context-aware, structure-preserving

Persistence fields (symmetrized, perturbation-robust)
  → constraint-detecting, robust to noise and outliers
```

The equivalent in other domains:
```
discrete → statistical → relational → geometric → gauge-theoretic
```

---

## 9. Design rules (from CLAUDE.md)

1. **No new algorithm should depend primarily on exact motif or module identity.** Use soft similarity, latent embeddings, role equivalence, structural isomorphism, dynamical equivalence.
2. **Edges represent statistical dependence, not physical adjacency.** Build graphs from co-occurrence probabilities normalized by frequency.
3. **Coverage must be deconfounded.** Every comparison method must be robust to similar sequencing depth producing similar module structures.
4. **Multi-scale always.** Single-scale features collapse information.
5. **Compute is not a constraint.** Prefer heavy methods (spectral decomposition, optimal transport, persistent homology) over fast but shallow ones.

---

## 10. What to try next

### Highest impact (likely to close the gap)
- **Sinkhorn-regularized transport** for the symmetry component — produces a doubly-stochastic coupling that's a proper distance metric
- **Cooperative stability at 45-50% weight** — it's the strongest signal, give it more influence
- **Per-sample patch tensor normalization** before cross-sample comparison — reduces NA12891 outlier effect

### Medium-term
- **Persistent homology** of simplicial co-occurrence complexes — topological features are inherently size-invariant
- **Gromov-Wasserstein distance** between ecosystem distributions — compares metric spaces without node correspondence
- **Feature ablation** — determine which of the 17 patch tensor dimensions carry signal vs noise

### Long-term
- **GPU acceleration** — batch eigendecomposition on SPIR-V, kernel distance computation
- **Larger datasets** — 1000 Genomes trios, SGDP, multi-generation pedigrees
- **Kinship gradient validation** — parent-child > grandparent > cousin > unrelated monotonicity
- **Ancestral ecosystem inference** — reconstruct proto-ecosystems that explain related individuals jointly

---

## 11. Repo layout

```
yalumba/
├── CLAUDE.md              ← project philosophy + coding conventions
├── PROBLEM.md             ← external-facing problem statement
├── CHECKPOINT.md          ← this file
├── packages/
│   ├── ecology/           ← spectral ecosystem inference (12 source files)
│   ├── symbiogenesis/     ← algorithm runner + 4 algorithm implementations
│   ├── modules/           ← module extraction, coalition finder
│   ├── math/              ← bitset, statistics, information theory
│   ├── kmer/              ← k-mer extraction, rolling hash
│   ├── genome/            ← 2-bit DNA encoding
│   ├── fastq/             ← FASTQ parser
│   └── ...                ← 10 more packages (alignment, vcf, gpu, spirv, etc.)
├── apps/
│   └── docs/
│       ├── latex/reports/  ← 7 LaTeX papers (all compiled to PDF)
│       └── public/reports/ ← PDFs for serving
└── data/
    ├── synthetic/          ← 4-member synthetic family
    └── ceph-6/             ← CEPH 1463 6-member pedigree (gitignored FASTQ.gz)
```

---

## 12. How to run

```bash
# Install
bun install

# Run spectral ecology on CEPH 1463
bun run packages/symbiogenesis/src/run.ts spectral-ecology

# Run other algorithms
bun run packages/symbiogenesis/src/run.ts module-persistence
bun run packages/symbiogenesis/src/run.ts coalition-transfer
bun run packages/symbiogenesis/src/run.ts module-stability

# Run ecology tests
cd packages/ecology && bun test

# Compile a LaTeX paper
cd apps/docs/latex/reports && nix run nixpkgs#tectonic -- spectral-ecology-v6-2026-04.tex
```
