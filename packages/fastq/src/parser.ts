import type { FastqRecord, FastqStats, ParseOptions } from "./types.js";

const VALID_BASES = new Set(["A", "C", "G", "T", "N", "a", "c", "g", "t", "n"]);
const PHRED_OFFSET = 33;

/**
 * Parses FASTQ-formatted text into structured records.
 * Operates on complete text buffers — for streaming, use FastqStreamReader.
 */
export class FastqParser {
  private readonly options: Required<ParseOptions>;

  constructor(options: ParseOptions = {}) {
    this.options = {
      validateQuality: options.validateQuality ?? true,
      validateSequence: options.validateSequence ?? true,
      limit: options.limit ?? Infinity,
    };
  }

  /** Parse a complete FASTQ string into records */
  parse(text: string): FastqRecord[] {
    const lines = text.split("\n");
    const records: FastqRecord[] = [];
    let i = 0;

    while (i + 3 < lines.length && records.length < this.options.limit) {
      const headerLine = lines[i]!;
      const sequenceLine = lines[i + 1]!;
      const separatorLine = lines[i + 2]!;
      const qualityLine = lines[i + 3]!;

      if (!headerLine.startsWith("@")) {
        throw new FastqParseError(`Expected header starting with '@' at line ${i + 1}`, i + 1);
      }

      if (separatorLine.trim() !== "+") {
        throw new FastqParseError(`Expected '+' separator at line ${i + 3}`, i + 3);
      }

      const record = this.buildRecord(headerLine, sequenceLine, qualityLine, i + 1);
      records.push(record);
      i += 4;
    }

    return records;
  }

  /** Compute aggregate statistics from records */
  stats(records: readonly FastqRecord[]): FastqStats {
    if (records.length === 0) {
      return {
        recordCount: 0,
        totalBases: 0,
        averageLength: 0,
        minLength: 0,
        maxLength: 0,
        meanQuality: 0,
        gcContent: 0,
      };
    }

    let totalBases = 0;
    let minLength = Infinity;
    let maxLength = 0;
    let qualitySum = 0;
    let qualityCount = 0;
    let gcCount = 0;

    for (const record of records) {
      const len = record.sequence.length;
      totalBases += len;
      minLength = Math.min(minLength, len);
      maxLength = Math.max(maxLength, len);

      for (let i = 0; i < record.quality.length; i++) {
        qualitySum += record.quality.charCodeAt(i) - PHRED_OFFSET;
        qualityCount++;
      }

      for (let i = 0; i < len; i++) {
        const base = record.sequence[i];
        if (base === "G" || base === "C" || base === "g" || base === "c") {
          gcCount++;
        }
      }
    }

    return {
      recordCount: records.length,
      totalBases,
      averageLength: totalBases / records.length,
      minLength: minLength === Infinity ? 0 : minLength,
      maxLength,
      meanQuality: qualityCount > 0 ? qualitySum / qualityCount : 0,
      gcContent: totalBases > 0 ? gcCount / totalBases : 0,
    };
  }

  private buildRecord(
    headerLine: string,
    sequenceLine: string,
    qualityLine: string,
    lineNumber: number,
  ): FastqRecord {
    const header = headerLine.slice(1);
    const spaceIndex = header.indexOf(" ");
    const id = spaceIndex === -1 ? header : header.slice(0, spaceIndex);
    const description = spaceIndex === -1 ? "" : header.slice(spaceIndex + 1);
    const sequence = sequenceLine.trim();
    const quality = qualityLine.trim();

    if (this.options.validateQuality && sequence.length !== quality.length) {
      throw new FastqParseError(
        `Quality length (${quality.length}) != sequence length (${sequence.length})`,
        lineNumber,
      );
    }

    if (this.options.validateSequence) {
      for (let i = 0; i < sequence.length; i++) {
        if (!VALID_BASES.has(sequence[i]!)) {
          throw new FastqParseError(
            `Invalid base '${sequence[i]}' at position ${i}`,
            lineNumber + 1,
          );
        }
      }
    }

    return { id, description, sequence, quality };
  }
}

/** Error thrown during FASTQ parsing */
export class FastqParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`FASTQ parse error at line ${line}: ${message}`);
    this.name = "FastqParseError";
    this.line = line;
  }
}
