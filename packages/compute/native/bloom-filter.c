/**
 * Bloom filter for memory-efficient k-mer membership testing.
 * Uses ~8 bits per element at 1% false positive rate.
 */

#include "yalumba.h"
#include <stdlib.h>
#include <string.h>

YalumbaBloom *yalumba_bloom_create(uint64_t num_bits, uint32_t num_hashes) {
    YalumbaBloom *bloom = (YalumbaBloom *)malloc(sizeof(YalumbaBloom));
    uint64_t bytes = (num_bits + 7) / 8;
    bloom->bits = (uint8_t *)calloc(bytes, 1);
    bloom->num_bits = num_bits;
    bloom->num_hashes = num_hashes;
    return bloom;
}

void yalumba_bloom_free(YalumbaBloom *bloom) {
    if (bloom) {
        free(bloom->bits);
        free(bloom);
    }
}

static inline uint64_t bloom_hash(uint32_t h, uint32_t i, uint64_t num_bits) {
    /* Double hashing: h1 + i*h2 */
    uint64_t h1 = (uint64_t)h;
    uint64_t h2 = (uint64_t)(h * 0x9e3779b9);
    return (h1 + i * h2) % num_bits;
}

void yalumba_bloom_insert(YalumbaBloom *bloom, uint32_t hash) {
    for (uint32_t i = 0; i < bloom->num_hashes; i++) {
        uint64_t bit = bloom_hash(hash, i, bloom->num_bits);
        bloom->bits[bit / 8] |= (1 << (bit % 8));
    }
}

int yalumba_bloom_contains(const YalumbaBloom *bloom, uint32_t hash) {
    for (uint32_t i = 0; i < bloom->num_hashes; i++) {
        uint64_t bit = bloom_hash(hash, i, bloom->num_bits);
        if (!(bloom->bits[bit / 8] & (1 << (bit % 8)))) return 0;
    }
    return 1;
}
