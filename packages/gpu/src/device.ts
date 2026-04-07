import type { DeviceInfo } from "./types.js";

/**
 * Abstract GPU device interface.
 * Implementations will target Vulkan (via native FFI) or WebGPU (browser).
 */
export class GpuDevice {
  private _info: DeviceInfo | null = null;

  /** Query device capabilities */
  info(): DeviceInfo {
    if (!this._info) {
      this._info = this.detectDevice();
    }
    return this._info;
  }

  /** Check if GPU compute is available in this environment */
  static isAvailable(): boolean {
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      return true;
    }
    return false;
  }

  /** Request a WebGPU device (browser environment) */
  static async requestWebGpu(): Promise<GPUDevice | null> {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    return adapter.requestDevice();
  }

  private detectDevice(): DeviceInfo {
    return {
      name: "CPU Fallback",
      vendor: "yalumba",
      maxWorkGroupSize: 256,
      maxBufferSize: 256 * 1024 * 1024,
      supportsFloat64: true,
    };
  }
}
