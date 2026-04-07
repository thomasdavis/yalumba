import type { FastqRecord, ParseOptions } from "./types.js";
import { FastqParser } from "./parser.js";

/**
 * Reads FASTQ data as a stream of records.
 * Buffers partial lines and yields complete 4-line records.
 */
export class FastqStreamReader {
  private readonly parser: FastqParser;
  private buffer: string = "";

  constructor(options: ParseOptions = {}) {
    this.parser = new FastqParser(options);
  }

  /** Push a chunk of text into the stream buffer */
  push(chunk: string): FastqRecord[] {
    this.buffer += chunk;
    return this.drain();
  }

  /** Flush any remaining data in the buffer */
  flush(): FastqRecord[] {
    const records = this.drain();
    if (this.buffer.trim().length > 0) {
      throw new Error("Incomplete FASTQ record in buffer at end of stream");
    }
    return records;
  }

  /** Create an async iterator from a ReadableStream */
  async *fromReadable(stream: ReadableStream<Uint8Array>): AsyncGenerator<FastqRecord[]> {
    const decoder = new TextDecoder();
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const records = this.push(chunk);
        if (records.length > 0) {
          yield records;
        }
      }

      const remaining = this.flush();
      if (remaining.length > 0) {
        yield remaining;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private drain(): FastqRecord[] {
    const lines = this.buffer.split("\n");

    const completeLineCount = lines.length - 1;
    const completeRecordCount = Math.floor(completeLineCount / 4);

    if (completeRecordCount === 0) {
      return [];
    }

    const usedLineCount = completeRecordCount * 4;
    const text = lines.slice(0, usedLineCount).join("\n") + "\n";
    this.buffer = lines.slice(usedLineCount).join("\n");

    return this.parser.parse(text);
  }
}
