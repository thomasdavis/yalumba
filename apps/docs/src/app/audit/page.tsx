import { Section } from "@/components/section";

const features = [
  { name: "moduleCount", selfCV: 0.1059, crossCV: 0.1536, ratio: 1.45, stable: true, category: "graph" },
  { name: "triangleCount", selfCV: 0.4386, crossCV: 0.4125, ratio: 0.94, stable: false, category: "graph" },
  { name: "edgeCount", selfCV: 0.2303, crossCV: 0.2353, ratio: 1.02, stable: false, category: "graph" },
  { name: "edgeDensity", selfCV: 0.0725, crossCV: 0.2124, ratio: 2.93, stable: true, category: "graph" },
  { name: "meanDegree", selfCV: 0.1249, crossCV: 0.1465, ratio: 1.17, stable: true, category: "graph" },
  { name: "maxDegree", selfCV: 0.2947, crossCV: 0.4739, ratio: 1.61, stable: false, category: "graph" },
  { name: "curvMean", selfCV: 0.1373, crossCV: 0.1244, ratio: 0.91, stable: true, category: "curvature" },
  { name: "curvStd", selfCV: 0.2452, crossCV: 0.2275, ratio: 0.93, stable: false, category: "curvature" },
  { name: "curvP50", selfCV: 0.0660, crossCV: 0.1633, ratio: 2.47, stable: true, category: "curvature" },
  { name: "curvP90", selfCV: 0.1949, crossCV: 0.2717, ratio: 1.39, stable: false, category: "curvature" },
  { name: "role_core", selfCV: 0.5458, crossCV: 0.5315, ratio: 0.97, stable: false, category: "role" },
  { name: "role_satellite", selfCV: 0.4689, crossCV: 0.7827, ratio: 1.67, stable: false, category: "role" },
  { name: "role_bridge", selfCV: 1.0875, crossCV: 2.2302, ratio: 2.05, stable: false, category: "role" },
  { name: "role_scaffold", selfCV: 0.8034, crossCV: 0.4767, ratio: 0.59, stable: false, category: "role" },
  { name: "role_boundary", selfCV: 0.7251, crossCV: 0.8576, ratio: 1.18, stable: false, category: "role" },
];

const shuffleData = [
  { sample: "NA12889", modules: [457, 938], triangles: [4822, 4940], edges: [1462, 2488] },
  { sample: "NA12890", modules: [607, 1023], triangles: [1875, 4650], edges: [1366, 2377] },
  { sample: "NA12891", modules: [712, 1252], triangles: [4867, 8964], edges: [2251, 3776] },
  { sample: "NA12892", modules: [593, 1232], triangles: [3714, 10317], edges: [1865, 3881] },
  { sample: "NA12877", modules: [492, 1395], triangles: [1256, 8875], edges: [1110, 4045] },
  { sample: "NA12878", modules: [671, 974], triangles: [3296, 5819], edges: [1998, 2536] },
];

export default function AuditPage() {
  const maxRatio = 3.5;

  return (
    <div className="space-y-16">
      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Representation Audit</h1>
        <p className="text-lg text-[var(--color-text-muted)] max-w-3xl">
          The most important experiment in the project. Tests whether the module-graph
          representation is stable enough to support downstream invariants.
        </p>
        <div className="rounded-lg border-2 border-[var(--color-dna-t)] bg-[var(--color-surface)] p-4">
          <p className="text-sm font-bold text-[var(--color-dna-t)]">CRITICAL FINDING</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            0 of 15 features achieve signal-to-nuisance ratio {">"} 3. Shuffling read order
            changes graph structure by 45-607%. The representation is not deterministic
            under trivial perturbation.
          </p>
        </div>
      </header>

      <Section title="Signal-to-Nuisance Ratio" id="snr">
        <p className="text-[var(--color-text-muted)] mb-4">
          Each bar shows the ratio of cross-sample variation to self-perturbation variation.
          Above 3.0 = signal dominates noise. Below 1.0 = noise dominates signal.
        </p>
        <div className="space-y-2">
          {features
            .sort((a, b) => b.ratio - a.ratio)
            .map((f) => {
              const barWidth = Math.min((f.ratio / maxRatio) * 100, 100);
              const color = f.ratio >= 3 ? "var(--color-dna-a)"
                : f.ratio >= 1 ? "var(--color-dna-g)"
                : "var(--color-dna-t)";
              return (
                <div key={f.name} className="flex items-center gap-3">
                  <span className="w-28 text-xs font-mono text-[var(--color-text-muted)] text-right shrink-0">
                    {f.name}
                  </span>
                  <div className="flex-1 h-6 bg-[var(--color-surface)] rounded relative overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                    {/* Threshold line at ratio = 3 */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-white opacity-40"
                      style={{ left: `${(3 / maxRatio) * 100}%` }}
                    />
                    {/* Threshold line at ratio = 1 */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-white opacity-20"
                      style={{ left: `${(1 / maxRatio) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-xs font-mono text-right" style={{ color }}>
                    {f.ratio.toFixed(2)}
                  </span>
                  <span className="w-20 text-xs text-[var(--color-text-muted)]">
                    {f.ratio >= 3 ? "SIGNAL" : f.ratio >= 1 ? "marginal" : "NOISE"}
                  </span>
                </div>
              );
            })}
        </div>
        <div className="flex gap-8 mt-4 text-xs text-[var(--color-text-muted)]">
          <span>│ = threshold at 1.0 (noise = signal)</span>
          <span>│ = threshold at 3.0 (acceptance gate)</span>
        </div>
      </Section>

      <Section title="Self-Perturbation Stability" id="stability">
        <p className="text-[var(--color-text-muted)] mb-4">
          How much does each feature change when we subsample the SAME individual
          at 100%, 80%, 60%, 40% coverage? Lower CV = more stable.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 pr-4 text-[var(--color-text-muted)]">Feature</th>
                <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Self CV</th>
                <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Cross CV</th>
                <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Ratio</th>
                <th className="text-left py-2 pl-3 text-[var(--color-text-muted)]">Category</th>
                <th className="text-center py-2 pl-3 text-[var(--color-text-muted)]">Stable?</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.name} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4">{f.name}</td>
                  <td className={`py-2 px-3 text-right ${f.selfCV > 0.3 ? "text-[var(--color-dna-t)]" : f.selfCV > 0.15 ? "text-[var(--color-dna-g)]" : ""}`}>
                    {f.selfCV.toFixed(4)}
                  </td>
                  <td className="py-2 px-3 text-right">{f.crossCV.toFixed(4)}</td>
                  <td className={`py-2 px-3 text-right font-bold ${f.ratio < 1 ? "text-[var(--color-dna-t)]" : f.ratio >= 3 ? "text-[var(--color-dna-a)]" : "text-[var(--color-dna-g)]"}`}>
                    {f.ratio.toFixed(2)}
                  </td>
                  <td className="py-2 pl-3 text-[var(--color-text-muted)]">{f.category}</td>
                  <td className="py-2 pl-3 text-center">
                    {f.stable ? <span className="text-[var(--color-dna-a)]">yes</span> : <span className="text-[var(--color-dna-t)]">no</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Shuffle Catastrophe" id="shuffle">
        <p className="text-[var(--color-text-muted)] mb-4">
          Randomizing read order changes zero biology. Yet module count changes 45-184%,
          triangle count changes up to 607%, and edge count changes 27-264%.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(["modules", "triangles", "edges"] as const).map((metric) => (
            <div key={metric} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h4 className="text-sm font-bold mb-3 capitalize">{metric}</h4>
              <div className="space-y-2">
                {shuffleData.map((s) => {
                  const orig = s[metric][0]!;
                  const shuf = s[metric][1]!;
                  const change = ((shuf - orig) / orig * 100);
                  const maxVal = Math.max(...shuffleData.map(d => Math.max(d[metric][0]!, d[metric][1]!)));
                  return (
                    <div key={s.sample} className="space-y-1">
                      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                        <span>{s.sample}</span>
                        <span className={change > 100 ? "text-[var(--color-dna-t)] font-bold" : "text-[var(--color-dna-g)]"}>
                          {change > 0 ? "+" : ""}{change.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex gap-1 h-3">
                        <div
                          className="bg-[var(--color-accent-2)] rounded-sm"
                          style={{ width: `${(orig / maxVal) * 100}%` }}
                          title={`Original: ${orig}`}
                        />
                        <div
                          className="bg-[var(--color-dna-t)] rounded-sm opacity-60"
                          style={{ width: `${(shuf / maxVal) * 100}%` }}
                          title={`Shuffled: ${shuf}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-[var(--color-accent-2)]" /> Original
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-[var(--color-dna-t)] opacity-60" /> Shuffled
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          NA12877 triangle count: 1,256 → 8,875 (+607%). Read ordering — which carries
          zero biological information — changes the graph more than kinship does.
        </p>
      </Section>

      <Section title="Implications" id="implications">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h4 className="font-medium text-sm mb-2">What this means for v1-v10</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              Every spectral ecology invariant was optimizing over a representation that varies
              more under trivial perturbation than between related and unrelated individuals.
              The ten-version arc was building increasingly sophisticated analysis on an
              unstable substrate.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h4 className="font-medium text-sm mb-2">What survives</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              <strong>edgeDensity</strong> (ratio 2.93) and <strong>curvP50</strong> (ratio 2.47) are the
              least-bad features. Both are scale-invariant measures — ratios and medians rather
              than raw counts. Module Persistence v3 and Coalition Transfer v3 likely passed
              because they accidentally leaned on stable features while avoiding unstable ones.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h4 className="font-medium text-sm mb-2">The path forward</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              Representation canonicalization — making the module graph a deterministic,
              perturbation-stable function of the sample — must come before any new invariant.
              The root cause: the module builder stops processing reads when a fixed-size hash
              table fills, making the output depend on read ordering.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
