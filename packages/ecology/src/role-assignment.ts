/**
 * Spectral ecological role assignment.
 *
 * Instead of comparing modules by identity, we classify each module
 * by the ROLE it plays in the ecosystem: core, satellite, bridge,
 * scaffold, or boundary.
 *
 * Roles are assigned from the spectral embedding (eigenvector
 * coordinates) combined with graph-theoretic properties:
 *
 * - core: high degree, central in spectral space, low Fiedler value
 * - satellite: low degree, far from spectral center
 * - bridge: high participation across spectral clusters (high Fiedler)
 * - scaffold: moderate degree, moderate spectral position
 * - boundary: at the boundary between spectral clusters
 *
 * Two motifs in different samples with zero k-mer overlap can be
 * "ecologically equivalent" if they occupy the same spectral position.
 */

import type {
  EigenDecomposition,
  InteractionGraph,
  EcologicalRole,
  ModuleRole,
  RoleSpectrum,
} from "./types.js";

/** Number of eigenvectors used for spectral embedding */
const SPECTRAL_DIM = 6;

/**
 * Assign ecological roles to all modules in a graph.
 */
export function assignRoles(
  graph: InteractionGraph,
  eigen: EigenDecomposition,
): ModuleRole[] {
  const n = graph.n;
  if (n === 0) return [];

  const dim = Math.min(SPECTRAL_DIM, n);
  const degrees = computeDegrees(graph);
  const maxDeg = Math.max(...degrees, 1e-12);

  // Extract spectral coordinates for each node (skip eigenvector 0 = constant)
  const spectralCoords: Float64Array[] = [];
  for (let i = 0; i < n; i++) {
    const coords = new Float64Array(dim);
    for (let k = 0; k < dim; k++) {
      // Skip k=0 (trivial eigenvalue), use k=1..dim
      const eigIdx = Math.min(k + 1, n - 1);
      coords[k] = eigen.vectors.data[i * n + eigIdx]!;
    }
    spectralCoords.push(coords);
  }

  // Compute spectral centroid
  const centroid = new Float64Array(dim);
  for (let i = 0; i < n; i++) {
    const coords = spectralCoords[i]!;
    for (let k = 0; k < dim; k++) {
      centroid[k]! += coords[k]! / n;
    }
  }

  // Compute distance from centroid and Fiedler value for each node
  const centroidDist = new Float64Array(n);
  const fiedlerValue = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const coords = spectralCoords[i]!;
    let dist2 = 0;
    for (let k = 0; k < dim; k++) {
      const d = coords[k]! - centroid[k]!;
      dist2 += d * d;
    }
    centroidDist[i] = Math.sqrt(dist2);
    // Fiedler value: absolute value of 2nd eigenvector component
    fiedlerValue[i] = n > 1 ? Math.abs(eigen.vectors.data[i * n + 1]!) : 0;
  }

  // Normalize metrics to [0, 1]
  const maxCentroidDist = Math.max(...centroidDist, 1e-12);
  const maxFiedler = Math.max(...fiedlerValue, 1e-12);

  const roles: ModuleRole[] = [];
  for (let i = 0; i < n; i++) {
    const normDeg = degrees[i]! / maxDeg;
    const normDist = centroidDist[i]! / maxCentroidDist;
    const normFiedler = fiedlerValue[i]! / maxFiedler;

    const role = classifyRole(normDeg, normDist, normFiedler);

    roles.push({
      moduleId: graph.nodeIds[i]!,
      nodeIndex: i,
      role: role.role,
      confidence: role.confidence,
      spectralPosition: spectralCoords[i]!,
    });
  }

  return roles;
}

/**
 * Compute the role spectrum — distribution of roles across the ecosystem.
 */
export function computeRoleSpectrum(roles: readonly ModuleRole[]): RoleSpectrum {
  const counts = { core: 0, satellite: 0, bridge: 0, scaffold: 0, boundary: 0 };
  for (const r of roles) counts[r.role]++;

  const total = roles.length || 1;
  const dist = new Float64Array(5);
  dist[0] = counts.core / total;
  dist[1] = counts.satellite / total;
  dist[2] = counts.bridge / total;
  dist[3] = counts.scaffold / total;
  dist[4] = counts.boundary / total;

  return { ...counts, distribution: dist };
}

/**
 * Classify a node's role from normalized metrics.
 *
 * Decision boundaries are based on the spectral interpretation:
 * - Core: high degree + close to centroid → well-connected hub
 * - Satellite: low degree + far from centroid → peripheral
 * - Bridge: high Fiedler → straddles spectral clusters
 * - Scaffold: moderate everything → structural support
 * - Boundary: moderate Fiedler + far from centroid → cluster edge
 */
function classifyRole(
  normDeg: number,
  normDist: number,
  normFiedler: number,
): { role: EcologicalRole; confidence: number } {
  // Score each role
  const scores: [EcologicalRole, number][] = [
    ["core", normDeg * (1 - normDist) * 2],
    ["satellite", (1 - normDeg) * normDist * 1.5],
    ["bridge", normFiedler * (1 - normDist) * 1.8],
    ["scaffold", (1 - Math.abs(normDeg - 0.5) * 2) * (1 - Math.abs(normDist - 0.5) * 2)],
    ["boundary", normFiedler * normDist * 1.5],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const best = scores[0]!;
  const second = scores[1]!;
  const total = scores.reduce((s, [, v]) => s + v, 0) || 1;

  return {
    role: best[0],
    confidence: Math.min(1, total > 0 ? (best[1] - second[1]) / total + 0.5 : 0.5),
  };
}

/** Compute weighted degree for each node */
function computeDegrees(graph: InteractionGraph): Float64Array {
  const n = graph.n;
  const deg = new Float64Array(n);
  const A = graph.adjacency.data;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let j = 0; j < n; j++) d += A[i * n + j]!;
    deg[i] = d;
  }
  return deg;
}
