import { writeFileSync } from "fs";
import type { AlgorithmResult, DatasetDef } from "./types.js";

/** Print and generate benchmark reports */
export class Reporter {
  static printLeaderboard(results: readonly AlgorithmResult[]): void {
    console.log("\n╔══════════════════════════════════════════════════════════════════════════════════╗");
    console.log("║                              ALGORITHM LEADERBOARD                              ║");
    console.log("╚══════════════════════════════════════════════════════════════════════════════════╝\n");

    console.log("  #   Algorithm                              Time     Separation  Mother   F   M");
    console.log("  " + "─".repeat(85));

    results.forEach((alg, i) => {
      const rank = `${i + 1}.`.padEnd(4);
      const name = alg.name.padEnd(38);
      const time = `${(alg.totalTimeMs / 1000).toFixed(1)}s`.padStart(7);
      const sep = `${alg.separation >= 0 ? "+" : ""}${(alg.separation * 100).toFixed(4)}%`.padStart(11);
      const mother = `${alg.motherSonGap >= 0 ? "+" : ""}${(alg.motherSonGap * 100).toFixed(4)}%`.padStart(11);
      const f = alg.correct ? " ✓" : " ✗";
      const m = alg.detectsMother ? " ✓" : " ✗";
      console.log(`  ${rank}${name}${time}  ${sep}  ${mother} ${f} ${m}`);
    });
  }

  static printDetail(result: AlgorithmResult): void {
    const status = result.detectsMother ? "✓ BOTH" : result.correct ? "✓ FATHER" : "✗ FAILS";
    console.log(`\n── ${result.name} ── ${status} ── ${(result.totalTimeMs / 1000).toFixed(1)}s ──`);
    console.log(`   ${result.description}`);
    if (result.prepTimeMs > 100) {
      console.log(`   Prep: ${(result.prepTimeMs / 1000).toFixed(1)}s`);
    }
    for (const p of result.pairs) {
      const marker = p.related ? "►" : " ";
      console.log(`   ${marker} ${p.pair.padEnd(16)} ${p.score.toFixed(6).padStart(10)}  ${p.detail}  (${(p.timeMs / 1000).toFixed(1)}s)`);
    }
    console.log(`   Separation: ${result.separation >= 0 ? "+" : ""}${(result.separation * 100).toFixed(4)}%  Mother gap: ${result.motherSonGap >= 0 ? "+" : ""}${(result.motherSonGap * 100).toFixed(4)}%`);
  }

  /** Generate a markdown report and write to disk */
  static generateReport(
    results: readonly AlgorithmResult[],
    dataset: DatasetDef,
    outputPath: string,
  ): void {
    const now = new Date().toISOString().slice(0, 10);
    const detecting = results.filter((r) => r.correct).length;
    const detectingAll = results.filter((r) => r.detectsMother).length;
    const totalTime = results.reduce((s, r) => s + r.totalTimeMs, 0);

    const lines: string[] = [];
    const w = (s: string) => lines.push(s);

    w(`# yalumba Benchmark Report`);
    w(``);
    w(`**Dataset:** ${dataset.name}  `);
    w(`**Date:** ${now}  `);
    w(`**Algorithms:** ${results.length}  `);
    w(`**Detect related > unrelated:** ${detecting}/${results.length}  `);
    w(`**Detect ALL related pairs:** ${detectingAll}/${results.length}  `);
    w(`**Total benchmark time:** ${(totalTime / 1000).toFixed(1)}s`);
    w(``);
    w(`---`);
    w(``);
    w(`## Leaderboard`);
    w(``);
    w(`| # | Algorithm | Time | Separation | Weakest pair gap | Father | All pairs |`);
    w(`|---|-----------|------|-----------|-----------------|--------|-----------|`);

    results.forEach((alg, i) => {
      const rank = i + 1;
      const time = `${(alg.totalTimeMs / 1000).toFixed(1)}s`;
      const sep = `${alg.separation >= 0 ? "+" : ""}${(alg.separation * 100).toFixed(4)}%`;
      const mother = `${alg.motherSonGap >= 0 ? "+" : ""}${(alg.motherSonGap * 100).toFixed(4)}%`;
      const f = alg.correct ? "yes" : "no";
      const m = alg.detectsMother ? "yes" : "no";
      const bold = rank <= 3 ? "**" : "";
      w(`| ${bold}${rank}${bold} | ${bold}${alg.name}${bold} | ${time} | ${bold}${sep}${bold} | ${mother} | ${f} | ${m} |`);
    });

    w(``);
    w(`---`);
    w(``);
    w(`## Dataset`);
    w(``);
    w(`| Sample | Role | File |`);
    w(`|--------|------|------|`);
    for (const s of dataset.samples) {
      w(`| ${s.id} | ${s.role} | ${s.file} |`);
    }

    w(``);
    w(`### Pairs tested`);
    w(``);
    w(`| Pair | Relationship | Related |`);
    w(`|------|-------------|---------|`);
    for (const p of dataset.pairs) {
      w(`| ${p.a} ↔ ${p.b} | ${p.label} | ${p.related ? "yes" : "no"} |`);
    }

    w(``);
    w(`---`);
    w(``);
    w(`## Detailed results`);
    w(``);

    for (const alg of results.slice(0, 10)) {
      const status = alg.detectsMother ? "BOTH" : alg.correct ? "FATHER ONLY" : "FAILS";
      w(`### #${results.indexOf(alg) + 1} ${alg.name} (v${alg.version}) — ${status}`);
      w(``);
      w(`> ${alg.description}`);
      w(``);
      w(`- **Time:** ${(alg.totalTimeMs / 1000).toFixed(1)}s`);
      w(`- **Separation:** ${(alg.separation * 100).toFixed(4)}%`);
      w(`- **Weakest pair gap:** ${(alg.motherSonGap * 100).toFixed(4)}%`);
      w(``);
      w(`| Pair | Score | Detail |`);
      w(`|------|-------|--------|`);
      for (const p of alg.pairs) {
        const marker = p.related ? "**" : "";
        w(`| ${marker}${p.pair}${marker} | ${marker}${p.score.toFixed(6)}${marker} | ${p.detail} |`);
      }
      w(``);
    }

    w(`---`);
    w(``);
    w(`## Failed algorithms`);
    w(``);
    const failed = results.filter((r) => !r.correct);
    if (failed.length === 0) {
      w(`All algorithms detected related > unrelated.`);
    } else {
      for (const alg of failed) {
        w(`- **${alg.name}** — separation: ${(alg.separation * 100).toFixed(4)}%`);
      }
    }
    w(``);
    const partialFail = results.filter((r) => r.correct && !r.detectsMother);
    if (partialFail.length > 0) {
      w(`### Partial failures (detect some but not all related pairs)`);
      w(``);
      for (const alg of partialFail) {
        w(`- **${alg.name}** — weakest pair gap: ${(alg.motherSonGap * 100).toFixed(4)}%`);
      }
    }

    w(``);
    w(`---`);
    w(``);
    w(`*Generated by yalumba experiment framework on ${now}*`);

    writeFileSync(outputPath, lines.join("\n"));
    console.log(`\nReport written to: ${outputPath}`);
  }
}
