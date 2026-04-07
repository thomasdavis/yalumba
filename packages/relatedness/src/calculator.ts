import type { RelatednessResult, RelationshipCategory } from "./types.js";
import { SegmentDetector } from "./segments.js";
import { CentimorganEstimator } from "./centimorgan.js";

/**
 * Computes overall relatedness between two genomes.
 * Combines segment detection with relationship classification.
 */
export class RelatednessCalculator {
  private readonly segmentDetector: SegmentDetector;
  private readonly cmEstimator: CentimorganEstimator;

  constructor(k: number = 21) {
    this.segmentDetector = new SegmentDetector({ k });
    this.cmEstimator = new CentimorganEstimator();
  }

  /** Compute relatedness between two sequences */
  compute(seqA: string, seqB: string): RelatednessResult {
    const segments = this.segmentDetector.detect(seqA, seqB);

    let totalSharedBp = 0;
    for (const segment of segments) {
      totalSharedBp += segment.lengthBp;
    }

    const totalSharedCm = this.cmEstimator.fromBasePairs(totalSharedBp);
    const kinshipCoefficient = this.estimateKinship(totalSharedCm);
    const relationship = this.classify(totalSharedCm);

    return {
      segments,
      totalSharedBp,
      totalSharedCm,
      kinshipCoefficient,
      relationship,
    };
  }

  private estimateKinship(sharedCm: number): number {
    return Math.min(0.5, sharedCm / 6800);
  }

  private classify(sharedCm: number): RelationshipCategory {
    if (sharedCm > 3400) return "identical";
    if (sharedCm > 2500) return "parent-child";
    if (sharedCm > 1700) return "full-sibling";
    if (sharedCm > 1000) return "half-sibling";
    if (sharedCm > 500) return "first-cousin";
    if (sharedCm > 100) return "second-cousin";
    if (sharedCm > 20) return "distant";
    return "unrelated";
  }
}
