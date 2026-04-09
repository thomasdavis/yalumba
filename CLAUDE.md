# CLAUDE.md — yalumba

> A vertically integrated genomics compute engine.
> FASTQ → alignment → relatedness metrics.
> TypeScript orchestration with custom GPU kernels.

---

## What is yalumba?

A monorepo containing a complete genomics compute stack built from scratch. No external bioinformatics libraries — every parser, algorithm, and kernel is hand-written. The goal is deep understanding and beautiful packaging, not wrapping existing tools.

The stack flows:

```
FASTQ file → parse → encode → k-mer index → comparison → segment detection → relatedness metrics
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
│   ├── playground/     # Interactive experimentation script
│   └── benchmark/      # Performance benchmarks
├── packages/
│   ├── fastq/          # FASTQ parser — streaming, validation, statistics
│   ├── genome/         # DNA encoding — 2-bit packing, base ops, reverse complement
│   ├── kmer/           # K-mer extraction, rolling hash, k-mer index
│   ├── alignment/      # Jaccard similarity, MinHash, Needleman-Wunsch
│   ├── relatedness/    # Shared segments, IBD estimation, centimorgan approximation
│   ├── vcf/            # Variant representation — SNP calling, VCF records
│   ├── gpu/            # GPU buffer management, device abstraction, kernel dispatch
│   ├── spirv/          # SPIR-V IR, builder DSL, C code generation
│   ├── runtime/        # Pipeline orchestration, environment detection
│   ├── io/             # Chunked file reading, buffer pools
│   ├── compression/    # Gzip detection and decompression
│   ├── math/           # Bitset, popcount, statistics
│   └── native/         # C/SPIR-V code (not a TS package — not in workspaces)
│       ├── spirv-compiler/ # C tool: GLSL → SPIR-V compilation
│       ├── gpu-runtime/    # C library: Vulkan compute dispatch
│       └── kernels/        # C reference implementations + GLSL compute shaders
│   └── tooling/        # Dev scripts (data generators, etc.)
└── data/               # Generated data (gitignored FASTQ files)
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

The docs app is deployed to **Vercel on the `thomasdavis` account**. Push to main triggers automatic deployment.

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

1. **Hypothesize** — propose a new algorithm based on biological insight
2. **Implement** — create a file in `packages/experiments/src/algorithms/` implementing the `Experiment` interface
3. **Register** — add to `algorithms/index.ts` barrel export and `ALL_EXPERIMENTS` array
4. **Benchmark** — run `bun run packages/experiments/src/run.ts` (defaults to CEPH 1463 — the hardest dataset)
5. **Evaluate** — check leaderboard for separation, weakest-pair gap, timing
6. **Document** — update results page and write a report in `apps/docs/src/app/reports/`
7. **Deploy** — `cd apps/docs && vercel --prod` to publish to https://yalumba.vercel.app

### Adding a new algorithm

```typescript
// packages/experiments/src/algorithms/my-algorithm.ts
import type { Experiment, SampleData, ExperimentScore } from "../types.js";

export const myAlgorithm: Experiment = {
  name: "My algorithm",
  version: 1,  // bump to invalidate cache
  description: "What it does",
  maxReadsPerSample: 100_000,
  compare(a, b) {
    return { score: 0.95, detail: "metrics" };
  },
};
```

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

---

## Milestone roadmap

1. **FASTQ parser** — streaming, validation, statistics ✅
2. **DNA encoding** — 2-bit packing, reverse complement ✅
3. **K-mer engine** — extraction, rolling hash, index ✅
4. **Similarity metrics** — Jaccard, MinHash ✅
5. **Segment detection** — shared k-mer runs, IBD approximation ✅
6. **GPU kernel execution** — offload k-mer hashing (stub ready)
7. **Variant representation** — mismatch detection, VCF records ✅
8. **Real dataset validation** — test against known relatedness data
9. **Browser compatibility** — WebGPU backend, WASM fallback
10. **Graph genome** — variation graphs instead of linear reference
