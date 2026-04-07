import { FastqParser } from "@yalumba/fastq";

export async function runParse(
  files: string[],
  _options: Record<string, string>,
): Promise<void> {
  if (files.length === 0) {
    console.error("Error: no input file specified");
    process.exit(1);
  }

  const filePath = files[0]!;
  const text = await Bun.file(filePath).text();
  const parser = new FastqParser();
  const records = parser.parse(text);
  const stats = parser.stats(records);

  console.log(`File: ${filePath}`);
  console.log(`Records: ${stats.recordCount}`);
  console.log(`Total bases: ${stats.totalBases}`);
  console.log(`Avg length: ${stats.averageLength.toFixed(1)}`);
  console.log(`Min length: ${stats.minLength}`);
  console.log(`Max length: ${stats.maxLength}`);
  console.log(`Mean quality: ${stats.meanQuality.toFixed(1)}`);
  console.log(`GC content: ${(stats.gcContent * 100).toFixed(1)}%`);
}
