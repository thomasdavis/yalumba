import type { AlgorithmResult } from "./types.js";

/** Print benchmark results to console */
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
}
