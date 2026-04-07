/**
 * yalumba kernel API
 *
 * CPU reference implementations of compute kernels.
 * These functions mirror the GPU kernel signatures.
 */

#ifndef YALUMBA_KERNELS_H
#define YALUMBA_KERNELS_H

#include <stdint.h>

/**
 * Compute rolling polynomial hashes for all k-mers in a sequence.
 *
 * @param sequence    DNA sequence as ASCII bytes
 * @param seq_length  Length of the sequence
 * @param k           K-mer size
 * @param out_hashes  Output array (must hold seq_length - k + 1 entries)
 * @param out_count   Number of hashes written
 */
void yalumba_kmer_hash(
    const uint8_t *sequence,
    uint32_t seq_length,
    uint32_t k,
    uint64_t *out_hashes,
    uint32_t *out_count
);

/**
 * Compute Hamming distance between two packed DNA sequences.
 *
 * @param seq_a       First packed sequence (2-bit encoding, 16 bases per u32)
 * @param seq_b       Second packed sequence
 * @param word_count  Number of uint32 words to compare
 * @return            Hamming distance (number of differing bases)
 */
uint32_t yalumba_hamming_packed(
    const uint32_t *seq_a,
    const uint32_t *seq_b,
    uint32_t word_count
);

#endif /* YALUMBA_KERNELS_H */
