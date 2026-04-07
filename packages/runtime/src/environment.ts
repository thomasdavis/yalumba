/** Detects the runtime environment and available capabilities */
export class Environment {
  /** Check if running in Bun */
  static isBun(): boolean {
    return typeof globalThis.Bun !== "undefined";
  }

  /** Check if running in a browser */
  static isBrowser(): boolean {
    return typeof globalThis.window !== "undefined";
  }

  /** Check if running in Node.js */
  static isNode(): boolean {
    return typeof globalThis.process !== "undefined" && !Environment.isBun();
  }

  /** Check if WebGPU is available */
  static hasWebGpu(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  /** Get available memory in bytes (approximate) */
  static availableMemory(): number {
    if (Environment.isBun() || Environment.isNode()) {
      const os = globalThis.process?.memoryUsage?.();
      return os ? os.heapTotal - os.heapUsed : 4 * 1024 * 1024 * 1024;
    }
    return 2 * 1024 * 1024 * 1024;
  }

  /** Get the number of available CPU cores */
  static cpuCount(): number {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    return 4;
  }
}
