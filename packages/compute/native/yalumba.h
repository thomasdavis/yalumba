/**
 * yalumba native compute library
 * High-performance k-mer operations for relatedness detection.
 * Built as a shared library, called from TypeScript via Bun FFI.
 */

#ifndef YALUMBA_COMPUTE_H
#define YALUMBA_COMPUTE_H

#include <stdint.h>
#include <stddef.h>

/* ── K-mer hashing ── */

/** FNV-1a hash of a byte sequence */
uint32_t yalumba_fnv1a(const char *data, uint32_t offset, uint32_t len);

/** Canonical k-mer hash: min(forward, reverse_complement) */
uint32_t yalumba_canonical_hash(const char *seq, uint32_t offset, uint32_t k);

/* ── K-mer set (hash set with open addressing) ── */

typedef struct {
    uint32_t *buckets;
    uint32_t capacity;
    uint32_t count;
} YalumbaKmerSet;

/** Create a new k-mer set with given capacity */
YalumbaKmerSet *yalumba_kset_create(uint32_t capacity);

/** Free a k-mer set */
void yalumba_kset_free(YalumbaKmerSet *set);

/** Insert a k-mer hash into the set */
void yalumba_kset_insert(YalumbaKmerSet *set, uint32_t hash);

/** Check if a k-mer hash is in the set */
int yalumba_kset_contains(const YalumbaKmerSet *set, uint32_t hash);

/** Get the count of elements in the set */
uint32_t yalumba_kset_count(const YalumbaKmerSet *set);

/* ── Bulk operations ── */

/**
 * Build a k-mer set from reads.
 * reads: null-terminated array of null-terminated read strings
 * num_reads: number of reads
 * k: k-mer size
 * filter_low_complexity: 1 to filter, 0 to include all
 */
YalumbaKmerSet *yalumba_build_kmer_set(
    const char **reads, uint32_t num_reads, uint32_t k,
    int filter_low_complexity
);

/**
 * Build a k-mer set with rarity filtering.
 * Only includes k-mers present in < max_presence samples.
 * sample_sets: array of YalumbaKmerSet pointers (one per sample)
 * num_samples: number of samples
 * max_presence: maximum sample count for a k-mer to be "rare"
 */
YalumbaKmerSet *yalumba_build_rare_set(
    YalumbaKmerSet **sample_sets, uint32_t num_samples,
    uint32_t max_presence
);

/* ── Run scanning ── */

typedef struct {
    uint32_t *run_lengths;
    uint32_t num_runs;
    uint32_t total_shared;
    uint32_t total_scanned;
    uint32_t capacity;
} YalumbaRunResult;

/**
 * Scan reads for consecutive shared k-mer runs against a target set.
 * Optionally filter by a rare k-mer set.
 * Returns run lengths for statistical analysis.
 */
YalumbaRunResult *yalumba_scan_runs(
    const char **reads, uint32_t num_reads, uint32_t k,
    const YalumbaKmerSet *target_set,
    const YalumbaKmerSet *rare_filter,  /* NULL = no filter */
    int filter_low_complexity
);

/** Free a run result */
void yalumba_runs_free(YalumbaRunResult *result);

/* ── Statistics on run results ── */

/** Compute percentile (0-100) of run lengths */
double yalumba_runs_percentile(const YalumbaRunResult *result, double percentile);

/** Compute mean run length */
double yalumba_runs_mean(const YalumbaRunResult *result);

/** Compute max run length */
uint32_t yalumba_runs_max(const YalumbaRunResult *result);

/** Compute Shannon entropy of run-length distribution */
double yalumba_runs_entropy(const YalumbaRunResult *result);

/* ── Parallel operations ── */

/**
 * Build k-mer sets for multiple samples in parallel.
 * reads_per_sample: array of arrays of read strings
 * num_reads: array of read counts per sample
 * num_samples: number of samples
 * k: k-mer size
 * Returns array of YalumbaKmerSet pointers (caller frees each).
 */
YalumbaKmerSet **yalumba_parallel_build_sets(
    const char ***reads_per_sample, const uint32_t *num_reads,
    uint32_t num_samples, uint32_t k
);

/**
 * Scan runs for multiple pairs in parallel.
 * Returns array of YalumbaRunResult pointers.
 */
YalumbaRunResult **yalumba_parallel_scan_runs(
    const char ***reads_a, const uint32_t *num_reads_a,
    const YalumbaKmerSet **target_sets,
    const YalumbaKmerSet *rare_filter,
    uint32_t num_pairs, uint32_t k
);

/* ── Low-complexity detection ── */

/** Check if a k-mer is low-complexity (homopolymer or dinucleotide repeat) */
int yalumba_is_low_complexity(const char *seq, uint32_t offset, uint32_t k);

/* ── Bloom filter (memory-efficient k-mer membership) ── */

typedef struct {
    uint8_t *bits;
    uint64_t num_bits;
    uint32_t num_hashes;
} YalumbaBloom;

/** Create a bloom filter with given size and hash count */
YalumbaBloom *yalumba_bloom_create(uint64_t num_bits, uint32_t num_hashes);

/** Free a bloom filter */
void yalumba_bloom_free(YalumbaBloom *bloom);

/** Insert a hash into the bloom filter */
void yalumba_bloom_insert(YalumbaBloom *bloom, uint32_t hash);

/** Check membership (may have false positives) */
int yalumba_bloom_contains(const YalumbaBloom *bloom, uint32_t hash);

#endif /* YALUMBA_COMPUTE_H */
