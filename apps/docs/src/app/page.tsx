import { CodeBlock } from "@/components/code-block";
import { Section } from "@/components/section";
import { Dnastrand } from "@/components/dna-strand";

export default function Home() {
  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <Dnastrand />
        <h1 className="text-4xl font-bold tracking-tight">
          yalumba
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] max-w-2xl">
          A vertically integrated genomics compute engine. Every parser, algorithm,
          and kernel written from scratch in TypeScript and C. From raw FASTQ reads
          to relatedness metrics — no external bioinformatics libraries.
        </p>
      </header>

      <Section title="The pipeline" id="pipeline-overview">
        <p className="text-[var(--color-text-muted)] mb-6">
          yalumba processes genomic data through a series of stages, each implemented
          as an independent package. Data flows from raw sequencer output to actionable
          relatedness metrics.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {[
            { step: "1", label: "Parse FASTQ", desc: "Stream 4-line records from sequencer output", pkg: "@yalumba/fastq" },
            { step: "2", label: "Encode DNA", desc: "Pack bases into 2-bit representation (A=00, C=01, G=10, T=11)", pkg: "@yalumba/genome" },
            { step: "3", label: "Extract k-mers", desc: "Sliding window over sequences, rolling polynomial hash", pkg: "@yalumba/kmer" },
            { step: "4", label: "Compare", desc: "Jaccard similarity, MinHash signatures, Needleman-Wunsch alignment", pkg: "@yalumba/alignment" },
            { step: "5", label: "Detect segments", desc: "Find runs of shared k-mers approximating IBD regions", pkg: "@yalumba/relatedness" },
            { step: "6", label: "Estimate relatedness", desc: "Centimorgan estimation, kinship coefficients, relationship classification", pkg: "@yalumba/relatedness" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-bold text-[var(--color-bg)]">
                {item.step}
              </span>
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
                <div className="mt-1 text-xs text-[var(--color-accent-2)]">{item.pkg}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Quick example" id="quick-example">
        <p className="text-[var(--color-text-muted)] mb-4">
          Parse a FASTQ file and compute statistics in a few lines:
        </p>
        <CodeBlock language="typescript" code={`import { FastqParser } from "@yalumba/fastq";

const text = await Bun.file("reads.fastq").text();
const parser = new FastqParser();
const records = parser.parse(text);
const stats = parser.stats(records);

console.log(stats);
// { recordCount: 2000, totalBases: 300000, averageLength: 150,
//   meanQuality: 23, gcContent: 0.502 }`} />
      </Section>

      <Section title="DNA encoding" id="dna-encoding">
        <p className="text-[var(--color-text-muted)] mb-4">
          Sequences are packed into 2-bit representation for cache-friendly bulk operations.
          16 bases fit in a single 32-bit word. Complement is computed with XOR.
        </p>
        <div className="grid grid-cols-4 gap-2 max-w-xs mb-4">
          {[
            { base: "A", bits: "00", color: "var(--color-dna-a)" },
            { base: "C", bits: "01", color: "var(--color-dna-c)" },
            { base: "G", bits: "10", color: "var(--color-dna-g)" },
            { base: "T", bits: "11", color: "var(--color-dna-t)" },
          ].map((b) => (
            <div key={b.base} className="flex flex-col items-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <span className="text-2xl font-bold" style={{ color: b.color }}>{b.base}</span>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">{b.bits}</span>
            </div>
          ))}
        </div>
        <CodeBlock language="typescript" code={`import { DnaEncoder } from "@yalumba/genome";

const encoder = new DnaEncoder();
const packed = encoder.pack("ACGTACGTACGTACGT");
// packed.data = Uint32Array [one 32-bit word holding all 16 bases]
// packed.length = 16

const original = encoder.unpack(packed);
// "ACGTACGTACGTACGT"`} />
      </Section>

      <Section title="Data sources" id="data-sources">
        <p className="text-[var(--color-text-muted)] mb-4">
          We work with both synthetic and real genomic data.
        </p>
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h4 className="font-medium mb-1">Synthetic family</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              Generated FASTQ files for Parent A, Parent B, Child 1, Child 2.
              Parents are unrelated, children inherit 50% from each via simulated meiosis
              with crossover events. Gives ground-truth IBD segments.
            </p>
            <code className="mt-2 block text-xs text-[var(--color-accent)]">
              bun run packages/tooling/generate-family.ts
            </code>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h4 className="font-medium mb-1">CEPH/Utah family 1463 (1000 Genomes)</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              17-member, 3-generation pedigree. Grandparents, parents, 11 children.
              Exome sequencing data from the International Genome Sample Resource.
              NA12878 (mother), NA12877 (father), NA12891/NA12892 (maternal grandparents),
              NA12889/NA12890 (paternal grandparents).
            </p>
            <code className="mt-2 block text-xs text-[var(--color-accent)]">
              bun run packages/tooling/download-ceph.ts
            </code>
          </div>
        </div>
      </Section>

      <Section title="Architecture" id="architecture">
        <p className="text-[var(--color-text-muted)] mb-4">
          12 independent packages, 4 apps, native C kernels. Every package is independently
          usable — pull in just what you need.
        </p>
        <CodeBlock language="text" code={`packages/
  fastq/          FASTQ parser
  genome/         DNA encoding
  kmer/           K-mer engine
  alignment/      Similarity & alignment
  relatedness/    Segment detection & relatedness
  vcf/            Variant representation
  gpu/            GPU abstraction
  spirv/          SPIR-V IR & codegen
  runtime/        Pipeline orchestration
  io/             File I/O
  compression/    Gzip support
  math/           Numeric utilities
  native/         C reference kernels
  tooling/        Dev scripts`} />
      </Section>
    </div>
  );
}
