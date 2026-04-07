import type { FastqRecord } from "./types.js";

const VALID_BASES_REGEX = /^[ACGTNacgtn]+$/;

/** Validates FASTQ records for structural and content correctness */
export class FastqValidator {
  /** Check if a record has valid structure */
  validateRecord(record: FastqRecord): ValidationResult {
    const errors: string[] = [];

    if (record.id.length === 0) {
      errors.push("Empty sequence identifier");
    }

    if (record.sequence.length === 0) {
      errors.push("Empty sequence");
    }

    if (!VALID_BASES_REGEX.test(record.sequence)) {
      errors.push("Sequence contains invalid characters");
    }

    if (record.sequence.length !== record.quality.length) {
      errors.push(
        `Quality length (${record.quality.length}) does not match sequence length (${record.sequence.length})`,
      );
    }

    for (let i = 0; i < record.quality.length; i++) {
      const score = record.quality.charCodeAt(i) - 33;
      if (score < 0 || score > 93) {
        errors.push(`Invalid quality score at position ${i}: ${score}`);
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /** Validate an array of records, returning only invalid ones */
  validateBatch(records: readonly FastqRecord[]): Map<number, ValidationResult> {
    const invalid = new Map<number, ValidationResult>();

    for (let i = 0; i < records.length; i++) {
      const result = this.validateRecord(records[i]!);
      if (!result.valid) {
        invalid.set(i, result);
      }
    }

    return invalid;
  }
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}
