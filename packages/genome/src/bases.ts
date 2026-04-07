import type { Base } from "./types.js";

/** Utility functions for working with DNA bases */
export class BaseUtils {
  /** Get the complement of a base */
  complement(base: Base): Base {
    switch (base) {
      case "A": return "T";
      case "T": return "A";
      case "C": return "G";
      case "G": return "C";
      case "N": return "N";
    }
  }

  /** Reverse complement a sequence string */
  reverseComplement(sequence: string): string {
    const result: string[] = new Array(sequence.length);
    for (let i = 0; i < sequence.length; i++) {
      result[sequence.length - 1 - i] = this.complement(sequence[i]!.toUpperCase() as Base);
    }
    return result.join("");
  }

  /** Count occurrences of each base */
  baseCounts(sequence: string): Record<Base, number> {
    const counts: Record<Base, number> = { A: 0, C: 0, G: 0, T: 0, N: 0 };
    for (let i = 0; i < sequence.length; i++) {
      const base = sequence[i]!.toUpperCase() as Base;
      counts[base]++;
    }
    return counts;
  }

  /** Compute GC content as a fraction [0, 1] */
  gcContent(sequence: string): number {
    if (sequence.length === 0) return 0;
    const counts = this.baseCounts(sequence);
    return (counts.G + counts.C) / sequence.length;
  }
}
