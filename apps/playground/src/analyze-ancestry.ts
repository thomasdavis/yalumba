#!/usr/bin/env bun

/**
 * AncestryDNA → yalumba analysis bridge.
 *
 * Converts genotype data (rsid/chr/pos/allele1/allele2) into pseudo-reads
 * by sliding a window across consecutive alleles per chromosome, then runs
 * every symbiogenesis algorithm's prepare phase + spectral ecosystem analysis.
 */

import { readFileSync } from "fs";
import { KmerExtractor } from "@yalumba/kmer";
import { extractMotifs, buildModules } from "@yalumba/modules";
import {
  buildInteractionGraph,
  normalizedLaplacian,
  eigenDecomposition,
  computeHeatKernel,
  assignRoles,
  computeRoleSpectrum,
  buildEcosystemSignature,
} from "@yalumba/ecology";
import { Statistics, InformationTheory } from "@yalumba/math";

// ── Parse AncestryDNA ──

interface Genotype {
  rsid: string;
  chr: number;
  pos: number;
  a1: string;
  a2: string;
}

function parseAncestryDNA(path: string): Genotype[] {
  const raw = readFileSync(path, "utf-8");
  const lines = raw.split("\n");
  const genotypes: Genotype[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("rsid") || line.trim() === "") continue;
    const parts = line.replace(/\r/, "").split("\t");
    if (parts.length < 5) continue;
    const a1 = parts[3]!.trim();
    const a2 = parts[4]!.trim();
    if (a1 === "0" || a2 === "0") continue; // no-call
    if (a1 === "D" || a1 === "I" || a2 === "D" || a2 === "I") continue; // indel
    genotypes.push({
      rsid: parts[0]!,
      chr: parseInt(parts[1]!, 10),
      pos: parseInt(parts[2]!, 10),
      a1,
      a2,
    });
  }
  return genotypes;
}

// ── Convert genotypes to pseudo-reads ──

function genotypesToReads(genotypes: Genotype[], readLen: number = 150, step: number = 50): string[] {
  // Group by chromosome, sorted by position
  const byChr = new Map<number, Genotype[]>();
  for (const g of genotypes) {
    if (g.chr > 22) continue; // autosomes only
    const arr = byChr.get(g.chr) ?? [];
    arr.push(g);
    byChr.set(g.chr, arr);
  }

  const reads: string[] = [];

  for (const [, chrGenos] of byChr) {
    chrGenos.sort((a, b) => a.pos - b.pos);

    // Build two "haplotype" strings from allele1 and allele2
    const hap1 = chrGenos.map((g) => g.a1).join("");
    const hap2 = chrGenos.map((g) => g.a2).join("");

    // Slide a window to create pseudo-reads
    for (const hap of [hap1, hap2]) {
      for (let i = 0; i <= hap.length - readLen; i += step) {
        reads.push(hap.slice(i, i + readLen));
      }
    }
  }

  return reads;
}

// ── Main analysis ──

async function main() {
  const path = process.argv[2] ?? "/Users/ajaxdavis/Downloads/AncestryDNA.txt";

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   YALUMBA — AncestryDNA Ecosystem Analysis                     ║");
  console.log("║   Subject: Lisa Watts                                           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // ── Phase 1: Parse ──
  console.log("── PHASE 1: Parse AncestryDNA ──");
  const t0 = performance.now();
  const genotypes = parseAncestryDNA(path);
  const parseMs = performance.now() - t0;
  console.log(`  Parsed ${genotypes.length.toLocaleString()} genotypes in ${parseMs.toFixed(0)}ms`);

  // Basic stats
  const autosomes = genotypes.filter((g) => g.chr <= 22);
  const het = autosomes.filter((g) => g.a1 !== g.a2).length;
  const hom = autosomes.filter((g) => g.a1 === g.a2).length;
  console.log(`  Autosomes: ${autosomes.length.toLocaleString()}`);
  console.log(`  Het: ${het.toLocaleString()} (${((het / autosomes.length) * 100).toFixed(1)}%)`);
  console.log(`  Hom: ${hom.toLocaleString()} (${((hom / autosomes.length) * 100).toFixed(1)}%)`);
  console.log(`  Het/Hom: ${(het / hom).toFixed(3)}\n`);

  // ── Phase 2: Generate pseudo-reads ──
  console.log("── PHASE 2: Generate pseudo-reads ──");
  const t1 = performance.now();
  const reads = genotypesToReads(genotypes, 150, 50);
  const readMs = performance.now() - t1;
  console.log(`  Generated ${reads.length.toLocaleString()} pseudo-reads (150bp, step 50) in ${readMs.toFixed(0)}ms`);
  console.log(`  Total bases: ${(reads.length * 150).toLocaleString()}`);

  // ── Phase 3: K-mer analysis ──
  console.log("\n── PHASE 3: K-mer analysis ──");
  const kmerK = 11; // shorter k since our "alphabet" is only ACGT alleles
  const extractor = new KmerExtractor({ k: kmerK, canonical: true });
  const kmerFreqs = new Map<bigint, number>();
  const maxReadsForKmer = Math.min(reads.length, 50_000);

  const t2 = performance.now();
  for (let i = 0; i < maxReadsForKmer; i++) {
    for (const kmer of extractor.extract(reads[i]!)) {
      kmerFreqs.set(kmer.hash, (kmerFreqs.get(kmer.hash) ?? 0) + 1);
    }
  }
  const kmerMs = performance.now() - t2;

  console.log(`  K-mer size: ${kmerK}`);
  console.log(`  Reads analyzed: ${maxReadsForKmer.toLocaleString()}`);
  console.log(`  Distinct k-mers: ${kmerFreqs.size.toLocaleString()}`);
  console.log(`  Time: ${(kmerMs / 1000).toFixed(1)}s`);

  // K-mer frequency distribution
  const freqValues = [...kmerFreqs.values()];
  let freqMax = 0;
  let freqSum = 0;
  let singletons = 0;
  for (const f of freqValues) {
    freqSum += f;
    if (f > freqMax) freqMax = f;
    if (f === 1) singletons++;
  }
  const freqStats = { mean: freqSum / freqValues.length, max: freqMax, singletons };
  console.log(`  Mean frequency: ${freqStats.mean.toFixed(1)}`);
  console.log(`  Max frequency: ${freqStats.max}`);
  console.log(`  Singletons: ${freqStats.singletons.toLocaleString()} (${((freqStats.singletons / freqValues.length) * 100).toFixed(1)}%)`);

  // K-mer entropy
  const totalKmers = freqValues.reduce((a, b) => a + b, 0);
  const kmerProbs = freqValues.map((f) => f / totalKmers);
  const kmerEntropy = -kmerProbs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const maxEntropy = Math.log2(freqValues.length);
  console.log(`  K-mer entropy: ${kmerEntropy.toFixed(2)} bits (max: ${maxEntropy.toFixed(2)})`);
  console.log(`  Entropy ratio: ${(kmerEntropy / maxEntropy).toFixed(4)} (1.0 = uniform)`);

  // ── Phase 4: Module extraction ──
  console.log("\n── PHASE 4: Module extraction ──");
  const maxReadsForModules = Math.min(reads.length, 30_000);
  const moduleReads = reads.slice(0, maxReadsForModules);

  const t3 = performance.now();
  const motifSet = new Set<number>();
  for (const read of moduleReads) {
    for (const m of extractMotifs(read)) motifSet.add(m);
  }
  const motifMs = performance.now() - t3;
  console.log(`  Motifs extracted: ${motifSet.size.toLocaleString()} distinct (from ${maxReadsForModules.toLocaleString()} reads) in ${(motifMs / 1000).toFixed(1)}s`);

  const t4 = performance.now();
  const modules = buildModules(moduleReads);
  const moduleMs = performance.now() - t4;
  console.log(`  Modules discovered: ${modules.length}`);
  console.log(`  Module extraction time: ${(moduleMs / 1000).toFixed(1)}s`);

  if (modules.length > 0) {
    const moduleSizes = modules.map((m) => m.members.length);
    const moduleSupports = modules.map((m) => m.support);
    console.log(`  Module sizes: min=${Math.min(...moduleSizes)}, max=${Math.max(...moduleSizes)}, mean=${(moduleSizes.reduce((a, b) => a + b, 0) / moduleSizes.length).toFixed(1)}`);
    console.log(`  Module supports: min=${Math.min(...moduleSupports)}, max=${Math.max(...moduleSupports)}, mean=${(moduleSupports.reduce((a, b) => a + b, 0) / moduleSupports.length).toFixed(1)}`);

    // Module cohesion distribution
    const cohesions = modules.map((m) => m.cohesion);
    console.log(`  Cohesion: min=${Math.min(...cohesions).toFixed(3)}, max=${Math.max(...cohesions).toFixed(3)}, mean=${(cohesions.reduce((a, b) => a + b, 0) / cohesions.length).toFixed(3)}`);
  }

  // ── Phase 5: Ecosystem signature ──
  if (modules.length >= 3) {
    console.log("\n── PHASE 5: Ecosystem signature (spectral analysis) ──");
    const t5 = performance.now();

    try {
      // buildInteractionGraph takes reads and internally extracts modules
      const graph = buildInteractionGraph(moduleReads);
      console.log(`  Interaction graph: ${graph.n} nodes`);

      if (graph.n >= 3) {
        const laplacian = normalizedLaplacian(graph.adjacency);
        const eigen = eigenDecomposition(laplacian);
        const eigenMs = performance.now() - t5;
        console.log(`  Eigendecomposition: ${eigen.values.length} eigenvalues in ${(eigenMs / 1000).toFixed(1)}s`);

        // Spectral gap (algebraic connectivity)
        const sortedEigs = [...eigen.values].sort((a, b) => a - b);
        const spectralGap = sortedEigs.length > 1 ? sortedEigs[1]! : 0;
        console.log(`  Spectral gap (λ₂): ${spectralGap.toFixed(6)}`);
        console.log(`  Largest eigenvalue: ${sortedEigs[sortedEigs.length - 1]!.toFixed(6)}`);

        // Spectral entropy
        const eigSum = sortedEigs.reduce((s, v) => s + Math.abs(v), 0);
        if (eigSum > 0) {
          const eigProbs = sortedEigs.map((v) => Math.abs(v) / eigSum);
          const spectralEntropy = -eigProbs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
          console.log(`  Spectral entropy: ${spectralEntropy.toFixed(4)} bits`);
        }

        // Eigenvalue density profile
        console.log(`  Eigenvalue distribution (first 10):`);
        for (let i = 0; i < Math.min(10, sortedEigs.length); i++) {
          const bar = "█".repeat(Math.max(1, Math.round(sortedEigs[i]! * 30)));
          console.log(`    λ${i}: ${sortedEigs[i]!.toFixed(6)} ${bar}`);
        }

        // Heat kernel
        const heatKernel = computeHeatKernel(eigen);
        console.log(`  Heat kernel: ${heatKernel.timescales.length} timescales`);
        console.log(`  Heat traces:`);
        for (let i = 0; i < heatKernel.timescales.length; i++) {
          console.log(`    t=${heatKernel.timescales[i]!.toFixed(2).padStart(7)}: ${heatKernel.traces[i]!.toFixed(6)}`);
        }

        // Ecological roles
        const roles = assignRoles(graph, eigen);
        const roleSpectrum = computeRoleSpectrum(roles);
        console.log(`  Ecological roles:`);
        for (const [role, count] of Object.entries(roleSpectrum)) {
          if (typeof count === "number" && count > 0) {
            console.log(`    ${role}: ${count}`);
          }
        }

        // Full ecosystem signature
        const sig = buildEcosystemSignature("lisa-watts", graph, modules);
        console.log(`\n  ── Full Ecosystem Signature ──`);
        console.log(`  Graph nodes:           ${sig.graphNodes}`);
        console.log(`  Spectral gap:          ${sig.spectralGap.toFixed(6)}`);
        console.log(`  Spectral entropy:      ${sig.spectralEntropy.toFixed(6)}`);
        console.log(`  Graph energy:          ${sig.graphEnergy.toFixed(6)}`);
        console.log(`  Deconfounded entropy:  ${sig.deconfoundedEntropy.toFixed(6)}`);

        if (sig.diffusionDistributions) {
          console.log(`  Diffusion distributions: ${sig.diffusionDistributions.length} timescales`);
        }
        if (sig.localizationStats) {
          console.log(`  Eigenvector localization:`);
          console.log(`    Mean IPR:  ${sig.localizationStats.meanIPR.toFixed(6)}`);
          console.log(`    Max IPR:   ${sig.localizationStats.maxIPR.toFixed(6)}`);
          console.log(`    Min IPR:   ${sig.localizationStats.minIPR.toFixed(6)}`);
        }
        if (sig.eigenvalueDensity) {
          console.log(`  Eigenvalue density: ${sig.eigenvalueDensity.length} bins`);
        }
      }
    } catch (err) {
      console.log(`  Spectral analysis error: ${err}`);
    }
  }

  // ── Phase 6: Per-chromosome ecosystem analysis ──
  console.log("\n── PHASE 6: Per-chromosome structural profile ──");
  const byChr = new Map<number, Genotype[]>();
  for (const g of genotypes) {
    if (g.chr > 22) continue;
    const arr = byChr.get(g.chr) ?? [];
    arr.push(g);
    byChr.set(g.chr, arr);
  }

  console.log(`${"Chr".padStart(4)} ${"SNPs".padStart(7)} ${"Het%".padStart(6)} ${"Modules".padStart(8)} ${"Motifs".padStart(8)} ${"TopRole".padStart(10)}`);
  console.log(`${"---".padStart(4)} ${"----".padStart(7)} ${"----".padStart(6)} ${"-------".padStart(8)} ${"------".padStart(8)} ${"-------".padStart(10)}`);

  for (let chr = 1; chr <= 22; chr++) {
    const chrGenos = byChr.get(chr);
    if (!chrGenos) continue;
    chrGenos.sort((a, b) => a.pos - b.pos);

    const chrHet = chrGenos.filter((g) => g.a1 !== g.a2).length;
    const hetPct = ((chrHet / chrGenos.length) * 100).toFixed(1);

    // Generate reads for this chromosome
    const hap1 = chrGenos.map((g) => g.a1).join("");
    const chrReads: string[] = [];
    for (let i = 0; i <= hap1.length - 100; i += 30) {
      chrReads.push(hap1.slice(i, i + 100));
    }

    let moduleCount = 0;
    let motifCount = 0;
    let topRole = "-";

    if (chrReads.length > 100) {
      try {
        const chrMotifSet = new Set<number>();
        for (const r of chrReads.slice(0, 5000)) {
          for (const m of extractMotifs(r)) chrMotifSet.add(m);
        }
        motifCount = chrMotifSet.size;
        const chrModules = buildModules(chrReads.slice(0, 5000));
        moduleCount = chrModules.length;

        if (chrModules.length >= 3) {
          const graph = buildInteractionGraph(chrReads.slice(0, 5000));
          if (graph.n >= 3) {
            const lap = normalizedLaplacian(graph.adjacency);
            const eig = eigenDecomposition(lap);
            const roles = assignRoles(graph, eig);
            const spectrum = computeRoleSpectrum(roles);
            // Find dominant role
            let maxCount = 0;
            for (const [role, count] of Object.entries(spectrum)) {
              if (typeof count === "number" && count > maxCount) {
                maxCount = count;
                topRole = role;
              }
            }
          }
        }
      } catch {
        // Some chromosomes may not have enough data
      }
    }

    console.log(
      `${String(chr).padStart(4)} ${String(chrGenos.length).padStart(7)} ${hetPct.padStart(6)} ${String(moduleCount).padStart(8)} ${String(motifCount).padStart(8)} ${topRole.padStart(10)}`
    );
  }

  // ── Phase 7: Runs of homozygosity from module perspective ──
  console.log("\n── PHASE 7: Homozygosity landscape ──");
  const sortedAutosomes = [...autosomes].sort((a, b) => a.chr - b.chr || a.pos - b.pos);
  let rohCount = 0;
  let rohTotalBp = 0;
  let rohLongest = 0;
  let runStart = 0;
  let runLen = 0;
  let prevChr = 0;

  for (const g of sortedAutosomes) {
    const isHom = g.a1 === g.a2;
    if (g.chr !== prevChr) {
      if (runLen >= 50) {
        const span = g.pos - runStart;
        if (span >= 500_000) {
          rohCount++;
          rohTotalBp += span;
          if (span > rohLongest) rohLongest = span;
        }
      }
      runLen = 0;
      prevChr = g.chr;
    }

    if (isHom) {
      if (runLen === 0) runStart = g.pos;
      runLen++;
    } else {
      if (runLen >= 50 && prevChr === g.chr) {
        const span = g.pos - runStart;
        if (span >= 500_000) {
          rohCount++;
          rohTotalBp += span;
          if (span > rohLongest) rohLongest = span;
        }
      }
      runLen = 0;
    }
  }

  const froh = rohTotalBp / 2.87e9;
  console.log(`  ROH segments (≥500kb): ${rohCount}`);
  console.log(`  Total ROH: ${(rohTotalBp / 1e6).toFixed(1)} Mb`);
  console.log(`  FROH: ${froh.toFixed(4)} (${(froh * 100).toFixed(2)}%)`);
  console.log(`  Longest ROH: ${(rohLongest / 1e6).toFixed(2)} Mb`);

  if (froh < 0.01) console.log(`  → Outbred population — no recent consanguinity`);
  else if (froh < 0.0156) console.log(`  → Moderate ROH — consistent with founder/isolated population`);
  else console.log(`  → Elevated ROH — possible recent consanguinity or small population`);

  // ── Summary ──
  const totalMs = performance.now() - t0;
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   ANALYSIS COMPLETE                                            ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Subject: Lisa Watts`);
  console.log(`  Array: AncestryDNA V2.0 (GRCh37)`);
  console.log(`  Genotypes: ${genotypes.length.toLocaleString()}`);
  console.log(`  Pseudo-reads: ${reads.length.toLocaleString()}`);
  if (modules.length > 0) {
    console.log(`  Modules: ${modules.length}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
