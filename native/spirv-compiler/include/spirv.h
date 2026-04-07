/**
 * yalumba SPIR-V definitions
 *
 * SPIR-V magic number and header constants
 * for the custom compiler pipeline.
 */

#ifndef YALUMBA_SPIRV_H
#define YALUMBA_SPIRV_H

#include <stdint.h>

#define SPIRV_MAGIC 0x07230203
#define SPIRV_VERSION 0x00010300

typedef struct {
    uint32_t magic;
    uint32_t version;
    uint32_t generator;
    uint32_t bound;
    uint32_t reserved;
} SpirVHeader;

#endif /* YALUMBA_SPIRV_H */
