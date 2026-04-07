export interface ChunkReaderOptions {
  /** Chunk size in bytes (default: 64KB) */
  readonly chunkSize?: number;
}

const DEFAULT_CHUNK_SIZE = 64 * 1024;

/**
 * Reads a file in fixed-size chunks as a ReadableStream.
 * Works with Bun.file() or browser File API.
 */
export class ChunkReader {
  private readonly chunkSize: number;

  constructor(options: ChunkReaderOptions = {}) {
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  }

  /** Create a ReadableStream from a file path (Bun runtime) */
  fromPath(filePath: string): ReadableStream<Uint8Array> {
    const chunkSize = this.chunkSize;
    const file = Bun.file(filePath);

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let offset = 0;

        while (offset < bytes.length) {
          const end = Math.min(offset + chunkSize, bytes.length);
          controller.enqueue(bytes.slice(offset, end));
          offset = end;
        }

        controller.close();
      },
    });
  }

  /** Create a ReadableStream from a string (useful for testing) */
  fromString(text: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    const chunkSize = this.chunkSize;

    return new ReadableStream<Uint8Array>({
      start(controller) {
        let offset = 0;
        while (offset < bytes.length) {
          const end = Math.min(offset + chunkSize, bytes.length);
          controller.enqueue(bytes.slice(offset, end));
          offset = end;
        }
        controller.close();
      },
    });
  }

  /** Get the configured chunk size */
  getChunkSize(): number {
    return this.chunkSize;
  }
}
