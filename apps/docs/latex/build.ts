#!/usr/bin/env bun

/**
 * Build all LaTeX reports to PDF using tectonic.
 * Usage: bun run apps/docs/latex/build.ts
 */

import { readdirSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const LATEX_DIR = import.meta.dir;
const REPORTS_DIR = join(LATEX_DIR, "reports");
const OUTPUT_DIR = join(LATEX_DIR, "../public/reports");

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const texFiles = readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".tex"));

if (texFiles.length === 0) {
  console.log("No .tex files found in", REPORTS_DIR);
  process.exit(0);
}

console.log(`Building ${texFiles.length} reports...\n`);

let success = 0;
let failed = 0;

for (const tex of texFiles) {
  const slug = tex.replace(".tex", "");
  process.stdout.write(`  ${slug}... `);

  const start = performance.now();
  const result = Bun.spawnSync(
    ["tectonic", join(REPORTS_DIR, tex), "-o", OUTPUT_DIR],
    { cwd: LATEX_DIR, env: { ...process.env } },
  );

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);

  if (result.exitCode === 0) {
    console.log(`OK (${elapsed}s) → public/reports/${slug}.pdf`);
    success++;
  } else {
    console.log(`FAILED (${elapsed}s)`);
    console.error(`    ${new TextDecoder().decode(result.stderr).split("\n").slice(-3).join("\n    ")}`);
    failed++;
  }
}

console.log(`\n${success} built, ${failed} failed`);
if (failed > 0) process.exit(1);
