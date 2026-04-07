import type { SharedSegment } from "./types.js";
import { KmerExtractor } from "@yalumba/kmer";

const DEFAULT_K = 21;
const DEFAULT_MIN_RUN = 50;
const DEFAULT_MAX_GAP = 5;

interface SegmentDetectorOptions {
  readonly k?: number;
  readonly minRunLength?: number;
  readonly maxGapLength?: number;
}

/**
 * Detects long runs of shared k-mers between two sequences.
 * These runs approximate Identity-By-Descent (IBD) segments.
 */
export class SegmentDetector {
  private readonly extractor: KmerExtractor;
  private readonly minRunLength: number;
  private readonly maxGapLength: number;

  constructor(options: SegmentDetectorOptions = {}) {
    this.extractor = new KmerExtractor({ k: options.k ?? DEFAULT_K, canonical: true });
    this.minRunLength = options.minRunLength ?? DEFAULT_MIN_RUN;
    this.maxGapLength = options.maxGapLength ?? DEFAULT_MAX_GAP;
  }

  /** Detect shared segments between two sequences */
  detect(seqA: string, seqB: string): SharedSegment[] {
    const setB = new Set<bigint>();
    for (const kmer of this.extractor.iterate(seqB)) {
      setB.add(kmer.hash);
    }

    const matches: boolean[] = [];
    for (const kmer of this.extractor.iterate(seqA)) {
      matches.push(setB.has(kmer.hash));
    }

    return this.findRuns(matches);
  }

  private findRuns(matches: boolean[]): SharedSegment[] {
    const segments: SharedSegment[] = [];
    let runStart = -1;
    let gapLength = 0;

    for (let i = 0; i < matches.length; i++) {
      if (matches[i]) {
        if (runStart === -1) runStart = i;
        gapLength = 0;
      } else {
        gapLength++;
        if (gapLength > this.maxGapLength && runStart !== -1) {
          const runEnd = i - gapLength;
          if (runEnd - runStart >= this.minRunLength) {
            segments.push(this.buildSegment(runStart, runEnd));
          }
          runStart = -1;
          gapLength = 0;
        }
      }
    }

    if (runStart !== -1) {
      const runEnd = matches.length - 1 - gapLength;
      if (runEnd - runStart >= this.minRunLength) {
        segments.push(this.buildSegment(runStart, runEnd));
      }
    }

    return segments;
  }

  private buildSegment(start: number, end: number): SharedSegment {
    const lengthBp = end - start;
    return {
      start,
      end,
      lengthBp,
      lengthCm: CentimorganEstimator.quickEstimate(lengthBp),
      confidence: Math.min(1, lengthBp / 1000),
    };
  }
}

/** Simple centimorgan estimation used inline by SegmentDetector */
class CentimorganEstimator {
  static quickEstimate(basePairs: number): number {
    return basePairs / 1_000_000;
  }
}
