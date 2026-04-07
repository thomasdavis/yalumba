# yalumba

A vertically integrated genomics compute engine built entirely from scratch.

FASTQ parsing, DNA encoding, k-mer indexing, sequence alignment, relatedness estimation — all the way down to custom GPU kernels. No external bioinformatics libraries. TypeScript orchestration on Bun, with a C/SPIR-V pipeline for GPU acceleration.

```
FASTQ file → parse → encode → k-mer index → comparison → segment detection → relatedness metrics
```

## Why?

This project exists to build deep understanding of genomics computation by implementing every layer from scratch. Each package is independently usable — pull in just the FASTQ parser, or just the k-mer engine, or the whole stack.

The kind of experiment that produces new tooling.

## Quick start

```bash
# Install dependencies
bun install

# Run the playground (parses sample FASTQ, encodes DNA, extracts k-mers)
bun run apps/playground/src/index.ts

# Generate synthetic family data
bun run packages/tooling/generate-family.ts

# Parse a FASTQ file
bun run apps/cli/src/index.ts -- parse data/synthetic/parent_a.fastq

# Compare two genomes
bun run apps/cli/src/index.ts -- compare data/synthetic/child_1.fastq data/synthetic/child_2.fastq

# Detect shared segments
bun run apps/cli/src/index.ts -- segments data/synthetic/parent_a.fastq data/synthetic/child_1.fastq

# Run benchmarks
bun run apps/benchmark/src/index.ts
```

## Packages

| Package | Description |
|---------|-------------|
| `@yalumba/fastq` | Streaming FASTQ parser with validation and statistics |
| `@yalumba/genome` | DNA encoding — 2-bit packing, reverse complement, base operations |
| `@yalumba/kmer` | K-mer extraction, rolling hash (Rabin-Karp), k-mer index |
| `@yalumba/alignment` | Jaccard similarity, MinHash signatures, Needleman-Wunsch alignment |
| `@yalumba/relatedness` | Shared segment detection, IBD estimation, centimorgan approximation |
| `@yalumba/vcf` | Variant calling (SNPs), VCF-like record representation |
| `@yalumba/gpu` | GPU buffer management, device abstraction, kernel dispatch |
| `@yalumba/spirv` | SPIR-V intermediate representation, builder DSL, C code generation |
| `@yalumba/runtime` | Pipeline orchestration, environment detection |
| `@yalumba/io` | Chunked file reading, buffer pools |
| `@yalumba/compression` | Gzip detection and decompression |
| `@yalumba/math` | Bitset, popcount, statistics |

## Apps

| App | Description |
|-----|-------------|
| `apps/cli` | Command-line interface — `parse`, `kmer`, `compare`, `segments` |
| `apps/playground` | Interactive experimentation script |
| `apps/benchmark` | Performance benchmarks for core operations |

## Architecture

```
apps/
  cli/              Command-line interface
  playground/       Interactive experiments
  benchmark/        Performance benchmarks

packages/
  fastq/            FASTQ parser
  genome/           DNA encoding
  kmer/             K-mer engine
  alignment/        Similarity & alignment
  relatedness/      Segment detection & relatedness
  vcf/              Variant representation
  gpu/              GPU abstraction
  spirv/            SPIR-V IR & codegen
  runtime/          Pipeline orchestration
  io/               File I/O
  compression/      Gzip support
  math/             Numeric utilities
  native/           C reference kernels & SPIR-V tooling
  tooling/          Dev scripts & data generators
```

### Dependency graph

```
math ← genome ← fastq
              ← kmer ← alignment ← relatedness
              ← vcf
math ← gpu ← runtime
io (standalone)
compression (standalone)
spirv (standalone)
```

### GPU pipeline

The GPU compute path flows through a custom pipeline:

```
TypeScript DSL (SpirVBuilder)
  → SPIR-V IR (SpirVModule)
  → C code generation (CCodegen)
  → SPIR-V binary compilation
  → GPU dispatch (KernelDispatcher)
```

Every kernel has a CPU fallback. The native C implementations in `packages/native/kernels/` serve as reference implementations and FFI acceleration targets. Browser support via WebGPU is a future target.

## DNA encoding

Sequences are packed into 2-bit representation for cache-friendly bulk operations:

```
A = 0b00    C = 0b01    G = 0b10    T = 0b11
```

16 bases per `uint32` word. Complement is `base XOR 0b11`.

## Synthetic data

The family data generator creates FASTQ files for a small family with known relatedness:

```
Parent A ──┬── Parent B
           │
      ┌────┴────┐
    Child 1   Child 2
```

Parents are unrelated. Children inherit 50% from each parent via simulated meiosis with crossover events. This gives ground-truth IBD segments for validating the relatedness pipeline.

```bash
bun run packages/tooling/generate-family.ts
```

## Development

```bash
bun install          # Install dependencies
bun run build        # Build all packages (turbo)
bun run test         # Run all tests
bun run typecheck    # Type-check everything
```

### Constraints

- No external bioinformatics libraries — everything from scratch
- No file over 300 lines
- TypeScript for CPU, C for GPU kernels
- Streaming-first APIs
- Every package independently usable
- Deterministic outputs

## Tech stack

- **Runtime:** Bun
- **Language:** TypeScript (strict), C11
- **Monorepo:** Turborepo + Bun workspaces
- **Modules:** ES modules only
- **Testing:** `bun test`
- **Native:** C11 kernels, GLSL 4.50 compute shaders

## License

MIT
