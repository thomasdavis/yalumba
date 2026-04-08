import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import type {
  Experiment, SampleData, PairDef, AlgorithmResult, PairResult, ResultCache,
} from "./types.js";

/** Runs experiments with disk-based caching keyed on dataset + name + version */
export class BenchmarkRunner {
  private readonly samples: Map<string, SampleData>;
  private readonly pairs: readonly PairDef[];
  private readonly datasetId: string;
  private cache: Record<string, AlgorithmResult>;
  private readonly cachePath: string | null;

  constructor(
    samples: Map<string, SampleData>,
    pairs: readonly PairDef[],
    datasetId: string,
    cachePath?: string,
  ) {
    this.samples = samples;
    this.pairs = pairs;
    this.datasetId = datasetId;
    this.cachePath = cachePath ?? null;
    this.cache = this.loadCache();
  }

  private cacheKey(exp: Experiment): string {
    return `${this.datasetId}::${exp.name}@v${exp.version}`;
  }

  private loadCache(): Record<string, AlgorithmResult> {
    if (!this.cachePath || !existsSync(this.cachePath)) return {};
    try {
      const data: ResultCache = JSON.parse(readFileSync(this.cachePath, "utf-8"));
      return data.results ?? {};
    } catch {
      return {};
    }
  }

  private saveCache(): void {
    if (!this.cachePath) return;
    const dir = dirname(this.cachePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const data: ResultCache = { results: this.cache };
    writeFileSync(this.cachePath, JSON.stringify(data, null, 2));
  }

  /** Run a single experiment (returns cached result if version matches) */
  run(experiment: Experiment): { result: AlgorithmResult; cached: boolean } {
    const key = this.cacheKey(experiment);
    const cached = this.cache[key];
    if (cached) return { result: cached, cached: true };

    const result = this.execute(experiment);
    this.cache[key] = result;
    this.saveCache();
    return { result, cached: false };
  }

  private execute(experiment: Experiment): AlgorithmResult {
    const maxReads = experiment.maxReadsPerSample ?? Infinity;
    const subsampled = new Map<string, SampleData>();
    for (const [id, sample] of this.samples) {
      if (sample.reads.length > maxReads) {
        subsampled.set(id, { ...sample, reads: sample.reads.slice(0, maxReads) });
      } else {
        subsampled.set(id, sample);
      }
    }

    const prepStart = performance.now();
    const context = experiment.prepare
      ? experiment.prepare([...subsampled.values()])
      : undefined;
    const prepTimeMs = performance.now() - prepStart;

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

    const relatedScores = pairResults.filter((p) => p.related);
    const unrelatedScores = pairResults.filter((p) => !p.related);
    const avgRelated = relatedScores.reduce((s, p) => s + p.score, 0) / Math.max(1, relatedScores.length);
    const avgUnrelated = unrelatedScores.reduce((s, p) => s + p.score, 0) / Math.max(1, unrelatedScores.length);
    const separation = avgRelated - avgUnrelated;

    const motherSon = pairResults.find((p) => p.label.includes("Mother") || p.label.includes("Child"));
    const unrelated = pairResults.find((p) => !p.related);
    const motherSonGap = motherSon && unrelated ? motherSon.score - unrelated.score : 0;

    return {
      name: experiment.name,
      version: experiment.version,
      dataset: this.datasetId,
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

  /** Run all experiments, using cache where available, return sorted */
  runAll(experiments: readonly Experiment[]): AlgorithmResult[] {
    const results: AlgorithmResult[] = [];
    for (const exp of experiments) {
      const { result } = this.run(exp);
      results.push(result);
    }
    return this.sort(results);
  }

  static sort(results: AlgorithmResult[]): AlgorithmResult[] {
    return results.sort((a, b) => {
      if (a.correct !== b.correct) return a.correct ? -1 : 1;
      if (a.detectsMother !== b.detectsMother) return a.detectsMother ? -1 : 1;
      return Math.abs(b.separation) - Math.abs(a.separation);
    });
  }

  private sort(results: AlgorithmResult[]): AlgorithmResult[] {
    return BenchmarkRunner.sort(results);
  }
}
