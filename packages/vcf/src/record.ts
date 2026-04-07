import type { Variant, Genotype } from "./types.js";

/** Structured variant record with genotype support */
export class VariantRecord {
  readonly variant: Variant;
  readonly genotype: Genotype;

  constructor(variant: Variant, alleles: readonly number[] = [0, 1]) {
    this.variant = variant;
    this.genotype = {
      alleles,
      isHomRef: alleles.every((a) => a === 0),
      isHet: new Set(alleles).size > 1,
      isHomAlt: alleles.every((a) => a > 0),
    };
  }

  /** Format as a VCF-like tab-separated string */
  toVcfLine(chrom: string = "."): string {
    const pos = this.variant.position + 1;
    const ref = this.variant.ref || ".";
    const alt = this.variant.alt || ".";
    const qual = this.variant.quality;
    const gt = this.genotype.alleles.join("/");
    return `${chrom}\t${pos}\t.\t${ref}\t${alt}\t${qual}\tPASS\t.\tGT\t${gt}`;
  }
}
