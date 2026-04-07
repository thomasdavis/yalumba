import { FastqParser } from "@yalumba/fastq";
import { DnaEncoder } from "@yalumba/genome";
import { KmerExtractor } from "@yalumba/kmer";

const SEQ1 = "ACGTACGTACGTACGTACGTACGTACGT";
const SEQ2 = "TGCATGCATGCATGCATGCATGCATGCA";

const SAMPLE_FASTQ = [
  `@read1 sample read`,
  SEQ1,
  `+`,
  "I".repeat(SEQ1.length),
  `@read2 another read`,
  SEQ2,
  `+`,
  "I".repeat(SEQ2.length),
  "",
].join("\n");

console.log("=== yalumba playground ===\n");

const parser = new FastqParser();
const records = parser.parse(SAMPLE_FASTQ);
const stats = parser.stats(records);

console.log("FASTQ Stats:", stats);

const encoder = new DnaEncoder();
const packed = encoder.pack(records[0]!.sequence);
const unpacked = encoder.unpack(packed);
console.log("\nPacked/unpacked:", records[0]!.sequence === unpacked ? "OK" : "MISMATCH");

const extractor = new KmerExtractor({ k: 11 });
const kmers = extractor.extract(records[0]!.sequence);
console.log(`\nK-mers (k=11): ${kmers.length} extracted`);
console.log("First 3:", kmers.slice(0, 3).map((k) => k.sequence));
