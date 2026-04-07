/** Basic statistical functions for genomics data */
export class Statistics {
  /** Compute the mean of an array of numbers */
  static mean(values: readonly number[]): number {
    if (values.length === 0) return 0;
    let sum = 0;
    for (const v of values) sum += v;
    return sum / values.length;
  }

  /** Compute the variance */
  static variance(values: readonly number[]): number {
    if (values.length < 2) return 0;
    const m = Statistics.mean(values);
    let sumSq = 0;
    for (const v of values) {
      const diff = v - m;
      sumSq += diff * diff;
    }
    return sumSq / (values.length - 1);
  }

  /** Compute standard deviation */
  static stddev(values: readonly number[]): number {
    return Math.sqrt(Statistics.variance(values));
  }

  /** Compute the median */
  static median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }

  /** Compute percentile (0-100) */
  static percentile(values: readonly number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower]!;
    const weight = index - lower;
    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  }

  /** Compute a histogram with the given number of bins */
  static histogram(values: readonly number[], bins: number): { edges: number[]; counts: number[] } {
    if (values.length === 0) return { edges: [], counts: [] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins || 1;

    const edges: number[] = [];
    const counts: number[] = new Array(bins).fill(0);

    for (let i = 0; i <= bins; i++) {
      edges.push(min + i * binWidth);
    }

    for (const v of values) {
      const bin = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      counts[bin]!++;
    }

    return { edges, counts };
  }
}
