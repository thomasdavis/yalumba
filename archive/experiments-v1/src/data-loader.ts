import { join } from "path";
import { existsSync } from "fs";
import { FastqParser } from "@yalumba/fastq";
import type { SampleData, SampleDef, DatasetDef } from "./types.js";

const ROOT = join(import.meta.dir, "../../../");

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

/** Load all samples for a dataset */
export async function loadDataset(
  dataset: DatasetDef,
): Promise<Map<string, SampleData>> {
  const samples = new Map<string, SampleData>();
  for (const def of dataset.samples) {
    process.stdout.write(`  Loading ${def.id} (${def.role})... `);
    const start = performance.now();
    const sample = await loadSample(dataset.dataDir, def, dataset.maxReads);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    samples.set(def.id, sample);
    console.log(`${sample.reads.length.toLocaleString()} reads (${elapsed}s)`);
  }
  return samples;
}

// ── Dataset definitions ──

export const GIAB_TRIO: DatasetDef = {
  id: "giab-ashkenazi-trio",
  name: "GIAB Ashkenazi Trio (HG002/HG003/HG004)",
  dataDir: join(ROOT, "data/giab"),
  maxReads: 2_000_000,
  samples: [
    { id: "HG003", role: "Father", file: "HG003_R1.fastq.gz" },
    { id: "HG004", role: "Mother", file: "HG004_R1.fastq.gz" },
    { id: "HG002", role: "Son", file: "HG002_R1.fastq.gz" },
  ],
  pairs: [
    { a: "HG003", b: "HG004", label: "Unrelated spouses", related: false },
    { a: "HG003", b: "HG002", label: "Father ↔ Son", related: true },
    { a: "HG004", b: "HG002", label: "Mother ↔ Son", related: true },
  ],
};

export const SYNTHETIC_FAMILY: DatasetDef = {
  id: "synthetic-family",
  name: "Synthetic Family (2 parents, 2 children)",
  dataDir: join(ROOT, "data/synthetic"),
  maxReads: 2_000,
  samples: [
    { id: "parent_a", role: "Parent A", file: "parent_a.fastq" },
    { id: "parent_b", role: "Parent B", file: "parent_b.fastq" },
    { id: "child_1", role: "Child 1", file: "child_1.fastq" },
    { id: "child_2", role: "Child 2", file: "child_2.fastq" },
  ],
  pairs: [
    { a: "parent_a", b: "parent_b", label: "Unrelated spouses", related: false },
    { a: "parent_a", b: "child_1", label: "Parent A ↔ Child 1", related: true },
    { a: "parent_a", b: "child_2", label: "Parent A ↔ Child 2", related: true },
    { a: "parent_b", b: "child_1", label: "Parent B ↔ Child 1", related: true },
    { a: "parent_b", b: "child_2", label: "Parent B ↔ Child 2", related: true },
    { a: "child_1", b: "child_2", label: "Child 1 ↔ Child 2 (siblings)", related: true },
  ],
};

export const CEPH_1463: DatasetDef = {
  id: "ceph-1463-6member",
  name: "CEPH 1463 Pedigree — 6 members, 3 generations (NYGC 30x, 150bp)",
  dataDir: join(ROOT, "data/ceph-6"),
  maxReads: 2_000_000,
  samples: [
    // Generation 1 — Grandparents
    { id: "NA12889", role: "Pat. grandfather", file: "NA12889_R1.fastq.gz" },
    { id: "NA12890", role: "Pat. grandmother", file: "NA12890_R1.fastq.gz" },
    { id: "NA12891", role: "Mat. grandfather", file: "NA12891_R1.fastq.gz" },
    { id: "NA12892", role: "Mat. grandmother", file: "NA12892_R1.fastq.gz" },
    // Generation 2 — Parents
    { id: "NA12877", role: "Father", file: "NA12877_R1.fastq.gz" },
    { id: "NA12878", role: "Mother", file: "NA12878_R1.fastq.gz" },
  ],
  pairs: [
    // Unrelated pairs (spouses / in-laws)
    { a: "NA12877", b: "NA12878", label: "Father ↔ Mother (spouses)", related: false },
    { a: "NA12889", b: "NA12891", label: "Pat.GF ↔ Mat.GF (unrelated)", related: false },
    { a: "NA12890", b: "NA12892", label: "Pat.GM ↔ Mat.GM (unrelated)", related: false },
    { a: "NA12889", b: "NA12892", label: "Pat.GF ↔ Mat.GM (unrelated)", related: false },
    // Parent-child (G1 → G2, ~50% IBD)
    { a: "NA12889", b: "NA12877", label: "Pat.GF ↔ Father (parent-child)", related: true },
    { a: "NA12890", b: "NA12877", label: "Pat.GM ↔ Father (parent-child)", related: true },
    { a: "NA12891", b: "NA12878", label: "Mat.GF ↔ Mother (parent-child)", related: true },
    { a: "NA12892", b: "NA12878", label: "Mat.GM ↔ Mother (parent-child)", related: true },
    // In-law (unrelated — married into family)
    { a: "NA12889", b: "NA12878", label: "Pat.GF ↔ Mother (in-law)", related: false },
    { a: "NA12891", b: "NA12877", label: "Mat.GF ↔ Father (in-law)", related: false },
  ],
};

/** All available datasets */
export const ALL_DATASETS: DatasetDef[] = [GIAB_TRIO, CEPH_1463, SYNTHETIC_FAMILY];

// Legacy exports for backward compatibility
export const GIAB_SAMPLES = GIAB_TRIO.samples;
export const GIAB_PAIRS = GIAB_TRIO.pairs;
