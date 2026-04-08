import type {
  Experiment, SampleData, PairDef, AlgorithmResult, PairResult,
} from "./types.js";

/** Runs a set of experiments against loaded sample data */
export class BenchmarkRunner {
  private readonly samples: Map<string, SampleData>;
  private readonly pairs: readonly PairDef[];

  constructor(samples: Map<string, SampleData>, pairs: readonly PairDef[]) {
    this.samples = samples;
    this.pairs = pairs;
  }

  /** Run a single experiment and return its results */
  run(experiment: Experiment): AlgorithmResult {
    // Subsample if needed
    const maxReads = experiment.maxReadsPerSample ?? Infinity;
    const subsampled = new Map<string, SampleData>();
    for (const [id, sample] of this.samples) {
      if (sample.reads.length > maxReads) {
        subsampled.set(id, { ...sample, reads: sample.reads.slice(0, maxReads) });
      } else {
        subsampled.set(id, sample);
      }
    }

    // Prepare
    const prepStart = performance.now();
    const context = experiment.prepare
      ? experiment.prepare([...subsampled.values()])
      : undefined;
    const prepTimeMs = performance.now() - prepStart;

    // Compare all pairs
    const pairResults: PairResult[] = [];
    const totalStart = performance.now();

    for (const pair of this.pairs) {
      const a = subsampled.get(pair.a);
      const b = subsampled.get(pair.b);
      if (!a || !b) throw new Error(`Sample not found: ${pair.a} or ${pair.b}`);

      const start = performance.now();
      const result = experiment.compare(a, b, context);
      const timeMs = performance.now() - start;

      pairResults.push({
        pair: `${pair.a} ↔ ${pair.b}`,
        label: pair.label,
        related: pair.related,
        score: result.score,
        detail: result.detail,
        timeMs,
      });
    }

    const totalTimeMs = performance.now() - totalStart;

    // Compute metrics
    const relatedScores = pairResults.filter((p) => p.related);
    const unrelatedScores = pairResults.filter((p) => !p.related);
    const avgRelated = relatedScores.reduce((s, p) => s + p.score, 0) / Math.max(1, relatedScores.length);
    const avgUnrelated = unrelatedScores.reduce((s, p) => s + p.score, 0) / Math.max(1, unrelatedScores.length);
    const separation = avgRelated - avgUnrelated;

    const motherSon = pairResults.find((p) => p.label.includes("Mother"));
    const unrelated = pairResults.find((p) => !p.related);
    const motherSonGap = motherSon && unrelated ? motherSon.score - unrelated.score : 0;

    return {
      name: experiment.name,
      description: experiment.description,
      pairs: pairResults,
      totalTimeMs: totalTimeMs + prepTimeMs,
      prepTimeMs,
      separation,
      correct: separation > 0,
      motherSonGap,
      detectsMother: motherSonGap > 0,
    };
  }

  /** Run all experiments and return sorted results */
  runAll(experiments: readonly Experiment[]): AlgorithmResult[] {
    const results: AlgorithmResult[] = [];
    for (const exp of experiments) {
      results.push(this.run(exp));
    }
    return results.sort((a, b) => {
      if (a.correct !== b.correct) return a.correct ? -1 : 1;
      if (a.detectsMother !== b.detectsMother) return a.detectsMother ? -1 : 1;
      return Math.abs(b.separation) - Math.abs(a.separation);
    });
  }
}
