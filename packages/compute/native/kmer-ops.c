/**
 * Core k-mer operations — hashing, set building, low-complexity detection.
 */

#include "yalumba.h"
#include <stdlib.h>
#include <string.h>

/* ── Hashing ── */

uint32_t yalumba_fnv1a(const char *data, uint32_t offset, uint32_t len) {
    uint32_t h = 0x811c9dc5;
    for (uint32_t i = offset; i < offset + len; i++) {
        h ^= (uint8_t)data[i];
        h *= 0x01000193;
    }
    return h;
}

static inline uint8_t complement_base(uint8_t c) {
    switch (c) {
        case 'A': case 'a': return 'T';
        case 'T': case 't': return 'A';
        case 'C': case 'c': return 'G';
        case 'G': case 'g': return 'C';
        default: return 'N';
    }
}

uint32_t yalumba_canonical_hash(const char *seq, uint32_t offset, uint32_t k) {
    uint32_t fwd = yalumba_fnv1a(seq, offset, k);

    /* Reverse complement hash */
    uint32_t rev = 0x811c9dc5;
    for (int i = (int)(offset + k - 1); i >= (int)offset; i--) {
        rev ^= (uint8_t)complement_base((uint8_t)seq[i]);
        rev *= 0x01000193;
    }

    return fwd < rev ? fwd : rev;
}

int yalumba_is_low_complexity(const char *seq, uint32_t offset, uint32_t k) {
    /* Check: dominated by single base (>80%) */
    uint32_t counts[4] = {0, 0, 0, 0};
    for (uint32_t i = offset; i < offset + k; i++) {
        uint8_t c = (uint8_t)seq[i];
        if (c == 'A' || c == 'a') counts[0]++;
        else if (c == 'C' || c == 'c') counts[1]++;
        else if (c == 'G' || c == 'g') counts[2]++;
        else if (c == 'T' || c == 't') counts[3]++;
    }
    uint32_t max = counts[0];
    for (int i = 1; i < 4; i++) {
        if (counts[i] > max) max = counts[i];
    }
    if (max > k * 8 / 10) return 1;

    /* Check: dinucleotide repeat (>60%) */
    uint32_t di_repeat = 0;
    for (uint32_t i = offset + 2; i < offset + k; i++) {
        if (seq[i] == seq[i - 2]) di_repeat++;
    }
    if (di_repeat > (k - 2) * 6 / 10) return 1;

    return 0;
}

/* ── K-mer set (open addressing hash table) ── */

#define EMPTY_SLOT 0
#define TOMBSTONE 1

YalumbaKmerSet *yalumba_kset_create(uint32_t capacity) {
    /* Round up to power of 2 */
    uint32_t cap = 1;
    while (cap < capacity * 2) cap <<= 1; /* 50% load factor */

    YalumbaKmerSet *set = (YalumbaKmerSet *)malloc(sizeof(YalumbaKmerSet));
    set->buckets = (uint32_t *)calloc(cap, sizeof(uint32_t));
    set->capacity = cap;
    set->count = 0;
    return set;
}

void yalumba_kset_free(YalumbaKmerSet *set) {
    if (set) {
        free(set->buckets);
        free(set);
    }
}

void yalumba_kset_insert(YalumbaKmerSet *set, uint32_t hash) {
    if (hash <= TOMBSTONE) hash = TOMBSTONE + 1; /* Reserve 0 and 1 */
    uint32_t mask = set->capacity - 1;
    uint32_t idx = hash & mask;

    while (set->buckets[idx] != EMPTY_SLOT) {
        if (set->buckets[idx] == hash) return; /* Already present */
        idx = (idx + 1) & mask;
    }
    set->buckets[idx] = hash;
    set->count++;

    /* Resize if >70% full */
    if (set->count * 10 > set->capacity * 7) {
        uint32_t old_cap = set->capacity;
        uint32_t *old_buckets = set->buckets;
        set->capacity = old_cap * 2;
        set->buckets = (uint32_t *)calloc(set->capacity, sizeof(uint32_t));
        set->count = 0;
        uint32_t new_mask = set->capacity - 1;
        for (uint32_t i = 0; i < old_cap; i++) {
            if (old_buckets[i] > TOMBSTONE) {
                uint32_t h = old_buckets[i];
                uint32_t j = h & new_mask;
                while (set->buckets[j] != EMPTY_SLOT) j = (j + 1) & new_mask;
                set->buckets[j] = h;
                set->count++;
            }
        }
        free(old_buckets);
    }
}

int yalumba_kset_contains(const YalumbaKmerSet *set, uint32_t hash) {
    if (hash <= TOMBSTONE) hash = TOMBSTONE + 1;
    uint32_t mask = set->capacity - 1;
    uint32_t idx = hash & mask;

    while (set->buckets[idx] != EMPTY_SLOT) {
        if (set->buckets[idx] == hash) return 1;
        idx = (idx + 1) & mask;
    }
    return 0;
}

uint32_t yalumba_kset_count(const YalumbaKmerSet *set) {
    return set->count;
}

/* ── Bulk operations ── */

YalumbaKmerSet *yalumba_build_kmer_set(
    const char **reads, uint32_t num_reads, uint32_t k,
    int filter_low_complexity
) {
    YalumbaKmerSet *set = yalumba_kset_create(num_reads * 128);

    for (uint32_t r = 0; r < num_reads; r++) {
        const char *read = reads[r];
        uint32_t len = (uint32_t)strlen(read);
        if (len < k) continue;

        for (uint32_t i = 0; i <= len - k; i++) {
            if (filter_low_complexity && yalumba_is_low_complexity(read, i, k)) continue;
            yalumba_kset_insert(set, yalumba_canonical_hash(read, i, k));
        }
    }
    return set;
}
