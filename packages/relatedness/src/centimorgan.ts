/**
 * Estimates genetic distance in centimorgans from physical distance.
 * Uses a simple linear model by default; can accept custom recombination maps.
 */
export class CentimorganEstimator {
  private readonly recombinationRate: number;

  /**
   * @param recombinationRate Average recombination rate in cM/Mb (default: 1.0)
   */
  constructor(recombinationRate: number = 1.0) {
    this.recombinationRate = recombinationRate;
  }

  /** Estimate centimorgans from base pairs */
  fromBasePairs(basePairs: number): number {
    return (basePairs / 1_000_000) * this.recombinationRate;
  }

  /** Estimate base pairs from centimorgans */
  toBasePairs(centimorgans: number): number {
    return (centimorgans / this.recombinationRate) * 1_000_000;
  }
}
