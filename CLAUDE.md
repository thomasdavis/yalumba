# CLAUDE.md — yalumba

> A nonlinear, structure-first genomic intelligence system.
> Raw reads → ecosystem inference → inherited organization detection.
> TypeScript orchestration with custom GPU kernels.

---

## What is yalumba?

A monorepo containing a complete genomics compute stack built from scratch. No external bioinformatics libraries — every parser, algorithm, and kernel is hand-written. The goal is deep understanding and beautiful packaging, not wrapping existing tools.

### Research thesis

> Human inheritance can be modeled as the transmission of resilient, interacting genomic ecosystems whose structure can be inferred from raw reads without reference coordinates. Close kinship is only one observable of this deeper system.

The project does **not** aim to be a cheaper approximation of classical IBD detection. It aims to infer and compare **inherited multi-scale genomic ecosystems** — objects richer than haplotype segments, detectable without alignment or variant calling.

### Two tracks

- **Track A (practical baseline):** Rare-Run P90 and similar run-based methods for threshold kinship detection. These work. They are the benchmark.
- **Track B (ambitious research):** The symbiogenesis program — nonlinear ecosystem inference via spectral geometry, ecological role assignment, diffusion dynamics, and topological methods. Relatedness is one downstream readout, not the objective function.

### Philosophical stance

The primary computational objects are **not** k-mers, runs, reads, or alignment coordinates. They are:

- **Motif societies** — co-occurring k-mer clusters that form modules
- **Coalition ecologies** — combinations of modules inherited together on haplotype blocks
- **Module fields** — interaction graphs over modules, analyzed spectrally
- **Ecosystem signatures** — multi-scale, identity-free fingerprints of genomic organization

Comparison asks: "do these two genomes instantiate the same *kind* of organization?" — not "do they share the same tokens?"

### Key design rules for the symbiogenesis program

1. **No new algorithm should depend primarily on exact motif or module identity.** Use soft similarity, latent embeddings, role equivalence, structural isomorphism, dynamical equivalence instead.
2. **Edges represent statistical dependence, not physical adjacency.** Build graphs from co-occurrence probabilities normalized by frequency, not from sequential ordering on reads.
3. **Coverage must be deconfounded.** Every comparison method must be robust to the fact that samples with similar sequencing depth produce similar module structures regardless of kinship.
4. **Multi-scale always.** Single-scale features collapse information. Use heat kernels at multiple timescales, eigenvalue density profiles, diffusion distance distributions — not scalar summaries.
5. **Compute is not a constraint.** Prefer methods that are "too heavy" (spectral decomposition, optimal transport, persistent homology) over methods that are fast but shallow.

### The stack

```
FASTQ file → parse → encode → k-mer extraction →
  module discovery → co-occurrence graph (dense) →
  Laplacian eigendecomposition → heat kernel signatures →
  ecological role assignment → ecosystem comparison
```

GPU acceleration is provided via a custom pipeline: TypeScript DSL → C codegen → SPIR-V → GPU dispatch.

---

## Hard constraints

1. **No external bioinformatics libraries.** Everything from scratch in TypeScript (CPU) or C (GPU kernels). This is the foundational rule.
2. **No file over 300 lines.** If a file approaches 300 lines, split it. Prefer many small, focused files over few large ones.
3. **TypeScript for all CPU-side code.** Bun runtime. ES modules. Strict mode.
4. **C for GPU kernels and SPIR-V tooling.** Lives in `packages/native/`. The TypeScript layer calls into these via FFI when available.
5. **Keep the repo root clean.** Only config files (package.json, tsconfig, turbo.json, etc.) live at the root. All source code, tooling, and native code lives under `packages/` or `apps/`.
6. **Every package must be independently usable.** Someone should be able to `npm install @yalumba/fastq` and use just the FASTQ parser. Or just the k-mer engine. Or just the math utilities.
7. **Streaming first.** Prefer streaming/iterative APIs over loading everything into memory. Genomic files are large.
8. **Deterministic outputs.** Same input → same output. No randomness in core algorithms unless explicitly seeded.

---

## Repository structure

```
yalumba/
├── apps/
│   ├── cli/            # Command-line interface (yalumba parse, yalumba compare, etc.)
│   ├── docs/           # Next.js lab notebook + LaTeX paper generation
│   ├── playground/     # Interactive experimentation script
│   └── benchmark/      # Performance benchmarks
├── packages/
│   ├── fastq/          # FASTQ parser — streaming, validation, statistics
│   ├── genome/         # DNA encoding — 2-bit packing, base ops, reverse complement
│   ├── kmer/           # K-mer extraction, rolling hash, k-mer index
│   ├── modules/        # Module extraction, module graphs, coalition finder
│   ├── ecology/        # Spectral ecosystem inference — Laplacian, heat kernel, roles
│   ├── symbiogenesis/  # Algorithm runner + all symbiogenesis algorithm implementations
│   ├── alignment/      # Jaccard similarity, MinHash, Needleman-Wunsch
│   ├── relatedness/    # Shared segments, IBD estimation, centimorgan approximation
│   ├── vcf/            # Variant representation — SNP calling, VCF records
│   ├── math/           # Bitset, popcount, statistics, information theory
│   ├── gpu/            # GPU buffer management, device abstraction, kernel dispatch
│   ├── spirv/          # SPIR-V IR, builder DSL, C code generation
│   ├── runtime/        # Pipeline orchestration, environment detection
│   ├── io/             # Chunked file reading, buffer pools
│   ├── compression/    # Gzip detection and decompression
│   └── native/         # C/SPIR-V code (not a TS package — not in workspaces)
│       ├── spirv-compiler/ # C tool: GLSL → SPIR-V compilation
│       ├── gpu-runtime/    # C library: Vulkan compute dispatch
│       └── kernels/        # C reference implementations + GLSL compute shaders
│   └── tooling/        # Dev scripts (data generators, etc.)
└── data/               # Generated data (gitignored FASTQ files)
    ├── synthetic/      # Synthetic family (4 members)
    └── ceph-6/         # CEPH 1463 pedigree (6 members, Illumina Platinum Pedigree)
```

---

## Dependency graph (packages)

```
math (leaf — no deps)
 ↑
io (leaf — no deps)
 ↑
compression (leaf — no deps)
 ↑
genome → math
 ↑
fastq → io, genome
 ↑
kmer → genome, math
 ↑
alignment → kmer, genome
 ↑
vcf → genome
 ↑
relatedness → kmer, alignment
 ↑
gpu → math
 ↑
spirv (leaf — no deps)
 ↑
runtime → gpu
```

When adding new dependencies between packages, update the `dependencies` in `package.json` AND the `references` in `tsconfig.json` of the dependent package.

---

## Tech stack

- **Runtime:** Bun >= 1.1
- **Language:** TypeScript 5.7+ (strict, ES2022 target)
- **Monorepo:** Turborepo with Bun workspaces
- **Module system:** ES modules only (`"type": "module"` in all package.json)
- **Testing:** `bun test` (built-in test runner)
- **Native code:** C11 (kernels), GLSL 4.50 (compute shaders)
- **Future browser target:** WebGPU/WebGL for GPU, standard Web APIs for everything else

---

## Development commands

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests across all packages
bun run test

# Type-check everything
bun run typecheck

# Run the CLI
bun run --filter @yalumba/cli dev -- parse file.fastq

# Run the playground
bun run --filter @yalumba/playground dev

# Run benchmarks
bun run --filter @yalumba/benchmark dev
```

---

## Coding conventions

### TypeScript

- **Strict mode always.** `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- **Prefer `readonly` everywhere.** Interface fields, function params, array types.
- **Classes for stateful things, functions for stateless.** A parser that holds options → class. A pure hash function → standalone function.
- **Export from `index.ts` barrel files.** Each package has `src/index.ts` that re-exports the public API. Internal modules use `.js` extensions in imports.
- **Types in `types.ts`.** Each package keeps its type definitions in a dedicated `types.ts` file.
- **No `any`.** Use `unknown` and narrow. If you need escape hatches, use a branded type or assertion function.
- **Typed arrays for performance-critical code.** `Uint8Array`, `Uint32Array`, `Float64Array` over plain arrays for bulk data.
- **BigInt for hashes.** K-mer hashes use `bigint` to avoid precision loss.

### Naming

- Files: `kebab-case.ts` (e.g., `rolling-hash.ts`, `buffer-pool.ts`)
- Classes: `PascalCase` (e.g., `FastqParser`, `KmerExtractor`)
- Functions/methods: `camelCase` (e.g., `reverseComplement`, `hammingDistance`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `BASES_PER_WORD`, `DEFAULT_K`)
- Types/interfaces: `PascalCase` (e.g., `FastqRecord`, `PackedDna`)
- Package names: `@yalumba/kebab-case`

### Error handling

- Throw typed errors with context (e.g., `FastqParseError` with line number).
- Validate at boundaries (file input, CLI args). Trust internal data flow.
- No try-catch in library code unless recovering from a specific known failure.

### Testing

- Test files live alongside source: `src/parser.test.ts` next to `src/parser.ts`.
- Use `bun test`. Use `describe` / `it` / `expect`.
- Test the public API of each package, not internal implementation details.
- Include edge cases: empty input, single-base sequences, maximum length, invalid data.
- Benchmark-sensitive code should have a basic perf sanity check (not a strict threshold — just "doesn't regress by 10x").

### Git

- Conventional commits: `feat(fastq): add streaming parser`, `fix(kmer): handle sequences shorter than k`.
- One logical change per commit. Don't mix refactoring with features.
- Branch naming: `feat/package-name-description` or `fix/package-name-description`.

---

## DNA encoding reference

```
A = 0b00 = 0
C = 0b01 = 1
G = 0b10 = 2
T = 0b11 = 3
N → mapped to A (0) during packing; tracked separately via N-mask
```

16 bases per `uint32` word. Complement is `base XOR 0b11`.

---

## K-mer hashing reference

Rabin-Karp style polynomial rolling hash:

```
hash = Σ (base_prime^i * char_code) mod mersenne_prime
base_prime = 31
mersenne_prime = 2^61 - 1
```

Canonical k-mers: lexicographically smaller of (kmer, reverse_complement(kmer)).

---

## Performance philosophy

1. **CPU first, GPU later.** Every algorithm has a CPU implementation. GPU is an optimization, not a requirement.
2. **Measure before optimizing.** Use `apps/benchmark` to profile. Don't guess.
3. **Typed arrays > object arrays** for bulk data. Cache-friendly and GC-friendly.
4. **Iterator/generator patterns** for memory efficiency. Don't materialize a million k-mers into an array when you can yield them.
5. **Buffer pools** for reducing allocation pressure in hot loops.

---

## Adding a new package

1. Create `packages/new-package/` with `package.json`, `tsconfig.json`, `src/index.ts`, `src/types.ts`.
2. The `package.json` must have: `name`, `version`, `type: "module"`, `main`, `types`, `exports`, standard scripts.
3. The `tsconfig.json` must extend `../../tsconfig.base.json` and declare `references` to dependencies.
4. Export public API from `src/index.ts`. Keep types in `src/types.ts`.
5. Add workspace dependency references in consuming packages.
6. Run `bun install` to link.

---

## GPU pipeline (future)

The GPU compute pipeline is:

```
TypeScript DSL (@yalumba/spirv SpirVBuilder)
  → SPIR-V IR (SpirVModule)
  → C code generation (CCodegen)
  → Compilation to SPIR-V binary (native/spirv-compiler)
  → GPU dispatch (@yalumba/gpu KernelDispatcher)
```

For now, all kernels have CPU fallback implementations registered via `KernelDispatcher.registerCpuFallback()`. The native C implementations in `packages/native/kernels/` serve as reference implementations and FFI acceleration targets.

Browser path: WebGPU compute shaders will be an alternative backend for `@yalumba/gpu`.

---

## Docs app (apps/docs)

The Next.js tutorial app at `apps/docs` is a living lab notebook that documents the entire analysis pipeline — processes, data sources, code examples, and results.

**This app must be kept up to date as the analysis progresses.** When adding new pipeline stages, results, or data sources, update the relevant docs pages. When analysis results change, update the results page with current numbers.

### Deployment

The docs app was previously deployed to Vercel. **Do not worry about deploying to Vercel** — just push to git. PDFs are served from `apps/docs/public/reports/` and can be viewed locally.

```bash
# Local development
bun run --filter @yalumba/docs dev

# Build
bun run --filter @yalumba/docs build
```

### Pages

- `/` — Overview, pipeline summary, quick examples
- `/pipeline` — Step-by-step walkthrough of each processing stage
- `/data` — Data sources (synthetic family, CEPH 1463 pedigree)
- `/results` — Analysis results (comparison matrices, relatedness estimates)
- `/packages` — Package reference (exports, files, descriptions)
- `/reports` — Published scientific reports with LaTeX-style rendering
- `/reports/[slug]` — Individual report pages (Paper component, serif typography)

---

## Experiment workflow

The project follows a research loop:

1. **Hypothesize** — propose a new algorithm based on structural/ecological insight
2. **Implement** — create a file in `packages/symbiogenesis/src/algorithms/` implementing the `SymbioAlgorithm` interface
3. **Register** — import and add to the `ALGORITHMS` map in `packages/symbiogenesis/src/run.ts`
4. **Benchmark** — `bun run packages/symbiogenesis/src/run.ts <algorithm-name>` (defaults to CEPH 1463)
5. **Evaluate** — check separation, weakest-pair gap, timing, and qualitative structure (role distributions, spectral profiles)
6. **Document** — write a LaTeX report in `apps/docs/latex/reports/`, compile with tectonic
7. **Iterate** — the goal is NOT just a positive gap; it is exposing new structure that token-matching methods miss

### Adding a new symbiogenesis algorithm

```typescript
// packages/symbiogenesis/src/algorithms/my-algorithm.ts
import type { SymbioAlgorithm, SampleReads, ComparisonScore } from "../types.js";

export const myAlgorithm: SymbioAlgorithm = {
  name: "My algorithm",
  version: 1,
  description: "What it does",
  family: "ecological-succession",
  maxReadsPerSample: 50_000,

  prepare(samples) {
    // Build per-sample representations (graphs, signatures, embeddings)
    return context;
  },

  compare(a, b, context) {
    // Compare structural representations — NOT token overlap
    return { score: 0.95, detail: "metrics" };
  },
};
```

### Current algorithms

| Algorithm | File | Status |
|-----------|------|--------|
| Module Persistence v3 | `module-persistence.ts` | PASSES (+3.36% sep, +0.13% gap) |
| Coalition Transfer v3 | `coalition-transfer.ts` | PASSES (+1.97% sep, +0.06% gap) |
| Module Stability v4 | `module-stability.ts` | FAILS (coverage confound) |
| Spectral Ecology v7 | `spectral-ecology.ts` | Best gap -0.61% |
| Spectral Ecology v8 | `spectral-ecology-v8.ts` | Holonomy, top-3 parent-child |
| Spectral Ecology v9 | `spectral-ecology-v9.ts` | Intrinsic curvature, best sep +3.20% |
| Spectral Ecology v10 | `spectral-ecology-v10.ts` | Hybrid, best balanced -1.66% |

### CRITICAL: Representation audit (April 2026)

**The invariant-design program is PAUSED.** The representation audit (`representation-audit.ts`) showed:

- **0/15 features pass signal-to-nuisance ratio > 3**
- **Curvature mean/std have ratio < 1** (noise dominates signal)
- **Shuffling read order changes graph structure 45-607%** (not deterministic)

**No new spectral ecology version (v11+) should be built until the representation passes reliability gates:**

1. Self-perturbation CV < 0.10 for all scored features
2. Shuffle sensitivity < 5% for all scored features
3. Signal-to-nuisance ratio > 3 for all scored features

The next phase is **representation canonicalization**, not invariant design. See `representation-audit-2026-04.pdf`.

### Adding a new report

Create a page at `apps/docs/src/app/reports/[slug]/page.tsx` using the `Paper` component from `@/components/paper`. Add the report entry to the listing in `apps/docs/src/app/reports/page.tsx`. Reports use serif typography with LaTeX-inspired layout.

**Reports must be comprehensive scientific documents.** They are NOT summaries — they are detailed papers covering everything that matters. A good report includes:

- **Full algorithm catalogue** — every algorithm listed with description, category, maxReads
- **Per-pair score tables** — not just averages, show individual pair scores for top algorithms
- **Per-dataset analysis** — separate sections for each dataset with their own tables
- **Failure analysis** — why specific algorithms fail, categorized by failure mode
- **Mathematical analysis** — equations for key metrics (sharing probability, expected run length)
- **Pedigree diagrams** — ASCII art showing family structure and relationships
- **Connection to theory** — how results relate to classical IBD, population genetics
- **Practical recommendations** — when to use which algorithm, memory/time tradeoffs
- **Honest limitations** — what wasn't tested, what could be better

Reports are typically 500-800+ lines. The 300-line limit does NOT apply to report pages — only to package source code files. Reports are data-heavy documents that need space to present results properly.

### LaTeX PDF generation

Reports are also compiled to downloadable PDF via LaTeX:

- **Document class:** `apps/docs/latex/yalumba.cls` — custom branded design with DNA-colored accents, modern typography, colored callout boxes
- **Bibliography:** `apps/docs/latex/references.bib` — shared BibTeX database
- **Build:** `bun run apps/docs/latex/build.ts` (requires `tectonic` — install with `brew install tectonic`)
- **Output:** PDFs go to `apps/docs/public/reports/` and are served as static downloads
- **Each .tex file** lives in `apps/docs/latex/reports/[slug].tex`

The Paper component accepts a `slug` prop to show a "Download PDF" button linking to `/reports/[slug].pdf`.

**Paper design must be BEAUTIFUL** — beyond traditional academic papers:
- DNA-colored gradient bar at top of title page (A=green, C=blue, G=amber, T=red)
- Cyan accent color for links, equation numbers, section underlines
- Colored callout boxes: `keyfinding` (green), `limitation` (amber), `definition` (blue)
- Dark-background code blocks with syntax highlighting
- Professional booktabs tables with dark header rows
- Branded header/footer with "yalumba" and page numbers
- Everything rigorous for a scientific paper but the design taken to the next level

---

## Milestone roadmap

### Foundation (complete)

1. **FASTQ parser** — streaming, validation, statistics ✅
2. **DNA encoding** — 2-bit packing, reverse complement ✅
3. **K-mer engine** — extraction, rolling hash, index ✅
4. **Similarity metrics** — Jaccard, MinHash ✅
5. **Segment detection** — shared k-mer runs, IBD approximation ✅
6. **Variant representation** — mismatch detection, VCF records ✅

### Track A — practical baseline (complete)

7. **Rare-Run P90** — gold standard for threshold kinship (+583% sep, +300% gap) ✅

### Track B — symbiogenesis program (active)

8. **Module extraction** — k-mer co-occurrence graphs → connected components ✅
9. **Module Persistence v3** — rarity-weighted shared module scoring (+3.36% sep, +0.13% gap, PASSES) ✅
10. **Coalition Transfer v3** — coalition co-occurrence scoring (+1.97% sep, +0.06% gap, PASSES) ✅
11. **Module Stability v4** — bootstrap resampling, continuous weighting (FAILS — coverage confound) ✅
12. **Spectral Ecology v2** — dense co-occurrence graphs, Laplacian eigendecomposition, heat kernel, ecological roles, null model deconfounding (+1.01% sep, iterating) ← **current**

### Future

13. **Multi-layer ecosystem graphs** — motif compatibility + module similarity + coalition affinity + perturbation response
14. **Persistent homology** — topological invariants from simplicial co-occurrence complexes
15. **Optimal transport** — Wasserstein/Gromov-Wasserstein distance between ecosystem distributions
16. **GPU spectral kernels** — eigendecomposition and heat kernel on GPU via SPIR-V
17. **Browser compatibility** — WebGPU backend, WASM fallback
