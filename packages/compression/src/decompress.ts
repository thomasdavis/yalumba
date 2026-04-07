/**
 * Streaming decompression using the built-in DecompressionStream API.
 * Available in Bun and modern browsers.
 */
export class DecompressionStream {
  /** Wrap a compressed ReadableStream with gzip decompression */
  static gunzip(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const ds = new globalThis.DecompressionStream("gzip");
    return stream.pipeThrough(ds);
  }

  /** Decompress a gzip-compressed Uint8Array */
  static async decompressBuffer(data: Uint8Array): Promise<Uint8Array> {
    const blob = new Blob([data]);
    const ds = new globalThis.DecompressionStream("gzip");
    const decompressedStream = blob.stream().pipeThrough(ds);
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}
