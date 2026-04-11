/**
 * Integration test for the ecology pipeline.
 * Exercises: graph building → Laplacian → eigendecomposition →
 * heat kernel → role assignment → ecosystem signature → comparison.
 */

import { describe, it, expect } from "bun:test";
import { normalizedLaplacian, eigenDecomposition } from "./laplacian.js";
import { computeHeatKernel } from "./heat-kernel.js";
import { assignRoles, computeRoleSpectrum } from "./role-assignment.js";
import { buildEcosystemSignature } from "./ecosystem-signature.js";
import { compareEcosystems, distanceToSimilarity } from "./compare.js";
import type { InteractionGraph } from "./types.js";

/** Build a small test graph (triangle + pendant) */
function makeTestGraph(): InteractionGraph {
  // 4-node graph:
  //   0 -- 1
  //   |  / |
  //   2    3
  const n = 4;
  const data = new Float64Array(n * n);
  // 0-1
  data[0 * n + 1] = 1; data[1 * n + 0] = 1;
  // 0-2
  data[0 * n + 2] = 1; data[2 * n + 0] = 1;
  // 1-2
  data[1 * n + 2] = 1; data[2 * n + 1] = 1;
  // 1-3
  data[1 * n + 3] = 0.5; data[3 * n + 1] = 0.5;

  return {
    n,
    nodeIds: [10, 20, 30, 40],
    supports: new Float64Array([5, 8, 3, 2]),
    adjacency: { data, rows: n, cols: n },
    readCount: 100,
  };
}

/** Build a slightly different graph (same topology, different weights) */
function makeSimilarGraph(): InteractionGraph {
  const n = 4;
  const data = new Float64Array(n * n);
  data[0 * n + 1] = 1.1; data[1 * n + 0] = 1.1;
  data[0 * n + 2] = 0.9; data[2 * n + 0] = 0.9;
  data[1 * n + 2] = 1.0; data[2 * n + 1] = 1.0;
  data[1 * n + 3] = 0.6; data[3 * n + 1] = 0.6;

  return {
    n,
    nodeIds: [100, 200, 300, 400],
    supports: new Float64Array([6, 7, 4, 3]),
    adjacency: { data, rows: n, cols: n },
    readCount: 120,
  };
}

/** Build a very different graph (star topology) */
function makeDifferentGraph(): InteractionGraph {
  const n = 4;
  const data = new Float64Array(n * n);
  // Star: node 0 connected to all others
  data[0 * n + 1] = 2; data[1 * n + 0] = 2;
  data[0 * n + 2] = 2; data[2 * n + 0] = 2;
  data[0 * n + 3] = 2; data[3 * n + 0] = 2;
  // No other edges

  return {
    n,
    nodeIds: [1, 2, 3, 4],
    supports: new Float64Array([10, 2, 2, 2]),
    adjacency: { data, rows: n, cols: n },
    readCount: 80,
  };
}

describe("Laplacian", () => {
  it("produces symmetric matrix with eigenvalues in [0, 2]", () => {
    const graph = makeTestGraph();
    const L = normalizedLaplacian(graph.adjacency);
    const eigen = eigenDecomposition(L);

    // First eigenvalue should be ~0
    expect(eigen.values[0]!).toBeCloseTo(0, 5);

    // All eigenvalues in [0, 2]
    for (let i = 0; i < eigen.values.length; i++) {
      expect(eigen.values[i]!).toBeGreaterThanOrEqual(-1e-6);
      expect(eigen.values[i]!).toBeLessThanOrEqual(2 + 1e-6);
    }
  });

  it("eigenvalues are sorted ascending", () => {
    const graph = makeTestGraph();
    const L = normalizedLaplacian(graph.adjacency);
    const eigen = eigenDecomposition(L);

    for (let i = 1; i < eigen.values.length; i++) {
      expect(eigen.values[i]!).toBeGreaterThanOrEqual(eigen.values[i - 1]! - 1e-10);
    }
  });
});

describe("Heat kernel", () => {
  it("trace is positive and decreasing with timescale", () => {
    const graph = makeTestGraph();
    const L = normalizedLaplacian(graph.adjacency);
    const eigen = eigenDecomposition(L);
    const heat = computeHeatKernel(eigen);

    for (let i = 0; i < heat.traces.length; i++) {
      expect(heat.traces[i]!).toBeGreaterThan(0);
    }
    // Trace should decrease as t increases (more diffusion)
    for (let i = 1; i < heat.traces.length; i++) {
      expect(heat.traces[i]!).toBeLessThanOrEqual(heat.traces[i - 1]! + 1e-10);
    }
  });

  it("produces per-node signatures", () => {
    const graph = makeTestGraph();
    const L = normalizedLaplacian(graph.adjacency);
    const eigen = eigenDecomposition(L);
    const heat = computeHeatKernel(eigen);

    expect(heat.nodeSignatures.length).toBe(4);
    for (const sig of heat.nodeSignatures) {
      expect(sig.length).toBe(heat.timescales.length);
    }
  });
});

describe("Role assignment", () => {
  it("assigns roles to all nodes", () => {
    const graph = makeTestGraph();
    const L = normalizedLaplacian(graph.adjacency);
    const eigen = eigenDecomposition(L);
    const roles = assignRoles(graph, eigen);

    expect(roles.length).toBe(4);
    for (const role of roles) {
      expect(["core", "satellite", "bridge", "scaffold", "boundary"]).toContain(role.role);
      expect(role.confidence).toBeGreaterThan(0);
      expect(role.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("role spectrum sums to 1", () => {
    const graph = makeTestGraph();
    const L = normalizedLaplacian(graph.adjacency);
    const eigen = eigenDecomposition(L);
    const roles = assignRoles(graph, eigen);
    const spectrum = computeRoleSpectrum(roles);

    let sum = 0;
    for (let i = 0; i < spectrum.distribution.length; i++) {
      sum += spectrum.distribution[i]!;
    }
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("Ecosystem signature", () => {
  it("builds complete signature", () => {
    const graph = makeTestGraph();
    const sig = buildEcosystemSignature("test-sample", graph);

    expect(sig.sampleId).toBe("test-sample");
    expect(sig.moduleCount).toBe(4);
    expect(sig.spectrum.length).toBe(4);
    expect(sig.spectralGap).toBeGreaterThan(0);
    expect(sig.roles.length).toBe(4);
  });
});

describe("Ecosystem comparison", () => {
  it("identical graphs have zero distance", () => {
    const graph = makeTestGraph();
    const sigA = buildEcosystemSignature("a", graph);
    const sigB = buildEcosystemSignature("b", graph);
    const cmp = compareEcosystems(sigA, sigB);

    expect(cmp.distance).toBeCloseTo(0, 3);
    expect(cmp.heatTraceDistance).toBeCloseTo(0, 5);
    expect(cmp.spectralDistance).toBeCloseTo(0, 5);
  });

  it("similar graphs have smaller distance than different graphs", () => {
    const base = makeTestGraph();
    const similar = makeSimilarGraph();
    const different = makeDifferentGraph();

    const sigBase = buildEcosystemSignature("base", base);
    const sigSimilar = buildEcosystemSignature("similar", similar);
    const sigDifferent = buildEcosystemSignature("different", different);

    const dSimilar = compareEcosystems(sigBase, sigSimilar);
    const dDifferent = compareEcosystems(sigBase, sigDifferent);

    expect(dSimilar.distance).toBeLessThan(dDifferent.distance);
  });

  it("distanceToSimilarity maps correctly", () => {
    expect(distanceToSimilarity(0)).toBeCloseTo(1, 5);
    expect(distanceToSimilarity(10)).toBeLessThan(0.01);
  });
});
