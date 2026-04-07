/**
 * yalumba k-mer hashing kernel (CPU reference implementation)
 *
 * Computes rolling polynomial hashes for k-mers in a DNA sequence.
 * This C implementation serves as:
 *   1. Reference for correctness testing
 *   2. Template for SPIR-V compute shader translation
 *   3. FFI-callable accelerator via Bun's native call support
 */

#include <stdint.h>
#include <string.h>
#include "../include/kernels.h"

#define HASH_BASE 31ULL
#define HASH_MOD  ((1ULL << 61) - 1)

static uint64_t mod_mul(uint64_t a, uint64_t b) {
    __uint128_t result = (__uint128_t)a * b;
    uint64_t lo = (uint64_t)(result & HASH_MOD);
    uint64_t hi = (uint64_t)(result >> 61);
    uint64_t val = lo + hi;
    return val >= HASH_MOD ? val - HASH_MOD : val;
}

void yalumba_kmer_hash(
    const uint8_t *sequence,
    uint32_t seq_length,
    uint32_t k,
    uint64_t *out_hashes,
    uint32_t *out_count
) {
    if (seq_length < k) {
        *out_count = 0;
        return;
    }

    uint32_t count = seq_length - k + 1;
    *out_count = count;

    for (uint32_t i = 0; i < count; i++) {
        uint64_t h = 0;
        for (uint32_t j = 0; j < k; j++) {
            h = mod_mul(h, HASH_BASE);
            h = (h + sequence[i + j]) % HASH_MOD;
        }
        out_hashes[i] = h;
    }
}
