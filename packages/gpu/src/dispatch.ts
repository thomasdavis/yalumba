import type { KernelSpec, DispatchDimensions } from "./types.js";
import { GpuBuffer } from "./buffer.js";

/**
 * Dispatches compute kernels.
 * CPU fallback executes kernel logic synchronously.
 * GPU path will be implemented when SPIR-V pipeline is ready.
 */
export class KernelDispatcher {
  private readonly kernels = new Map<string, CpuKernelFn>();

  /** Register a CPU fallback implementation for a kernel */
  registerCpuFallback(name: string, fn: CpuKernelFn): void {
    this.kernels.set(name, fn);
  }

  /** Dispatch a kernel with the given buffers and dimensions */
  async dispatch(
    spec: KernelSpec,
    buffers: GpuBuffer[],
    dimensions: DispatchDimensions,
  ): Promise<void> {
    const cpuFn = this.kernels.get(spec.name);
    if (cpuFn) {
      cpuFn(buffers, dimensions);
      return;
    }

    throw new Error(
      `No implementation available for kernel '${spec.name}'. ` +
      `Register a CPU fallback or provide a compiled SPIR-V binary.`,
    );
  }
}

/** CPU fallback kernel function signature */
export type CpuKernelFn = (buffers: GpuBuffer[], dimensions: DispatchDimensions) => void;
