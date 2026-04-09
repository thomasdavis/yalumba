/**
 * Bun FFI bindings to the native C library.
 * Loads libyalumba-compute.dylib and exposes typed function wrappers.
 */

import { dlopen, FFIType, ptr, toArrayBuffer, CString } from "bun:ffi";
import { join } from "path";

const LIB_PATH = join(import.meta.dir, "../native/libyalumba-compute.dylib");

let lib: ReturnType<typeof dlopen> | null = null;

function getLib() {
  if (!lib) {
    try {
      lib = dlopen(LIB_PATH, {
        // K-mer hashing
        yalumba_fnv1a: { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.u32 },
        yalumba_canonical_hash: { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.u32 },
        yalumba_is_low_complexity: { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.i32 },

        // K-mer set
        yalumba_kset_create: { args: [FFIType.u32], returns: FFIType.ptr },
        yalumba_kset_free: { args: [FFIType.ptr], returns: FFIType.void },
        yalumba_kset_insert: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.void },
        yalumba_kset_contains: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
        yalumba_kset_count: { args: [FFIType.ptr], returns: FFIType.u32 },

        // Bulk operations
        yalumba_build_kmer_set: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.i32], returns: FFIType.ptr },

        // Rare filter
        yalumba_build_rare_set: { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.ptr },

        // Run scanning
        yalumba_scan_runs: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.ptr },
        yalumba_runs_free: { args: [FFIType.ptr], returns: FFIType.void },
        yalumba_runs_percentile: { args: [FFIType.ptr, FFIType.f64], returns: FFIType.f64 },
        yalumba_runs_mean: { args: [FFIType.ptr], returns: FFIType.f64 },
        yalumba_runs_max: { args: [FFIType.ptr], returns: FFIType.u32 },
        yalumba_runs_entropy: { args: [FFIType.ptr], returns: FFIType.f64 },

        // Bloom filter
        yalumba_bloom_create: { args: [FFIType.u64, FFIType.u32], returns: FFIType.ptr },
        yalumba_bloom_free: { args: [FFIType.ptr], returns: FFIType.void },
        yalumba_bloom_insert: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.void },
        yalumba_bloom_contains: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
      });
    } catch {
      return null;
    }
  }
  return lib;
}

/** Check if the native library is available */
export function isNativeAvailable(): boolean {
  return getLib() !== null;
}

/** Get the native library symbols (throws if not built) */
export function getNativeLib() {
  const l = getLib();
  if (!l) {
    throw new Error(
      "Native library not found. Run: cd packages/compute/native && make"
    );
  }
  return l.symbols;
}
