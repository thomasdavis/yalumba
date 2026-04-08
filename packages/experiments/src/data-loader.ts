import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";
import type { SampleData, SampleDef } from "./types.js";

/** Load reads from a gzipped FASTQ file, filtering N-containing reads */
export async function loadSample(
  dataDir: string,
  def: SampleDef,
  maxReads: number,
): Promise<SampleData> {
  const fullPath = join(dataDir, def.file);
  if (!existsSync(fullPath)) {
    throw new Error(`Sample file not found: ${fullPath}`);
  }

  const compressed = await Bun.file(fullPath).arrayBuffer();
  const decompressed = Bun.gunzipSync(new Uint8Array(compressed));
  const text = new TextDecoder().decode(decompressed);

  const parser = new FastqParser({ validateQuality: false, validateSequence: false });
  const records = parser.parse(text);
  const reads: string[] = [];

  for (const rec of records) {
    if (reads.length >= maxReads) break;
    if (!rec.sequence.includes("N")) {
      reads.push(rec.sequence);
    }
  }

  return { id: def.id, role: def.role, reads };
}

/** Standard GIAB Ashkenazi trio sample definitions */
export const GIAB_SAMPLES: SampleDef[] = [
  { id: "HG003", role: "Father", file: "HG003_R1.fastq.gz" },
  { id: "HG004", role: "Mother", file: "HG004_R1.fastq.gz" },
  { id: "HG002", role: "Son", file: "HG002_R1.fastq.gz" },
];

/** Standard GIAB trio pair definitions */
export const GIAB_PAIRS = [
  { a: "HG003", b: "HG004", label: "Unrelated spouses", related: false },
  { a: "HG003", b: "HG002", label: "Father ↔ Son", related: true },
  { a: "HG004", b: "HG002", label: "Mother ↔ Son", related: true },
];
