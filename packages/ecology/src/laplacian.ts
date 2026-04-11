/**
 * Graph Laplacian computation and eigendecomposition.
 *
 * Computes the normalized Laplacian L_sym = I - D^{-1/2} A D^{-1/2}
 * and decomposes it via the Jacobi eigenvalue algorithm.
 *
 * For module-level graphs (50-200 nodes), dense eigendecomposition
 * is tractable and exact. No iterative approximations needed.
 */

import type { DenseMatrix, EigenDecomposition } from "./types.js";

/**
 * Compute the normalized graph Laplacian from an adjacency matrix.
 *
 * L_sym = I - D^{-1/2} A D^{-1/2}
 *
 * Properties:
 * - Symmetric positive semidefinite
 * - Eigenvalues in [0, 2]
 * - λ₁ = 0 always (constant eigenvector)
 * - λ₂ = algebraic connectivity (Fiedler value)
 */
export function normalizedLaplacian(adjacency: DenseMatrix): DenseMatrix {
  const n = adjacency.rows;
  const A = adjacency.data;
  const L = new Float64Array(n * n);

  // Compute degree vector
  const deg = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let j = 0; j < n; j++) d += A[i * n + j]!;
    deg[i] = d;
  }

  // D^{-1/2}
  const dinvSqrt = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    dinvSqrt[i] = deg[i]! > 1e-12 ? 1.0 / Math.sqrt(deg[i]!) : 0;
  }

  // L_sym = I - D^{-1/2} A D^{-1/2}
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const normalized = dinvSqrt[i]! * A[i * n + j]! * dinvSqrt[j]!;
      L[i * n + j] = (i === j ? 1.0 : 0.0) - normalized;
    }
  }

  return { data: L, rows: n, cols: n };
}

/**
 * Eigendecomposition of a symmetric matrix via Jacobi rotations.
 *
 * The Jacobi algorithm iteratively applies Givens rotations to
 * zero out off-diagonal elements. For an n×n matrix it converges
 * in O(n²) sweeps, each O(n²) work, giving O(n⁴) worst case.
 * For n ≤ 200 this is sub-second.
 *
 * Returns eigenvalues in ascending order with corresponding
 * eigenvectors as columns.
 */
export function eigenDecomposition(
  matrix: DenseMatrix,
  maxSweeps: number = 100,
  tolerance: number = 1e-12,
): EigenDecomposition {
  const n = matrix.rows;
  if (n === 0) {
    return {
      values: new Float64Array(0),
      vectors: { data: new Float64Array(0), rows: 0, cols: 0 },
    };
  }

  // Work on a copy
  const A = new Float64Array(matrix.data);
  // Eigenvectors accumulator — starts as identity
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1.0;

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    // Check convergence: sum of squares of off-diagonal elements
    let offDiagSum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        offDiagSum += A[i * n + j]! * A[i * n + j]!;
      }
    }
    if (offDiagSum < tolerance) break;

    // Sweep: for each off-diagonal pair, apply Givens rotation
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q]!;
        if (Math.abs(apq) < tolerance * 0.01) continue;

        const app = A[p * n + p]!;
        const aqq = A[q * n + q]!;
        const tau = (aqq - app) / (2.0 * apq);

        // Compute tan(θ), choosing the smaller root for stability
        // When tau = 0 (equal diagonal), Math.sign(0) = 0 in JS,
        // so we explicitly handle this: use t = 1 (rotation angle π/4)
        let t: number;
        if (Math.abs(tau) < 1e-15) {
          t = 1.0;
        } else if (Math.abs(tau) > 1e15) {
          t = 1.0 / (2.0 * tau);
        } else {
          t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1.0 + tau * tau));
        }

        const c = 1.0 / Math.sqrt(1.0 + t * t);
        const s = t * c;

        // Apply rotation to A: rows/cols p and q
        applyJacobiRotation(A, n, p, q, c, s);

        // Accumulate eigenvectors
        for (let i = 0; i < n; i++) {
          const vip = V[i * n + p]!;
          const viq = V[i * n + q]!;
          V[i * n + p] = c * vip - s * viq;
          V[i * n + q] = s * vip + c * viq;
        }
      }
    }
  }

  // Extract eigenvalues from diagonal
  const eigenvalues = new Float64Array(n);
  for (let i = 0; i < n; i++) eigenvalues[i] = A[i * n + i]!;

  // Sort by ascending eigenvalue
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => eigenvalues[a]! - eigenvalues[b]!);

  const sortedValues = new Float64Array(n);
  const sortedVectors = new Float64Array(n * n);
  for (let k = 0; k < n; k++) {
    const srcIdx = indices[k]!;
    sortedValues[k] = eigenvalues[srcIdx]!;
    // Copy column srcIdx to column k
    for (let i = 0; i < n; i++) {
      sortedVectors[i * n + k] = V[i * n + srcIdx]!;
    }
  }

  return {
    values: sortedValues,
    vectors: { data: sortedVectors, rows: n, cols: n },
  };
}

/**
 * Apply a Jacobi rotation to symmetric matrix A at positions (p, q).
 * Computes A' = G^T A G where G is the Givens rotation.
 * This zeros out A[p][q] and A[q][p].
 */
function applyJacobiRotation(
  A: Float64Array,
  n: number,
  p: number,
  q: number,
  c: number,
  s: number,
): void {
  // For symmetric matrices, the rotation affects rows/cols p,q simultaneously.
  // We must read old values before writing new ones.

  // Update off-diagonal elements involving p or q (for all other rows r)
  for (let r = 0; r < n; r++) {
    if (r === p || r === q) continue;
    const arp = A[r * n + p]!;
    const arq = A[r * n + q]!;
    const newRp = c * arp - s * arq;
    const newRq = s * arp + c * arq;
    // Symmetric: set both (r,p)/(p,r) and (r,q)/(q,r)
    A[r * n + p] = newRp;
    A[p * n + r] = newRp;
    A[r * n + q] = newRq;
    A[q * n + r] = newRq;
  }

  // Update the 2×2 block at (p,q)
  const app = A[p * n + p]!;
  const aqq = A[q * n + q]!;
  const apq = A[p * n + q]!;
  A[p * n + p] = c * c * app - 2 * c * s * apq + s * s * aqq;
  A[q * n + q] = s * s * app + 2 * c * s * apq + c * c * aqq;
  A[p * n + q] = 0;
  A[q * n + p] = 0;
}
