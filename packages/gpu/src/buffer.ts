/**
 * GPU buffer abstraction for transferring data to/from GPU memory.
 * Falls back to regular TypedArrays when no GPU is available.
 */
export class GpuBuffer {
  private readonly data: ArrayBuffer;
  readonly byteLength: number;

  constructor(byteLength: number) {
    this.data = new ArrayBuffer(byteLength);
    this.byteLength = byteLength;
  }

  /** Create a GpuBuffer from existing data */
  static from(source: ArrayBuffer | Uint8Array | Uint32Array | Float32Array): GpuBuffer {
    const buffer = new GpuBuffer(source.byteLength);
    new Uint8Array(buffer.data).set(
      source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(source.buffer, source.byteOffset, source.byteLength),
    );
    return buffer;
  }

  /** Get a typed view of the buffer */
  asUint8(): Uint8Array {
    return new Uint8Array(this.data);
  }

  asUint32(): Uint32Array {
    return new Uint32Array(this.data);
  }

  asFloat32(): Float32Array {
    return new Float32Array(this.data);
  }

  /** Copy data into this buffer */
  write(source: Uint8Array, offset: number = 0): void {
    new Uint8Array(this.data).set(source, offset);
  }

  /** Read data from this buffer */
  read(offset: number = 0, length?: number): Uint8Array {
    return new Uint8Array(this.data, offset, length);
  }

  /** Get the backing ArrayBuffer */
  arrayBuffer(): ArrayBuffer {
    return this.data;
  }
}
