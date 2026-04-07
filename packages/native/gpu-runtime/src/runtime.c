/**
 * yalumba GPU runtime
 *
 * Manages GPU device initialization, buffer allocation,
 * and kernel dispatch via Vulkan compute.
 *
 * Stub implementation — returns CPU fallback info.
 */

#include <stdio.h>
#include <string.h>
#include "../include/runtime.h"

int yalumba_gpu_init(YalumbaDevice *device) {
    if (!device) return -1;

    strncpy(device->name, "CPU Fallback", sizeof(device->name) - 1);
    device->name[sizeof(device->name) - 1] = '\0';
    device->max_workgroup_size = 256;
    device->max_buffer_size = 256 * 1024 * 1024;
    device->available = 0;

    return 0;
}

int yalumba_gpu_alloc(YalumbaBuffer *buffer, uint32_t size) {
    if (!buffer) return -1;
    buffer->size = size;
    buffer->data = NULL;
    buffer->device_local = 0;
    return 0;
}

void yalumba_gpu_free(YalumbaBuffer *buffer) {
    if (buffer) {
        buffer->data = NULL;
        buffer->size = 0;
    }
}

int yalumba_gpu_dispatch(const char *kernel_name, uint32_t workgroups) {
    printf("dispatch: kernel=%s workgroups=%u (CPU fallback)\n",
           kernel_name, workgroups);
    return 0;
}
