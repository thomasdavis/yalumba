/** Valid DNA bases */
export type Base = "A" | "C" | "G" | "T" | "N";

/** 2-bit encoded base: A=0, C=1, G=2, T=3 */
export type EncodedBase = 0 | 1 | 2 | 3;

/** N is stored as 4 in contexts that support it */
export type EncodedBaseWithN = EncodedBase | 4;

/** Packed DNA stored as Uint32Array, 16 bases per 32-bit word */
export interface PackedDna {
  /** Packed data — each u32 holds 16 bases at 2 bits each */
  readonly data: Uint32Array;
  /** Number of bases in the sequence */
  readonly length: number;
}
