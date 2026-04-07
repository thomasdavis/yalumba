const GZIP_MAGIC_1 = 0x1f;
const GZIP_MAGIC_2 = 0x8b;

/** Detects gzip-compressed data by checking magic bytes */
export class GzipDetector {
  /** Check if a buffer starts with gzip magic bytes */
  static isGzipped(data: Uint8Array): boolean {
    return data.length >= 2 && data[0] === GZIP_MAGIC_1 && data[1] === GZIP_MAGIC_2;
  }

  /** Check if a file path suggests gzip compression */
  static hasGzipExtension(path: string): boolean {
    return path.endsWith(".gz") || path.endsWith(".gzip");
  }
}
