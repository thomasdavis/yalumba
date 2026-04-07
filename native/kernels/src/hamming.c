/**
 * yalumba Hamming distance kernel (CPU reference implementation)
 *
 * Computes Hamming distance between two packed DNA sequences.
 * Each uint32 holds 16 bases at 2 bits each.
 */

#include <stdint.h>
#include "../include/kernels.h"

static uint32_t popcount32(uint32_t x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    return (x * 0x01010101) >> 24;
}

uint32_t yalumba_hamming_packed(
    const uint32_t *seq_a,
    const uint32_t *seq_b,
    uint32_t word_count
) {
    uint32_t distance = 0;

    for (uint32_t i = 0; i < word_count; i++) {
        uint32_t xor_val = seq_a[i] ^ seq_b[i];
        /* Each differing 2-bit pair contributes 1 to distance */
        uint32_t diff_lo = xor_val & 0x55555555;
        uint32_t diff_hi = (xor_val >> 1) & 0x55555555;
        uint32_t diff = diff_lo | diff_hi;
        distance += popcount32(diff);
    }

    return distance;
}
