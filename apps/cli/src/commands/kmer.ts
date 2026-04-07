import { FastqParser } from "@yalumba/fastq";
import { KmerIndex } from "@yalumba/kmer";

export async function runKmer(
  files: string[],
  options: Record<string, string>,
): Promise<void> {
  if (files.length === 0) {
    console.error("Error: no input file specified");
    process.exit(1);
  }

  const k = parseInt(options["k"] ?? "21", 10);
  const filePath = files[0]!;
  const text = await Bun.file(filePath).text();

  const parser = new FastqParser();
  const records = parser.parse(text);
  const index = new KmerIndex({ k });

  for (const record of records) {
    index.add(record.sequence);
  }

  console.log(`File: ${filePath}`);
  console.log(`K: ${k}`);
  console.log(`Reads: ${records.length}`);
  console.log(`Distinct k-mers: ${index.size}`);
}
