# Problem Statement: Spectral Ecosystem Inference for Reference-Free Genomic Relatedness

## For an external advisor unfamiliar with this codebase

---

## 1. What we're building

**yalumba** is a from-scratch genomics compute engine written in TypeScript. It takes raw sequencing reads (FASTQ files) and detects biological relatedness between individuals — without a reference genome, without alignment, without variant calling. Everything from the FASTQ parser to the k-mer hasher to the GPU kernels is hand-written. No external bioinformatics libraries.

The pipeline:
```
Raw reads → k-mer extraction → module discovery → ecosystem comparison → relatedness score
```

We test on the **CEPH 1463 pedigree**: 6 members of a 3-generation family (4 grandparents, 2 parents) from the 1000 Genomes / Illumina Platinum Pedigree project. 50,000 reads per sample, 102bp Illumina paired-end. 10 pairwise comparisons: 4 parent-child (related), 6 unrelated/in-law/spousal.

**Success criterion**: all 4 parent-child pairs score higher than all 6 unrelated pairs (positive "weakest gap").

---

## 2. What we've built so far

### The module system

We extract **k-mer modules** from raw reads. A module is a cluster of k-mers (k=15) that repeatedly co-occur within 150bp windows across many reads. The extraction pipeline:

1. **Motif frequency counting** — scan all reads, count k-mer frequencies
2. **Co-occurrence graph** — for k-mer pairs appearing in the same window on multiple reads, build an undirected graph weighted by co-occurrence count
3. **Cohesion filtering** — keep edges where co-occurrence / min(support_A, support_B) ≥ 0.25
4. **Connected components** — extract connected components as modules (max 200 k-mers per module)

A typical sample produces 300-450 modules from 50,000 reads.

### The module graph

On top of modules, we build a **module interaction graph**:
- **Nodes** = modules
- **Edges** = module pairs that appear sequentially on the same reads (weighted by observation count, filtered to ≥ 2 observations)

We also discover **coalitions**: specific combinations of modules present on the same read. A coalition is identified by hashing the sorted set of module IDs found on a read.

### Four algorithm families tried

| Algorithm | Approach | Best result | Status |
|-----------|----------|-------------|--------|
| **Rare-Run P90** | Contiguous runs of rare k-mers | +583% separation, +300% gap | **Gold standard** |
| **Module Persistence v3** | Rarity-weighted shared module Jaccard + support cosine | +3.36% sep, +0.13% gap | **PASSES** |
| **Coalition Transfer v3** | Exclusive-ratio scoring of shared coalitions | +1.97% sep, +0.06% gap | **PASSES** |
| **Module Stability v4** | Bootstrap resampling, continuous stability weighting | +4.90% sep, -1.04% gap | **FAILS** |

The run-based method (Rare-Run P90) dominates. The module-based methods achieve tiny positive gaps at best. Module Stability proved that weight tuning cannot fix the structural confound: bootstrap stability correlates with sequencing coverage, not relatedness.

### The new direction: Spectral Ecology (v1)

We just built `@yalumba/ecology` — a spectral analysis package that computes:

1. **Normalized graph Laplacian** of the module interaction graph
2. **Eigendecomposition** via Jacobi rotation (exact, dense, sub-second for 300-450 node graphs)
3. **Multi-scale heat kernel signatures** at 10 timescales: trace(exp(-tL)) captures diffusion from local (t=0.1) to global (t=100)
4. **Spectral ecological role assignment**: each module classified as core/satellite/bridge/scaffold/boundary based on eigenvector coordinates
5. **Identity-free comparison**: heat trace distance + role spectrum JSD + spectral distance + graph energy ratio

---

## 3. The problem we just hit

When we ran Spectral Ecology v1 on CEPH 1463, we got:

```
Separation: -0.74%
Weakest gap: -26.87%
Detects all: NO
```

**The module interaction graphs are almost entirely disconnected.** With 300-450 modules per sample, only 2-5 edges survive the ≥ 2 observation filter. The graphs are >99% isolated nodes.

This means:
- **Spectral gap is 0** for all samples (disconnected graph → multiple zero eigenvalues)
- **All eigenvalues are 0 or 1** (isolated nodes have Laplacian eigenvalue 1)
- **Role assignment is trivial**: 95% satellite, 5% core, 0% bridge/scaffold
- **Heat kernel trace** is effectively just counting connected component sizes
- **The rich spectral machinery has nothing to work with**

The spouses (Father ↔ Mother) score highest similarity (0.90) because they have the most similar module counts and graph sizes — the same coverage confound that killed Module Stability.

---

## 4. Why the graphs are sparse

The current `buildModuleGraph()` function creates edges between modules that appear **sequentially on the same read** — module A's motifs appear at positions before module B's motifs on a read, and this happens on ≥ 2 reads. This is extremely restrictive:

- A 102bp read with k=15 has ~88 k-mer positions
- A module has 2-200 k-mers, but only a few will appear on any given read
- Two modules must both have members on the same read AND in sequential order AND this must happen twice
- With 50,000 reads and 300-450 modules, most module pairs never co-occur on any read

The **coalition finder** (`findCoalitions()`) is less restrictive — it finds ALL modules present on a read (not just sequential pairs) — but coalitions are currently only used for fingerprinting, not for graph construction.

---

## 5. What we need help with

We want to build a **nonlinear, multi-scale, structure-first ecosystem inference system** that:

1. **Produces dense, rich interaction graphs** from raw reads so the spectral machinery has meaningful structure to analyze
2. **Does not depend on exact token identity** for comparison — two individuals can share zero k-mers and still have similar ecosystems
3. **Captures multi-scale organization**: motif neighborhoods → module structure → coalition ecology → global topology
4. **Is robust to the coverage confound**: sequencing depth should not dominate the signal

### Specific technical questions:

**A. Graph construction: How should we build denser module interaction graphs?**

Options we're considering:
- **Co-occurrence edges**: any two modules present on the same read get an edge (what coalitions already detect). This will be much denser — if a read has 5 modules, that's 10 edges.
- **Weighted by co-occurrence strength**: edge weight = number of reads where both modules appear / geometric mean of individual frequencies
- **Higher-order structure**: build hyperedges (3-way, 4-way co-occurrence) or simplicial complexes
- **Multi-resolution**: different edge definitions at different k-mer sizes or window sizes

**B. What spectral/topological methods best capture inherited genomic structure?**

We have:
- Graph Laplacian eigendecomposition (working)
- Heat kernel signatures at multiple timescales (working)
- Spectral role assignment (working)

We're considering:
- **Persistent homology** of simplicial complexes built from module co-occurrence
- **Graph neural network-style message passing** (no training data, so unsupervised)
- **Optimal transport** between ecosystem distributions
- **Diffusion/reassembly dynamics**: perturb the graph, measure recovery
- **Spectral clustering stability**: do the clusters persist under perturbation?

**C. How should we compare two ecosystems without shared identity?**

Current comparison uses:
- L2 distance between log heat kernel traces
- Jensen-Shannon divergence between role spectra
- L2 distance between sorted eigenvalue sequences

We're considering:
- **Graph kernel methods**: Weisfeiler-Lehman subtree kernel, random walk kernel
- **Spectral graph distance**: compare full eigenvalue distributions, not just sorted lists
- **Wasserstein distance** between node embedding distributions
- **Gromov-Wasserstein distance**: compare metric spaces without correspondence
- **Kernel alignment** between heat kernel matrices

**D. How do we deconfound coverage from relatedness?**

Every method so far is bitten by: samples with similar sequencing depth produce similar module structures regardless of kinship. Normalization ideas:
- **Degree-corrected spectral methods** (e.g., regularized Laplacian)
- **Null model subtraction**: compare observed spectrum to expected spectrum under a random graph model with the same degree sequence
- **Coverage regression**: regress out total module count / total edge weight before comparison
- **Size-normalized spectral features**: use spectral ratios or normalized traces rather than absolute values

---

## 6. Available infrastructure

Everything is TypeScript on Bun runtime. We have:

| Package | What it does |
|---------|-------------|
| `@yalumba/modules` | Module extraction, module graph, coalition finder, boundary detector |
| `@yalumba/ecology` | Graph Laplacian, Jacobi eigendecomposition, heat kernel, role assignment, ecosystem signatures, comparison |
| `@yalumba/math` | BitSet, popcount, statistics, information theory (entropy, KL, JSD, cosine, NCD) |
| `@yalumba/kmer` | K-mer extraction, rolling hash (Rabin-Karp, Mersenne prime), k-mer index |
| `@yalumba/genome` | 2-bit DNA encoding, reverse complement, packed sequences |
| `@yalumba/symbiogenesis` | Algorithm runner, CEPH 1463 benchmark, 4 algorithm implementations |

**Compute budget**: not a constraint. Current algorithms take 50-320 seconds per run. We can go much heavier. GPU kernels (Vulkan/SPIR-V via C FFI) are available but not yet used for this.

**No external libraries**: everything must be implemented from scratch in TypeScript (CPU) or C (GPU). No numpy, no scipy, no networkx, no torch.

**No training data**: we have 6 samples with known pedigree. This is unsupervised — we cannot train a model. Any learned representations must be learned from the structure of individual samples, not from labeled relatedness data.

---

## 7. The data

**CEPH 1463 pedigree** (Illumina Platinum Pedigree, 30x WGS):

```
Generation 1:    NA12889 (Pat.GF) + NA12890 (Pat.GM)     NA12891 (Mat.GF) + NA12892 (Mat.GM)
                              |                                       |
Generation 2:            NA12877 (Father)    ─────────    NA12878 (Mother)
```

- 10 pairwise comparisons: 4 parent-child (should score high), 6 non-related
- 50,000 reads per sample, 102bp, k=15
- ~300-450 modules extracted per sample
- ~8,000-12,000 unique k-mer motifs per sample
- Module graphs: 300-450 nodes, 2-5 edges (the sparsity problem)

Expected biological signal: parent-child pairs share ~50% of genome by descent. This means ~50% of haplotype blocks are identical, which should produce overlapping module/coalition structures. The challenge is detecting this shared structure without exact token matching (heterozygosity at even one SNP changes k-mer identity within a shared block).

---

## 8. What "success" looks like

**Near-term**: positive weakest gap on CEPH 1463. All parent-child pairs score more similar than all unrelated pairs using spectral/topological methods.

**Medium-term**: the ecosystem representation reveals structure that run-based methods miss — cryptic relatedness, population structure, ancestral composition signals.

**Long-term**: a nonlinear ecosystem inference framework where relatedness is one downstream readout of a richer object — the "symbiogenetic field" — that captures multi-scale inherited genomic organization.

---

## 9. Constraints and preferences

- **No external bioinformatics libraries** (everything from scratch)
- **No supervised learning** (6 labeled samples is not enough)
- **Prefer methods with clear biological interpretation** over black boxes
- **Prefer methods that expose new structure** over methods that merely improve a threshold metric
- **Compute is not a constraint** but memory should stay reasonable (<8GB heap)
- **Deterministic** outputs preferred (seeded randomness acceptable)
- **TypeScript implementation** (or C for GPU kernels)
- **The spectral ecology package already works** — Jacobi eigendecomposition, heat kernel, role assignment are implemented and tested. We need better input graphs and richer comparison methods, not a rewrite.

---

## 10. Summary of the key insight

The module system works. Modules are real biological structures — bootstrap stability filtering showed that ~0.7% survive perturbation, and those survivors are all informative. Coalitions are real — they capture physical linkage of modules on haplotype blocks.

The comparison system doesn't work. Every method based on **exact identity matching** (shared modules, shared coalitions, shared k-mers) hits the same wall: related individuals produce related-but-not-identical structures, and exact matching can't detect the similarity. The coverage confound amplifies this failure.

The spectral approach is the right direction — it measures **structural similarity without identity** — but it needs denser graphs to have meaningful structure to analyze. The question is: how do we build graphs that are dense enough for spectral analysis, rich enough to capture inheritance, and robust enough to resist coverage confounds?
