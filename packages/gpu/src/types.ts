/** Information about a GPU device */
export interface DeviceInfo {
  readonly name: string;
  readonly vendor: string;
  readonly maxWorkGroupSize: number;
  readonly maxBufferSize: number;
  readonly supportsFloat64: boolean;
}

/** Specification for a compute kernel */
export interface KernelSpec {
  /** Unique name identifying this kernel */
  readonly name: string;
  /** Path to the compiled SPIR-V binary, or inline shader source */
  readonly source: string | Uint8Array;
  /** Entry point function name */
  readonly entryPoint: string;
  /** Number of buffer bindings this kernel expects */
  readonly bindingCount: number;
}

/** Dimensions for dispatching a compute kernel */
export interface DispatchDimensions {
  readonly x: number;
  readonly y?: number;
  readonly z?: number;
}
