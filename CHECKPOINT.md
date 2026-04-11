# Comprehensive Checkpoint — yalumba Genomic Ecosystem Research Program

**Date:** 2026-04-12
**Branch:** main

---

## 1. What yalumba is

A from-scratch genomics compute engine in TypeScript (with C native kernels). Takes raw FASTQ sequencing reads and detects biological relatedness without a reference genome, alignment, or variant calling. No external bioinformatics libraries.

**Repository:** https://github.com/thomasdavis/yalumba

**Thesis:** Human inheritance can be modeled as the transmission of resilient, interacting genomic ecosystems whose structure can be inferred from raw reads.

**Two tracks:**
- **Track A (practical baseline):** Rare-Run P90 — token-based, +583% separation, +300% gap. Gold standard.
- **Track B (research):** Symbiogenesis — nonlinear ecosystem inference via spectral geometry. The main direction.

---

## 2. The benchmark

**CEPH 1463 pedigree** — 6 members, 3 generations, 50K reads/sample, 150bp:

```
G1:  NA12889+NA12890 (paternal)    NA12891+NA12892 (maternal)
                |                            |
G2:         NA12877 (Father) ──── NA12878 (Mother)
```

10 pairs: 4 parent-child (must score highest), 6 unrelated.

---

## 3. Algorithm history (complete)

### Track A: 50 token-based algorithms (archived)
Best: Rare-Run P90 at +583% separation, +300% gap. Essentially reference-free IBD.

### Track B: Symbiogenesis (active)

**Passing algorithms:**
| Algorithm | Sep | Gap | How |
|-----------|-----|-----|-----|
| Module Persistence v3 | +3.36% | +0.13% | Rarity-weighted module Jaccard + support cosine |
| Coalition Transfer v3 | +1.97% | +0.06% | Exclusive pair ratio + freq cosine |

**Spectral ecology (10 versions, none pass):**
| Ver | Sep | Gap | Innovation |
|-----|-----|-----|-----------|
| v1 | -0.74% | -26.87% | Sparse graphs |
| v2 | +1.55% | -22.53% | Dense co-occurrence |
| v3 | +4.93% | -54.67% | Cross-sample transport |
| v4 | +0.02% | -4.99% | Coherence fields — spouse broken |
| v5 | -0.74% | -11.29% | Multi-scale (averaging kills) |
| v6 | -0.51% | -3.21% | Persistence fields |
| v7 | +0.87% | **-0.61%** | **Best gap** (Sinkhorn + 55% coop) |
| v8 | +1.62% | -6.41% | Holonomy (gauge theory) |
| v9 | **+3.20%** | -7.93% | **Best sep** (intrinsic curvature) |
| v10 | +1.50% | -1.66% | Hybrid v9+v7 |

---

## 4. THE CRISIS: Representation audit

**The most important experiment.** Tested whether the module-graph was a reliable measurement instrument.

**Findings:**
- **0/15 features pass signal-to-nuisance ratio > 3**
- Curvature mean/std (v9's features): ratio < 1 — NOISE > SIGNAL
- Triangle count: ratio 0.94 — NOISE > SIGNAL
- Best feature: edgeDensity at 2.93 (still below threshold)
- **Shuffling read order changes modules 45-184%, triangles up to 607%**
- The representation was NON-DETERMINISTIC

**Root cause:** Line 74 of module-builder.ts: `if (insertions > MAX_LOAD) break;`
Fixed-size hash table stops processing reads at 70% capacity. Plus integer hash collisions and non-deterministic BFS.

---

## 5. THE FIX: Canonical builder

`packages/modules/src/canonical-builder.ts`:
1. No early termination — all reads processed
2. Collision-free string keys ("a:b")
3. Frequency-threshold cutoff (deterministic)
4. Sorted BFS (deterministic components)

**Verified:** NA12889 produces 230 modules across ALL shuffles (0% variation).
Old builder: 457→938 modules (+105% variation).

`buildInteractionGraph` in ecology package now uses canonical builder.

---

## 6. Current state

- **Canonical builder: VERIFIED DETERMINISTIC** (Stage A complete)
- **Post-canonical audit: RUNNING** — the critical experiment
- **All pre-canonical numbers are provisional** — not reliable for algorithm comparison

**The question now:** Does determinism improve signal-to-nuisance ratios?
- If yes: spectral ecology can resume on sound foundation
- If no: the module abstraction itself may be wrong

---

## 7. Key design rules

1. No external bioinformatics libraries
2. No file over 300 lines (source code)
3. No new spectral ecology (v11+) until representation passes gates:
   - Self-perturbation CV < 0.10
   - Shuffle sensitivity < 5%
   - SNR > 3

---

## 8. Codebase

18 packages, 4 apps, native C kernels, 15+ LaTeX papers.
Key packages: fastq, genome, kmer, modules (with canonical-builder), ecology (18 files), symbiogenesis (runner + 7 algorithms), compute (C FFI), math, gpu, spirv.

Custom LaTeX class with wine palette (Winesmiths Shiraz). Papers compiled via tectonic.

---

## 9. For external review

Read in order:
1. `PROBLEM.md` — problem statement
2. `theoretical-framework-2026-04.pdf` — research vision (2310 lines)
3. `representation-audit-2026-04.pdf` — the crisis (1799 lines)
4. `canonicalization-2026-04.pdf` — the fix (1618 lines)
