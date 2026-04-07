import { FastqParser } from "@yalumba/fastq";
import { DnaEncoder } from "@yalumba/genome";
import { KmerExtractor } from "@yalumba/kmer";

function generateFastq(readCount: number, readLength: number): string {
  const bases = "ACGT";
  const lines: string[] = [];

  for (let i = 0; i < readCount; i++) {
    const seq = Array.from({ length: readLength }, () =>
      bases[Math.floor(Math.random() * 4)]
    ).join("");
    const qual = "I".repeat(readLength);
    lines.push(`@read_${i}`, seq, "+", qual);
  }

  return lines.join("\n") + "\n";
}

function bench(name: string, fn: () => void, iterations: number = 10): void {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  console.log(`${name}: avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms`);
}

console.log("=== yalumba benchmarks ===\n");

const READ_COUNT = 10_000;
const READ_LENGTH = 150;

console.log(`Generating ${READ_COUNT} reads of length ${READ_LENGTH}...`);
const fastqData = generateFastq(READ_COUNT, READ_LENGTH);
console.log(`Generated ${(fastqData.length / 1024 / 1024).toFixed(1)} MB of FASTQ data\n`);

const parser = new FastqParser({ validateSequence: false, validateQuality: false });
bench("FASTQ parse", () => {
  parser.parse(fastqData);
});

const records = parser.parse(fastqData);
const encoder = new DnaEncoder();
bench("DNA encode", () => {
  for (const rec of records) {
    encoder.pack(rec.sequence);
  }
});

const extractor = new KmerExtractor({ k: 21 });
bench("K-mer extract", () => {
  for (const rec of records) {
    for (const _kmer of extractor.iterate(rec.sequence)) {
      // consume iterator
    }
  }
});

console.log("\nDone.");
