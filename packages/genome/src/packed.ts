import type { PackedDna, EncodedBase } from "./types.js";

const BASES_PER_WORD = 16;
const BITS_PER_BASE = 2;

/** Operations on packed DNA sequences */
export class PackedSequence {
  /** Get the base at a given position */
  getBase(packed: PackedDna, position: number): EncodedBase {
    if (position < 0 || position >= packed.length) {
      throw new RangeError(`Position ${position} out of bounds [0, ${packed.length})`);
    }
    const wordIndex = Math.floor(position / BASES_PER_WORD);
    const bitOffset = (position % BASES_PER_WORD) * BITS_PER_BASE;
    return ((packed.data[wordIndex]! >> bitOffset) & 0b11) as EncodedBase;
  }

  /** Compute hamming distance between two packed sequences */
  hammingDistance(a: PackedDna, b: PackedDna): number {
    const len = Math.min(a.length, b.length);
    let distance = 0;

    for (let i = 0; i < len; i++) {
      if (this.getBase(a, i) !== this.getBase(b, i)) {
        distance++;
      }
    }

    return distance;
  }

  /** Extract a sub-sequence as a new PackedDna */
  slice(packed: PackedDna, start: number, end: number): PackedDna {
    if (start < 0 || end > packed.length || start > end) {
      throw new RangeError(`Invalid slice range [${start}, ${end}) for length ${packed.length}`);
    }

    const newLength = end - start;
    const wordCount = Math.ceil(newLength / BASES_PER_WORD);
    const data = new Uint32Array(wordCount);

    for (let i = 0; i < newLength; i++) {
      const base = this.getBase(packed, start + i);
      const wordIndex = Math.floor(i / BASES_PER_WORD);
      const bitOffset = (i % BASES_PER_WORD) * BITS_PER_BASE;
      data[wordIndex]! |= base << bitOffset;
    }

    return { data, length: newLength };
  }

  /** Compute the reverse complement of a packed sequence */
  reverseComplement(packed: PackedDna): PackedDna {
    const wordCount = Math.ceil(packed.length / BASES_PER_WORD);
    const data = new Uint32Array(wordCount);

    for (let i = 0; i < packed.length; i++) {
      const base = this.getBase(packed, packed.length - 1 - i);
      const complement = (base ^ 0b11) as EncodedBase;
      const wordIndex = Math.floor(i / BASES_PER_WORD);
      const bitOffset = (i % BASES_PER_WORD) * BITS_PER_BASE;
      data[wordIndex]! |= complement << bitOffset;
    }

    return { data, length: packed.length };
  }
}
