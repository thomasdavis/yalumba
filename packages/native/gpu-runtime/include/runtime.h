/**
 * yalumba GPU runtime API
 */

#ifndef YALUMBA_RUNTIME_H
#define YALUMBA_RUNTIME_H

#include <stdint.h>

typedef struct {
    char name[128];
    uint32_t max_workgroup_size;
    uint32_t max_buffer_size;
    int available;
} YalumbaDevice;

typedef struct {
    void *data;
    uint32_t size;
    int device_local;
} YalumbaBuffer;

int yalumba_gpu_init(YalumbaDevice *device);
int yalumba_gpu_alloc(YalumbaBuffer *buffer, uint32_t size);
void yalumba_gpu_free(YalumbaBuffer *buffer);
int yalumba_gpu_dispatch(const char *kernel_name, uint32_t workgroups);

#endif /* YALUMBA_RUNTIME_H */
