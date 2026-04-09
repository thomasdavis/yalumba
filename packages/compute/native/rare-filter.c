/**
 * Rare k-mer set construction.
 * Builds a set of k-mers present in fewer than N samples.
 */

#include "yalumba.h"
#include <stdlib.h>

YalumbaKmerSet *yalumba_build_rare_set(
    YalumbaKmerSet **sample_sets, uint32_t num_samples,
    uint32_t max_presence
) {
    /* For each k-mer in any sample set, count how many sets contain it */
    /* Use a hash map: kmer_hash -> count */
    /* Then filter to those with count < max_presence */

    /* First pass: collect all unique k-mers with counts */
    typedef struct { uint32_t hash; uint32_t count; } KmerCount;

    /* Use a simple hash table */
    uint32_t table_cap = 1 << 22; /* 4M buckets */
    KmerCount *table = (KmerCount *)calloc(table_cap, sizeof(KmerCount));
    uint32_t mask = table_cap - 1;

    for (uint32_t s = 0; s < num_samples; s++) {
        YalumbaKmerSet *set = sample_sets[s];
        for (uint32_t i = 0; i < set->capacity; i++) {
            uint32_t h = set->buckets[i];
            if (h <= 1) continue; /* EMPTY or TOMBSTONE */

            /* Find or insert in count table */
            uint32_t idx = h & mask;
            while (table[idx].hash != 0 && table[idx].hash != h) {
                idx = (idx + 1) & mask;
            }
            if (table[idx].hash == 0) {
                table[idx].hash = h;
                table[idx].count = 1;
            } else {
                table[idx].count++;
            }
        }
    }

    /* Second pass: collect rare k-mers */
    YalumbaKmerSet *rare = yalumba_kset_create(table_cap / 4);
    for (uint32_t i = 0; i < table_cap; i++) {
        if (table[i].hash != 0 && table[i].count < max_presence) {
            yalumba_kset_insert(rare, table[i].hash);
        }
    }

    free(table);
    return rare;
}
