/**
 * Ecosystem signature construction — v2.
 *
 * Combines spectral decomposition, heat kernel traces, ecological
 * roles, eigenvalue density, eigenvector localization, null model
 * deconfounding, module embeddings, and diffusion distributions
 * into a single per-sample EcosystemSignature.
 */

import type { InteractionGraph, EcosystemSignature } from "./types.js";
import { normalizedLaplacian, eigenDecomposition } from "./laplacian.js";
import { computeHeatKernel } from "./heat-kernel.js";
import { assignRoles, computeRoleSpectrum } from "./role-assignment.js";
import { eigenvalueDensity, eigenvectorLocalization, diffusionDistribution } from "./spectral-invariants.js";
import { spectralResidual, deconfoundedSpectralEntropy } from "./null-model.js";
import { computeModuleEmbeddings } from "./module-embedding.js";

/** Timescales for diffusion distribution */
const DIFFUSION_TIMESCALES = [0.5, 2.0, 10.0];

/**
 * Build the full ecosystem signature for a sample.
 */
export function buildEcosystemSignature(
  sampleId: string,
  graph: InteractionGraph,
  modules?: readonly import("@yalumba/modules").Module[],
): EcosystemSignature {
  if (graph.n === 0) return emptySignature(sampleId);

  // ── Core spectral decomposition ──
  const laplacian = normalizedLaplacian(graph.adjacency);
  const eigen = eigenDecomposition(laplacian);

  // ── Heat kernel ──
  const heatTrace = computeHeatKernel(eigen);

  // ── Role assignment ──
  const roles = assignRoles(graph, eigen);
  const roleSpectrum = computeRoleSpectrum(roles);

  // ── Basic spectral statistics ──
  const spectralGap = computeSpectralGap(eigen.values);
  const spectralEntropy = computeSpectralEntropy(eigen.values);
  const graphEnergy = computeGraphEnergy(eigen.values);

  // ── v2: Eigenvalue density (KDE) ──
  const density = eigenvalueDensity(eigen.values);

  // ── v2: Eigenvector localization ──
  const localization = eigenvectorLocalization(eigen);

  // ── v2: Null model deconfounding ──
  const residual = spectralResidual(eigen.values, graph);
  const deconfoundedEnt = deconfoundedSpectralEntropy(residual);

  // ── v2: Module embeddings ──
  const embeddingModules = modules ?? rebuildModulesFromGraph(graph);
  const embeddings = computeModuleEmbeddings(embeddingModules, graph);

  // ── v2: Diffusion distance distributions ──
  const diffMeans = new Float64Array(DIFFUSION_TIMESCALES.length);
  const diffVars = new Float64Array(DIFFUSION_TIMESCALES.length);
  for (let i = 0; i < DIFFUSION_TIMESCALES.length; i++) {
    const dd = diffusionDistribution(eigen, DIFFUSION_TIMESCALES[i]!);
    diffMeans[i] = dd.mean;
    diffVars[i] = dd.variance;
  }

  // ── Count edges ──
  let edgeCount = 0;
  const A = graph.adjacency.data;
  const n = graph.n;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (A[i * n + j]! > 1e-12) edgeCount++;
    }
  }

  return {
    sampleId,
    moduleCount: graph.n,
    edgeCount,
    spectrum: eigen.values,
    heatTrace,
    roles,
    roleSpectrum,
    spectralGap,
    spectralEntropy,
    graphEnergy,
    eigenvalueDensity: density.density,
    meanLocalization: localization.meanIpr,
    localizationSpread: localization.stdIpr,
    spectralResidual: residual,
    deconfoundedEntropy: deconfoundedEnt,
    embeddings,
    diffusionMeans: diffMeans,
    diffusionVariances: diffVars,
  };
}

/**
 * When modules aren't passed directly, reconstruct minimal Module
 * objects from the graph metadata (for embedding computation).
 */
function rebuildModulesFromGraph(graph: InteractionGraph): import("@yalumba/modules").Module[] {
  const result: import("@yalumba/modules").Module[] = [];
  for (let i = 0; i < graph.n; i++) {
    result.push({
      id: graph.nodeIds[i]!,
      members: [], // embeddings will use graph degree + support only
      support: graph.supports[i]!,
      cohesion: 0,
      spanBp: 0,
    });
  }
  return result;
}

function computeSpectralGap(eigenvalues: Float64Array): number {
  if (eigenvalues.length < 2) return 0;
  return eigenvalues[1]! - eigenvalues[0]!;
}

function computeSpectralEntropy(eigenvalues: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < eigenvalues.length; i++) {
    sum += Math.max(eigenvalues[i]!, 0);
  }
  if (sum < 1e-12) return 0;
  let entropy = 0;
  for (let i = 0; i < eigenvalues.length; i++) {
    const p = Math.max(eigenvalues[i]!, 0) / sum;
    if (p > 1e-15) entropy -= p * Math.log(p);
  }
  return entropy;
}

function computeGraphEnergy(eigenvalues: Float64Array): number {
  const n = eigenvalues.length;
  if (n === 0) return 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += eigenvalues[i]!;
  mean /= n;
  let energy = 0;
  for (let i = 0; i < n; i++) {
    energy += Math.abs(eigenvalues[i]! - mean);
  }
  return energy;
}

function emptySignature(sampleId: string): EcosystemSignature {
  return {
    sampleId,
    moduleCount: 0,
    edgeCount: 0,
    spectrum: new Float64Array(0),
    heatTrace: { timescales: [], traces: new Float64Array(0), nodeSignatures: [] },
    roles: [],
    roleSpectrum: {
      core: 0, satellite: 0, bridge: 0, scaffold: 0, boundary: 0,
      distribution: new Float64Array(5),
    },
    spectralGap: 0,
    spectralEntropy: 0,
    graphEnergy: 0,
    eigenvalueDensity: new Float64Array(32),
    meanLocalization: 0,
    localizationSpread: 0,
    spectralResidual: new Float64Array(0),
    deconfoundedEntropy: 0,
    embeddings: new Float64Array(0),
    diffusionMeans: new Float64Array(3),
    diffusionVariances: new Float64Array(3),
  };
}
