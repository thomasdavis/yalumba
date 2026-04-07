#!/usr/bin/env bun

/**
 * Downloads exome data for the CEPH/Utah family 1463 from
 * the International Genome Sample Resource (IGSR).
 *
 * Family structure (17 members, 3 generations):
 *
 *   Grandparents:  NA12889+NA12890 (paternal)    NA12891+NA12892 (maternal)
 *                       |                                |
 *   Parents:         NA12877 (father)    ────    NA12878 (mother)
 *                                 |
 *   Children:     NA12879, NA12880, NA12881, NA12882, NA12883,
 *                 NA12884, NA12885, NA12886, NA12887, NA12888, NA12893
 *
 * This script downloads a practical subset: the core trio + maternal
 * grandparents + two children (6 members covering 3 generations).
 *
 * Data format: exome CRAM files from 1000 Genomes / IGSR
 * These need samtools to convert to FASTQ.
 *
 * Total download: ~30-40 GB for 6 members
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(import.meta.dir, "../../data/ceph");

const BASE_URL =
  "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000_genomes_project/data/CEU";

interface FamilyMember {
  readonly sampleId: string;
  readonly role: string;
  readonly generation: number;
}

/**
 * Subset of CEPH 1463 for practical analysis.
 * Covers parent-child, grandparent-grandchild, and sibling relationships.
 */
const FAMILY_SUBSET: FamilyMember[] = [
  { sampleId: "NA12891", role: "maternal_grandfather", generation: 1 },
  { sampleId: "NA12892", role: "maternal_grandmother", generation: 1 },
  { sampleId: "NA12878", role: "mother", generation: 2 },
  { sampleId: "NA12877", role: "father", generation: 2 },
  { sampleId: "NA12879", role: "child_1", generation: 3 },
  { sampleId: "NA12880", role: "child_2", generation: 3 },
];

function cramUrl(sampleId: string): string {
  return `${BASE_URL}/${sampleId}/exome_alignment/${sampleId}.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram`;
}

function craiUrl(sampleId: string): string {
  return cramUrl(sampleId) + ".crai";
}

async function downloadFile(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) {
    console.log(`  SKIP ${dest} (already exists)`);
    return;
  }

  console.log(`  GET  ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const buffer = await response.arrayBuffer();
  await Bun.write(dest, buffer);
  const sizeMb = (buffer.byteLength / 1024 / 1024).toFixed(1);
  console.log(`  DONE ${dest} (${sizeMb} MB)`);
}

async function main(): Promise<void> {
  console.log("=== yalumba CEPH family 1463 downloader ===\n");
  console.log("Source: International Genome Sample Resource (IGSR)");
  console.log("ENA project: ERP001960\n");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Downloading exome CRAMs for family subset:\n");

  for (const member of FAMILY_SUBSET) {
    console.log(`${member.sampleId} — ${member.role} (gen ${member.generation})`);
    const cramDest = join(OUTPUT_DIR, `${member.sampleId}.cram`);
    const craiDest = join(OUTPUT_DIR, `${member.sampleId}.cram.crai`);

    await downloadFile(cramUrl(member.sampleId), cramDest);
    await downloadFile(craiUrl(member.sampleId), craiDest);
    console.log();
  }

  console.log("--- Next steps ---\n");
  console.log("Convert CRAM to FASTQ using samtools:");
  console.log();
  for (const member of FAMILY_SUBSET) {
    const cram = `data/ceph/${member.sampleId}.cram`;
    const fq = `data/ceph/${member.sampleId}.fastq.gz`;
    console.log(`  samtools fastq -@ 4 ${cram} > ${fq}`);
  }
  console.log();
  console.log("Note: CRAM files require a reference genome (GRCh38) for conversion.");
  console.log("samtools will attempt to download it automatically via the REF_PATH.");
  console.log();

  console.log("Pedigree relationships in this subset:");
  console.log("  NA12891 + NA12892 → NA12878 (parent-child, ~3400 cM)");
  console.log("  NA12877 + NA12878 → NA12879, NA12880 (parent-child, ~3400 cM)");
  console.log("  NA12879 ↔ NA12880 (full siblings, ~2550 cM)");
  console.log("  NA12891 → NA12879 (grandparent-grandchild, ~1700 cM)");
  console.log("  NA12877 ↔ NA12878 (unrelated spouses, ~0 cM)");
}

main().catch((err) => {
  console.error("Download failed:", err);
  process.exit(1);
});
