import type { Variant, VariantType } from "./types.js";

/**
 * Detects variants by comparing a query sequence to a reference sequence.
 * Simple pairwise alignment-based caller.
 */
export class VariantCaller {
  /** Call variants between a reference and query sequence */
  call(reference: string, query: string): Variant[] {
    const variants: Variant[] = [];
    const minLen = Math.min(reference.length, query.length);

    let i = 0;
    while (i < minLen) {
      if (reference[i] !== query[i]) {
        const variant = this.identifyVariant(reference, query, i);
        variants.push(variant);
        i += Math.max(variant.ref.length, variant.alt.length);
      } else {
        i++;
      }
    }

    if (query.length > reference.length) {
      variants.push({
        position: reference.length,
        ref: "",
        alt: query.slice(reference.length),
        type: "insertion",
        quality: 0,
      });
    } else if (reference.length > query.length) {
      variants.push({
        position: query.length,
        ref: reference.slice(query.length),
        alt: "",
        type: "deletion",
        quality: 0,
      });
    }

    return variants;
  }

  private identifyVariant(ref: string, query: string, pos: number): Variant {
    const refBase = ref[pos]!;
    const queryBase = query[pos]!;
    const type: VariantType = "snp";

    return {
      position: pos,
      ref: refBase,
      alt: queryBase,
      type,
      quality: 30,
    };
  }
}
