#!/usr/bin/env bun
import { parseArgs } from "./args.js";
import { runParse } from "./commands/parse.js";
import { runKmer } from "./commands/kmer.js";
import { runCompare } from "./commands/compare.js";
import { runSegments } from "./commands/segments.js";

const USAGE = `
yalumba - genomics compute engine

Usage:
  yalumba <command> [options] <files...>

Commands:
  parse       Parse a FASTQ file and show statistics
  kmer        Build k-mer index and show frequencies
  compare     Compare two FASTQ files (Jaccard similarity)
  segments    Detect shared segments between two genomes

Options:
  --help, -h  Show this help message
  --version   Show version

Examples:
  yalumba parse reads.fastq
  yalumba kmer reads.fastq --k 21
  yalumba compare personA.fastq personB.fastq
  yalumba segments personA.fastq personB.fastq
`.trim();

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.command === undefined) {
    console.log(USAGE);
    process.exit(0);
  }

  switch (args.command) {
    case "parse":
      await runParse(args.files, args.options);
      break;
    case "kmer":
      await runKmer(args.files, args.options);
      break;
    case "compare":
      await runCompare(args.files, args.options);
      break;
    case "segments":
      await runSegments(args.files, args.options);
      break;
    default:
      console.error(`Unknown command: ${args.command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
