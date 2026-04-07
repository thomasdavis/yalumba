import { Section } from "@/components/section";
import { CodeBlock } from "@/components/code-block";

export default function PipelinePage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Pipeline</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Step-by-step walkthrough of the yalumba genomics pipeline.
          Each stage transforms data from raw sequencer output toward
          actionable relatedness metrics.
        </p>
      </header>

      <Section title="Stage 1: FASTQ parsing" id="fastq-parsing">
        <p className="text-[var(--color-text-muted)] mb-4">
          FASTQ is the standard output format from DNA sequencers. Each record
          is exactly 4 lines: a header, the DNA sequence, a separator, and quality scores.
        </p>
        <CodeBlock language="text" code={`@SRR123456.1 HWI-ST1234:100:C1234ACXX:1:1101:1234:2345
ACGTACGTACGTACGTACGTACGTACGTACGTACGT
+
IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII`} />
        <p className="text-[var(--color-text-muted)] mt-4 mb-4">
          The yalumba parser streams these records, validates structure and base
          characters, and computes statistics like GC content and quality distributions.
        </p>
        <CodeBlock language="typescript" code={`import { FastqParser } from "@yalumba/fastq";
import { FastqStreamReader } from "@yalumba/fastq";

// Batch parsing
const parser = new FastqParser({ validateQuality: true });
const records = parser.parse(fastqText);
const stats = parser.stats(records);

// Streaming (for large files)
const stream = new FastqStreamReader();
for await (const batch of stream.fromReadable(fileStream)) {
  for (const record of batch) {
    process(record);
  }
}`} />
      </Section>

      <Section title="Stage 2: DNA encoding" id="dna-encoding">
        <p className="text-[var(--color-text-muted)] mb-4">
          Raw sequence strings are packed into 2-bit representation.
          Each base occupies 2 bits, fitting 16 bases per 32-bit word.
          This is ~4x more compact than ASCII and enables bitwise operations.
        </p>
        <CodeBlock language="typescript" code={`import { DnaEncoder, PackedSequence } from "@yalumba/genome";

const encoder = new DnaEncoder();
const packed = encoder.pack("ACGTACGT");
// A=00, C=01, G=10, T=11 → packed into Uint32Array

const ops = new PackedSequence();
const distance = ops.hammingDistance(packedA, packedB);
const rc = ops.reverseComplement(packed);`} />
      </Section>

      <Section title="Stage 3: K-mer indexing" id="kmer-indexing">
        <p className="text-[var(--color-text-muted)] mb-4">
          K-mers are fixed-length subsequences extracted via sliding window.
          We hash them using a Rabin-Karp rolling polynomial hash with a
          Mersenne prime modulus (2^61 - 1) for uniform distribution.
        </p>
        <CodeBlock language="typescript" code={`import { KmerExtractor, KmerIndex } from "@yalumba/kmer";

const extractor = new KmerExtractor({ k: 21, canonical: true });

// Extract k-mers (iterator for memory efficiency)
for (const kmer of extractor.iterate(sequence)) {
  // kmer.sequence, kmer.position, kmer.hash
}

// Build an index for fast lookup
const index = new KmerIndex({ k: 21 });
index.add(sequenceA);
index.add(sequenceB);
const shared = index.sharedKmerCount(seqA, seqB);`} />
      </Section>

      <Section title="Stage 4: Similarity comparison" id="similarity">
        <p className="text-[var(--color-text-muted)] mb-4">
          We compute similarity between sequences using k-mer set operations.
          Jaccard similarity gives exact results; MinHash gives fast approximations
          for large datasets.
        </p>
        <CodeBlock language="typescript" code={`import { JaccardSimilarity, MinHash } from "@yalumba/alignment";

// Exact Jaccard
const jaccard = new JaccardSimilarity(21);
const result = jaccard.compare(seqA, seqB);
// result.score: 0.155 (siblings), 0.131 (parent-child), 0.0 (unrelated)

// Approximate via MinHash (much faster for large sequences)
const minhash = new MinHash(21, 128);
const sigA = minhash.signature(seqA);
const sigB = minhash.signature(seqB);
const estimate = minhash.estimateSimilarity(sigA, sigB);`} />
      </Section>

      <Section title="Stage 5: Segment detection" id="segments">
        <p className="text-[var(--color-text-muted)] mb-4">
          Shared segments are long runs of matching k-mers between two genomes.
          These approximate Identity-By-Descent (IBD) regions — stretches of DNA
          inherited from a common ancestor without recombination.
        </p>
        <CodeBlock language="typescript" code={`import { SegmentDetector } from "@yalumba/relatedness";

const detector = new SegmentDetector({
  k: 21,
  minRunLength: 50,
  maxGapLength: 5,
});

const segments = detector.detect(seqA, seqB);
// segments[0]: { start: 1500, end: 3200, lengthBp: 1700, lengthCm: 0.0017 }`} />
      </Section>

      <Section title="Stage 6: Relatedness estimation" id="relatedness">
        <p className="text-[var(--color-text-muted)] mb-4">
          Total shared DNA is converted to centimorgans using recombination rate
          estimates (~1 cM per megabase). The kinship coefficient and relationship
          category are derived from total shared centimorgans.
        </p>
        <CodeBlock language="typescript" code={`import { RelatednessCalculator } from "@yalumba/relatedness";

const calc = new RelatednessCalculator(21);
const result = calc.compute(seqA, seqB);

// result.totalSharedCm: 3400+ → "identical"
// result.totalSharedCm: 2500+ → "parent-child"
// result.totalSharedCm: 1700+ → "full-sibling"
// result.totalSharedCm: 1000+ → "half-sibling"
// result.relationship: "full-sibling" | "parent-child" | "unrelated" | ...`} />
      </Section>
    </div>
  );
}
