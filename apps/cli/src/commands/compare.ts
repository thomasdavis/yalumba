import { FastqParser } from "@yalumba/fastq";
import { JaccardSimilarity } from "@yalumba/alignment";

export async function runCompare(
  files: string[],
  options: Record<string, string>,
): Promise<void> {
  if (files.length < 2) {
    console.error("Error: two input files required");
    process.exit(1);
  }

  const k = parseInt(options["k"] ?? "21", 10);
  const parser = new FastqParser();
  const textA = await Bun.file(files[0]!).text();
  const textB = await Bun.file(files[1]!).text();

  const readsA = parser.parse(textA);
  const readsB = parser.parse(textB);

  const seqA = readsA.map((r) => r.sequence).join("");
  const seqB = readsB.map((r) => r.sequence).join("");

  const jaccard = new JaccardSimilarity(k);
  const result = jaccard.compare(seqA, seqB);

  console.log(`File A: ${files[0]}`);
  console.log(`File B: ${files[1]}`);
  console.log(`Jaccard similarity: ${result.score.toFixed(6)}`);
  console.log(`Shared k-mers: ${result.shared}`);
  console.log(`Union k-mers: ${result.union}`);
}
