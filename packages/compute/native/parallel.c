/**
 * Parallel operations using pthreads.
 * Apple Silicon has high-performance cores — use them all.
 */

#include "yalumba.h"
#include <stdlib.h>
#include <string.h>
#include <pthread.h>

/* ── Parallel k-mer set building ── */

typedef struct {
    const char **reads;
    uint32_t num_reads;
    uint32_t k;
    YalumbaKmerSet *result;
} BuildSetArgs;

static void *build_set_thread(void *arg) {
    BuildSetArgs *args = (BuildSetArgs *)arg;
    args->result = yalumba_build_kmer_set(args->reads, args->num_reads, args->k, 1);
    return NULL;
}

YalumbaKmerSet **yalumba_parallel_build_sets(
    const char ***reads_per_sample, const uint32_t *num_reads,
    uint32_t num_samples, uint32_t k
) {
    pthread_t *threads = (pthread_t *)malloc(num_samples * sizeof(pthread_t));
    BuildSetArgs *args = (BuildSetArgs *)malloc(num_samples * sizeof(BuildSetArgs));
    YalumbaKmerSet **results = (YalumbaKmerSet **)malloc(num_samples * sizeof(YalumbaKmerSet *));

    for (uint32_t i = 0; i < num_samples; i++) {
        args[i].reads = reads_per_sample[i];
        args[i].num_reads = num_reads[i];
        args[i].k = k;
        args[i].result = NULL;
        pthread_create(&threads[i], NULL, build_set_thread, &args[i]);
    }

    for (uint32_t i = 0; i < num_samples; i++) {
        pthread_join(threads[i], NULL);
        results[i] = args[i].result;
    }

    free(threads);
    free(args);
    return results;
}

/* ── Parallel run scanning ── */

typedef struct {
    const char **reads;
    uint32_t num_reads;
    uint32_t k;
    const YalumbaKmerSet *target;
    const YalumbaKmerSet *rare_filter;
    YalumbaRunResult *result;
} ScanRunsArgs;

static void *scan_runs_thread(void *arg) {
    ScanRunsArgs *args = (ScanRunsArgs *)arg;
    args->result = yalumba_scan_runs(
        args->reads, args->num_reads, args->k,
        args->target, args->rare_filter, 1
    );
    return NULL;
}

YalumbaRunResult **yalumba_parallel_scan_runs(
    const char ***reads_a, const uint32_t *num_reads_a,
    const YalumbaKmerSet **target_sets,
    const YalumbaKmerSet *rare_filter,
    uint32_t num_pairs, uint32_t k
) {
    pthread_t *threads = (pthread_t *)malloc(num_pairs * sizeof(pthread_t));
    ScanRunsArgs *args = (ScanRunsArgs *)malloc(num_pairs * sizeof(ScanRunsArgs));
    YalumbaRunResult **results = (YalumbaRunResult **)malloc(num_pairs * sizeof(YalumbaRunResult *));

    for (uint32_t i = 0; i < num_pairs; i++) {
        args[i].reads = reads_a[i];
        args[i].num_reads = num_reads_a[i];
        args[i].k = k;
        args[i].target = target_sets[i];
        args[i].rare_filter = rare_filter;
        args[i].result = NULL;
        pthread_create(&threads[i], NULL, scan_runs_thread, &args[i]);
    }

    for (uint32_t i = 0; i < num_pairs; i++) {
        pthread_join(threads[i], NULL);
        results[i] = args[i].result;
    }

    free(threads);
    free(args);
    return results;
}
