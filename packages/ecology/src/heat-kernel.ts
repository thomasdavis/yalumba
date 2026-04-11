/**
 * Multi-scale heat kernel signatures.
 *
 * The heat kernel K_t = exp(-tL) describes diffusion on the graph
 * at timescale t. Small t captures local neighborhood structure,
 * large t captures global topology.
 *
 * For each node j, the heat kernel signature is:
 *   HKS(j, t) = Σ_k exp(-t * λ_k) * φ_k(j)²
 *
 * The graph-level trace is:
 *   trace(K_t) = Σ_k exp(-t * λ_k)
 *
 * By evaluating at multiple timescales, we get a multi-scale
 * fingerprint that's invariant to node permutation — two graphs
 * with identical spectra produce identical traces regardless of
 * which node is which. This is the core mechanism for identity-free
 * comparison.
 */

import type { EigenDecomposition, HeatKernelTrace } from "./types.js";

/** Default timescales: logarithmically spaced from local to global */
const DEFAULT_TIMESCALES = [
  0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0,
] as const;

/**
 * Compute multi-scale heat kernel signatures from eigendecomposition.
 *
 * @param eigen - Eigenvalues and eigenvectors of the normalized Laplacian
 * @param timescales - Array of diffusion timescales to evaluate
 */
export function computeHeatKernel(
  eigen: EigenDecomposition,
  timescales: readonly number[] = DEFAULT_TIMESCALES,
): HeatKernelTrace {
  const n = eigen.values.length;
  const T = timescales.length;
  const traces = new Float64Array(T);
  const nodeSignatures: Float64Array[] = [];

  // Initialize per-node signature arrays
  for (let j = 0; j < n; j++) {
    nodeSignatures.push(new Float64Array(T));
  }

  for (let ti = 0; ti < T; ti++) {
    const t = timescales[ti]!;

    // Precompute exp(-t * λ_k) for all eigenvalues
    const expTL = new Float64Array(n);
    let trace = 0;
    for (let k = 0; k < n; k++) {
      const val = Math.exp(-t * eigen.values[k]!);
      expTL[k] = val;
      trace += val;
    }
    traces[ti] = trace;

    // Per-node HKS: Σ_k exp(-t * λ_k) * φ_k(j)²
    for (let j = 0; j < n; j++) {
      let hks = 0;
      for (let k = 0; k < n; k++) {
        const phi = eigen.vectors.data[j * n + k]!;
        hks += expTL[k]! * phi * phi;
      }
      nodeSignatures[j]![ti] = hks;
    }
  }

  return { timescales: [...timescales], traces, nodeSignatures };
}

/**
 * Compute normalized heat trace — divides by n so traces are
 * comparable across graphs of different sizes.
 */
export function normalizedTraces(trace: HeatKernelTrace): Float64Array {
  const n = trace.nodeSignatures.length;
  if (n === 0) return new Float64Array(trace.traces.length);
  const normalized = new Float64Array(trace.traces.length);
  for (let i = 0; i < trace.traces.length; i++) {
    normalized[i] = trace.traces[i]! / n;
  }
  return normalized;
}

/**
 * Log-scale heat trace — log(trace(K_t)) at each timescale.
 * Log-scale is more numerically stable for comparison since
 * traces span many orders of magnitude.
 */
export function logTraces(trace: HeatKernelTrace): Float64Array {
  const out = new Float64Array(trace.traces.length);
  const n = trace.nodeSignatures.length || 1;
  for (let i = 0; i < trace.traces.length; i++) {
    out[i] = Math.log(trace.traces[i]! / n + 1e-300);
  }
  return out;
}
