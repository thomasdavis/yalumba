/**
 * Run scanning — detect consecutive shared k-mer runs.
 * The core operation for all relatedness algorithms.
 */

#include "yalumba.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>

static int compare_uint32(const void *a, const void *b) {
    uint32_t va = *(const uint32_t *)a;
    uint32_t vb = *(const uint32_t *)b;
    return (va > vb) - (va < vb);
}

YalumbaRunResult *yalumba_scan_runs(
    const char **reads, uint32_t num_reads, uint32_t k,
    const YalumbaKmerSet *target_set,
    const YalumbaKmerSet *rare_filter,
    int filter_low_complexity
) {
    YalumbaRunResult *result = (YalumbaRunResult *)malloc(sizeof(YalumbaRunResult));
    result->capacity = 1024 * 64;
    result->run_lengths = (uint32_t *)malloc(result->capacity * sizeof(uint32_t));
    result->num_runs = 0;
    result->total_shared = 0;
    result->total_scanned = 0;

    for (uint32_t r = 0; r < num_reads; r++) {
        const char *read = reads[r];
        uint32_t len = (uint32_t)strlen(read);
        if (len < k) continue;

        uint32_t run = 0;
        for (uint32_t i = 0; i <= len - k; i++) {
            if (filter_low_complexity && yalumba_is_low_complexity(read, i, k)) continue;
            uint32_t h = yalumba_canonical_hash(read, i, k);
            result->total_scanned++;

            int passes_filter = (rare_filter == NULL) || yalumba_kset_contains(rare_filter, h);
            int in_target = yalumba_kset_contains(target_set, h);

            if (passes_filter && in_target) {
                run++;
                result->total_shared++;
            } else {
                if (run > 0) {
                    /* Grow array if needed */
                    if (result->num_runs >= result->capacity) {
                        result->capacity *= 2;
                        result->run_lengths = (uint32_t *)realloc(
                            result->run_lengths,
                            result->capacity * sizeof(uint32_t)
                        );
                    }
                    result->run_lengths[result->num_runs++] = run;
                    run = 0;
                }
            }
        }
        if (run > 0) {
            if (result->num_runs >= result->capacity) {
                result->capacity *= 2;
                result->run_lengths = (uint32_t *)realloc(
                    result->run_lengths,
                    result->capacity * sizeof(uint32_t)
                );
            }
            result->run_lengths[result->num_runs++] = run;
        }
    }

    return result;
}

void yalumba_runs_free(YalumbaRunResult *result) {
    if (result) {
        free(result->run_lengths);
        free(result);
    }
}

double yalumba_runs_percentile(const YalumbaRunResult *result, double percentile) {
    if (result->num_runs == 0) return 0.0;

    /* Sort a copy */
    uint32_t *sorted = (uint32_t *)malloc(result->num_runs * sizeof(uint32_t));
    memcpy(sorted, result->run_lengths, result->num_runs * sizeof(uint32_t));
    qsort(sorted, result->num_runs, sizeof(uint32_t), compare_uint32);

    uint32_t idx = (uint32_t)(result->num_runs * percentile / 100.0);
    if (idx >= result->num_runs) idx = result->num_runs - 1;
    double val = (double)sorted[idx];
    free(sorted);
    return val;
}

double yalumba_runs_mean(const YalumbaRunResult *result) {
    if (result->num_runs == 0) return 0.0;
    uint64_t sum = 0;
    for (uint32_t i = 0; i < result->num_runs; i++) {
        sum += result->run_lengths[i];
    }
    return (double)sum / (double)result->num_runs;
}

uint32_t yalumba_runs_max(const YalumbaRunResult *result) {
    uint32_t max = 0;
    for (uint32_t i = 0; i < result->num_runs; i++) {
        if (result->run_lengths[i] > max) max = result->run_lengths[i];
    }
    return max;
}

double yalumba_runs_entropy(const YalumbaRunResult *result) {
    if (result->num_runs == 0) return 0.0;

    /* Count run-length frequencies */
    uint32_t max_len = yalumba_runs_max(result);
    uint32_t *freq = (uint32_t *)calloc(max_len + 1, sizeof(uint32_t));
    for (uint32_t i = 0; i < result->num_runs; i++) {
        freq[result->run_lengths[i]]++;
    }

    double entropy = 0.0;
    for (uint32_t i = 1; i <= max_len; i++) {
        if (freq[i] > 0) {
            double p = (double)freq[i] / (double)result->num_runs;
            entropy -= p * log2(p);
        }
    }

    free(freq);
    return entropy;
}
