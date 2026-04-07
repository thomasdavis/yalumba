import type { AlignmentResult, ScoringMatrix } from "./types.js";

const DEFAULT_SCORING: ScoringMatrix = {
  match: 1,
  mismatch: -1,
  gap: -2,
};

/**
 * Needleman-Wunsch global alignment algorithm.
 * Computes optimal global alignment between two sequences.
 */
export class NeedlemanWunsch {
  private readonly scoring: ScoringMatrix;

  constructor(scoring: ScoringMatrix = DEFAULT_SCORING) {
    this.scoring = scoring;
  }

  /** Align two sequences and return the result */
  align(seqA: string, seqB: string): AlignmentResult {
    const m = seqA.length;
    const n = seqB.length;

    const matrix = this.buildMatrix(seqA, seqB, m, n);
    return this.traceback(matrix, seqA, seqB, m, n);
  }

  private buildMatrix(seqA: string, seqB: string, m: number, n: number): Float64Array[] {
    const matrix: Float64Array[] = [];
    for (let i = 0; i <= m; i++) {
      matrix.push(new Float64Array(n + 1));
    }

    for (let i = 0; i <= m; i++) matrix[i]![0] = i * this.scoring.gap;
    for (let j = 0; j <= n; j++) matrix[0]![j] = j * this.scoring.gap;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const matchScore = seqA[i - 1] === seqB[j - 1]
          ? this.scoring.match
          : this.scoring.mismatch;

        const diag = matrix[i - 1]![j - 1]! + matchScore;
        const up = matrix[i - 1]![j]! + this.scoring.gap;
        const left = matrix[i]![j - 1]! + this.scoring.gap;

        matrix[i]![j] = Math.max(diag, up, left);
      }
    }

    return matrix;
  }

  private traceback(
    matrix: Float64Array[],
    seqA: string,
    seqB: string,
    m: number,
    n: number,
  ): AlignmentResult {
    const alignA: string[] = [];
    const alignB: string[] = [];
    let i = m;
    let j = n;
    let matches = 0;
    let mismatches = 0;
    let gaps = 0;

    while (i > 0 || j > 0) {
      if (
        i > 0 && j > 0 &&
        matrix[i]![j] === matrix[i - 1]![j - 1]! +
          (seqA[i - 1] === seqB[j - 1] ? this.scoring.match : this.scoring.mismatch)
      ) {
        alignA.push(seqA[i - 1]!);
        alignB.push(seqB[j - 1]!);
        if (seqA[i - 1] === seqB[j - 1]) matches++;
        else mismatches++;
        i--;
        j--;
      } else if (i > 0 && matrix[i]![j] === matrix[i - 1]![j]! + this.scoring.gap) {
        alignA.push(seqA[i - 1]!);
        alignB.push("-");
        gaps++;
        i--;
      } else {
        alignA.push("-");
        alignB.push(seqB[j - 1]!);
        gaps++;
        j--;
      }
    }

    return {
      alignedA: alignA.reverse().join(""),
      alignedB: alignB.reverse().join(""),
      score: matrix[m]![n]!,
      matches,
      mismatches,
      gaps,
    };
  }
}
