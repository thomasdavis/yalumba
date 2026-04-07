import { Section } from "@/components/section";

const packages = [
  {
    name: "@yalumba/fastq",
    description: "Streaming FASTQ parser with validation and statistics",
    files: ["parser.ts", "stream.ts", "validator.ts", "types.ts"],
    exports: ["FastqParser", "FastqStreamReader", "FastqValidator"],
  },
  {
    name: "@yalumba/genome",
    description: "DNA encoding — 2-bit packing, reverse complement, base operations",
    files: ["encoding.ts", "packed.ts", "bases.ts", "types.ts"],
    exports: ["DnaEncoder", "PackedSequence", "BaseUtils"],
  },
  {
    name: "@yalumba/kmer",
    description: "K-mer extraction, rolling hash (Rabin-Karp), k-mer index",
    files: ["extractor.ts", "rolling-hash.ts", "kmer-index.ts", "types.ts"],
    exports: ["KmerExtractor", "RollingHash", "KmerIndex"],
  },
  {
    name: "@yalumba/alignment",
    description: "Jaccard similarity, MinHash signatures, Needleman-Wunsch alignment",
    files: ["jaccard.ts", "minhash.ts", "needleman-wunsch.ts", "types.ts"],
    exports: ["JaccardSimilarity", "MinHash", "NeedlemanWunsch"],
  },
  {
    name: "@yalumba/relatedness",
    description: "Shared segment detection, IBD estimation, centimorgan approximation",
    files: ["segments.ts", "centimorgan.ts", "calculator.ts", "types.ts"],
    exports: ["SegmentDetector", "CentimorganEstimator", "RelatednessCalculator"],
  },
  {
    name: "@yalumba/vcf",
    description: "Variant calling (SNPs), VCF-like record representation",
    files: ["caller.ts", "record.ts", "types.ts"],
    exports: ["VariantCaller", "VariantRecord"],
  },
  {
    name: "@yalumba/gpu",
    description: "GPU buffer management, device abstraction, kernel dispatch",
    files: ["device.ts", "buffer.ts", "dispatch.ts", "types.ts"],
    exports: ["GpuDevice", "GpuBuffer", "KernelDispatcher"],
  },
  {
    name: "@yalumba/spirv",
    description: "SPIR-V intermediate representation, builder DSL, C code generation",
    files: ["module.ts", "builder.ts", "codegen.ts", "types.ts"],
    exports: ["SpirVModule", "SpirVBuilder", "CCodegen"],
  },
  {
    name: "@yalumba/runtime",
    description: "Pipeline orchestration, environment detection",
    files: ["pipeline.ts", "environment.ts"],
    exports: ["Pipeline", "Environment"],
  },
  {
    name: "@yalumba/io",
    description: "Chunked file reading, buffer pools",
    files: ["chunk-reader.ts", "buffer-pool.ts"],
    exports: ["ChunkReader", "BufferPool"],
  },
  {
    name: "@yalumba/compression",
    description: "Gzip detection and decompression",
    files: ["gzip-detect.ts", "decompress.ts"],
    exports: ["GzipDetector", "DecompressionStream"],
  },
  {
    name: "@yalumba/math",
    description: "Bitset, popcount, statistics",
    files: ["bitset.ts", "popcount.ts", "statistics.ts"],
    exports: ["BitSet", "PopCount", "Statistics"],
  },
];

export default function PackagesPage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Packages</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Every package is independently usable. Pull in just the FASTQ parser,
          or just the k-mer engine, or the whole stack.
        </p>
      </header>

      <Section title="All packages" id="all-packages">
        <div className="space-y-4">
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-mono text-sm font-bold text-[var(--color-accent)]">
                  {pkg.name}
                </h3>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] mb-3">{pkg.description}</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {pkg.exports.map((exp) => (
                  <span
                    key={exp}
                    className="rounded bg-[var(--color-surface-2)] px-2 py-0.5 text-xs font-mono"
                  >
                    {exp}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {pkg.files.map((file) => (
                  <span
                    key={file}
                    className="text-xs text-[var(--color-text-muted)]"
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
