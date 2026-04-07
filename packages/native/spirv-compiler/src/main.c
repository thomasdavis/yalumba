/**
 * yalumba SPIR-V compiler
 *
 * Compiles GLSL compute shaders to SPIR-V binary format.
 * This is a stub — will be implemented when the GPU pipeline is active.
 *
 * Build: cc -o spirv-compile src/main.c
 * Usage: spirv-compile input.comp output.spv
 */

#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    if (argc < 3) {
        fprintf(stderr, "Usage: %s <input.comp> <output.spv>\n", argv[0]);
        return 1;
    }

    printf("yalumba spirv-compiler\n");
    printf("Input:  %s\n", argv[1]);
    printf("Output: %s\n", argv[2]);
    printf("Status: not yet implemented\n");

    return 0;
}
