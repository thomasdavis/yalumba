import { FastqParser } from "@yalumba/fastq";
import { RelatednessCalculator } from "@yalumba/relatedness";

export async function runSegments(
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

  const calculator = new RelatednessCalculator(k);
  const result = calculator.compute(seqA, seqB);

  console.log(`File A: ${files[0]}`);
  console.log(`File B: ${files[1]}`);
  console.log(`Segments found: ${result.segments.length}`);
  console.log(`Total shared: ${result.totalSharedBp} bp (${result.totalSharedCm.toFixed(2)} cM)`);
  console.log(`Kinship: ${result.kinshipCoefficient.toFixed(6)}`);
  console.log(`Relationship: ${result.relationship}`);

  if (result.segments.length > 0) {
    console.log("\nSegments:");
    for (const seg of result.segments) {
      console.log(`  ${seg.start}-${seg.end} (${seg.lengthBp} bp, ${seg.lengthCm.toFixed(2)} cM)`);
    }
  }
}
