import type { Base, EncodedBase, EncodedBaseWithN, PackedDna } from "./types.js";

const ENCODE_TABLE: Record<string, EncodedBaseWithN> = {
  A: 0, a: 0,
  C: 1, c: 1,
  G: 2, g: 2,
  T: 3, t: 3,
  N: 4, n: 4,
};

const DECODE_TABLE: readonly Base[] = ["A", "C", "G", "T"];

const BASES_PER_WORD = 16;
const BITS_PER_BASE = 2;

/**
 * Encodes and decodes DNA sequences into compact 2-bit representation.
 * N bases are mapped to A (0) during packing — use the N-mask if you need to track them.
 */
export class DnaEncoder {
  /** Encode a single character to its 2-bit value */
  encodeBase(base: string): EncodedBase {
    const encoded = ENCODE_TABLE[base];
    if (encoded === undefined) {
      throw new Error(`Invalid base: '${base}'`);
    }
    return (encoded === 4 ? 0 : encoded) as EncodedBase;
  }

  /** Decode a 2-bit value back to a base character */
  decodeBase(encoded: EncodedBase): Base {
    const base = DECODE_TABLE[encoded];
    if (base === undefined) {
      throw new Error(`Invalid encoded base: ${encoded}`);
    }
    return base;
  }

  /** Check if a character is an N base */
  isN(base: string): boolean {
    return base === "N" || base === "n";
  }

  /** Pack a sequence string into a compact Uint32Array */
  pack(sequence: string): PackedDna {
    const wordCount = Math.ceil(sequence.length / BASES_PER_WORD);
    const data = new Uint32Array(wordCount);

    for (let i = 0; i < sequence.length; i++) {
      const encoded = this.encodeBase(sequence[i]!);
      const wordIndex = Math.floor(i / BASES_PER_WORD);
      const bitOffset = (i % BASES_PER_WORD) * BITS_PER_BASE;
      data[wordIndex]! |= encoded << bitOffset;
    }

    return { data, length: sequence.length };
  }

  /** Unpack a PackedDna back to a sequence string */
  unpack(packed: PackedDna): string {
    const chars: string[] = new Array(packed.length);

    for (let i = 0; i < packed.length; i++) {
      const wordIndex = Math.floor(i / BASES_PER_WORD);
      const bitOffset = (i % BASES_PER_WORD) * BITS_PER_BASE;
      const encoded = ((packed.data[wordIndex]! >> bitOffset) & 0b11) as EncodedBase;
      chars[i] = this.decodeBase(encoded);
    }

    return chars.join("");
  }

  /** Build an N-mask: a Uint8Array where 1 = position is N */
  buildNMask(sequence: string): Uint8Array {
    const mask = new Uint8Array(sequence.length);
    for (let i = 0; i < sequence.length; i++) {
      if (this.isN(sequence[i]!)) {
        mask[i] = 1;
      }
    }
    return mask;
  }
}
