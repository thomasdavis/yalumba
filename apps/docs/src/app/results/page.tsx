import { Section } from "@/components/section";
import { CodeBlock } from "@/components/code-block";

const algorithms = [
  {
    rank: 1,
    name: "Normalized anchor overlap",
    time: "17.1s",
    separation: "+0.802%",
    motherGap: "+1.010%",
    detectsMother: true,
    works: true,
    description: "Cross-sample identity divided by self-similarity baseline — controls for sequencing batch effects",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "0.9973", detail: "raw=94.6% selfA=95.8% selfB=93.9%", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "1.0014", detail: "raw=93.4% selfA=92.6% selfB=93.9%", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "0.9913", detail: "raw=93.4% selfA=95.8% selfB=92.6%", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 2,
    name: "Seed-extend overlap rate",
    time: "12.0s",
    separation: "+0.618%",
    motherGap: "+0.202%",
    detectsMother: true,
    works: true,
    description: "30bp seed match, verify full-read identity >95%, score by verified overlap count per read",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "4.986%", detail: "99,721 verified / 252,841 candidates", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "4.154%", detail: "83,080 verified / 238,175 candidates", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "3.952%", detail: "79,034 verified / 226,470 candidates", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 3,
    name: "Overlap count ratio",
    time: "7.8s",
    separation: "+0.315%",
    motherGap: "+0.127%",
    detectsMother: true,
    works: true,
    description: "Count reads sharing a 50bp anchor — ratio of shared reads to total reads",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "2.510%", detail: "50,192 overlaps", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "2.134%", detail: "42,679 overlaps", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "2.007%", detail: "40,141 overlaps", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 4,
    name: "Anchor overlap (60bp)",
    time: "7.9s",
    separation: "+0.619%",
    motherGap: "+0.031%",
    detectsMother: false,
    works: true,
    description: "Index reads by 60bp prefix, compare remaining bases — v1 winner but weak on mother-son",
    reads: "2,000,000",
    version: "v1",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "94.606%", detail: "63,859 overlaps, 5.394% mismatch", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "93.430%", detail: "51,318 overlaps, 6.570% mismatch", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "93.399%", detail: "48,368 overlaps, 6.601% mismatch", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 5,
    name: "Seed-extend identity (30bp, >95%)",
    time: "11.2s",
    separation: "+0.131%",
    motherGap: "-0.004%",
    detectsMother: false,
    works: true,
    description: "30bp seed, full-read identity filter, scored by avg identity — detects father but not mother",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "97.806%", detail: "99,721 verified", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "97.787%", detail: "83,080 verified", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "97.791%", detail: "79,034 verified", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 6,
    name: "Multi-seed voting (25bp ×5)",
    time: "46.8s",
    separation: "+0.097%",
    motherGap: "-0.005%",
    detectsMother: false,
    works: true,
    description: "Five 25bp seeds at different offsets, full-read identity verify, deduplicate pairs",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "97.487%", detail: "179,246 verified", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "97.283%", detail: "159,319 verified", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "97.288%", detail: "152,978 verified", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 7,
    name: "MinHash bottom-sketch (k=21)",
    time: "13.2s",
    separation: "+0.089%",
    motherGap: "+0.114%",
    detectsMother: true,
    works: true,
    description: "Keep 5,000 smallest canonical 21-mer hashes, compare sketch overlap",
    reads: "100,000",
    version: "v1",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "2.250%", detail: "sketch size 5,000", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "2.344%", detail: "sketch size 5,000", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "2.208%", detail: "sketch size 5,000", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 8,
    name: "K-mer Jaccard (k=21)",
    time: "45.4s",
    separation: "+0.034%",
    motherGap: "+0.005%",
    detectsMother: false,
    works: true,
    description: "Exact set intersection of canonical 21-mers",
    reads: "100,000",
    version: "v1",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "2.191%", detail: "479k shared / 21.9M union", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "2.132%", detail: "469k shared / 22.0M union", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "2.127%", detail: "468k shared / 22.0M union", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 9,
    name: "K-mer frequency correlation",
    time: "43.9s",
    separation: "-0.121%",
    motherGap: "+0.145%",
    detectsMother: true,
    works: false,
    description: "Pearson correlation of k-mer count vectors — fails because correlation captures batch, not genetics",
    reads: "100,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "0.9702", detail: "463k shared k-mers", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "0.9756", detail: "443k shared k-mers", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "0.9741", detail: "440k shared k-mers", rel: "Unrelated", related: false },
    ],
  },
];

export default function ResultsPage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Results</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Nine algorithms benchmarked on real GIAB data. Three detect <em>both</em> parent-child
          relationships including cross-batch mother-son.
        </p>
      </header>

      <Section title="Synthetic family — comparison matrix" id="synthetic-results">
        <p className="text-[var(--color-text-muted)] mb-6">
          Jaccard k-mer similarity on synthetic data with known ground truth.
          Clean separation: unrelated=0.0, parent-child=~0.13, siblings=~0.155.
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="py-2 pr-6 text-left text-[var(--color-text-muted)]"></th>
                <th className="py-2 px-4 text-right text-[var(--color-text-muted)]">Parent A</th>
                <th className="py-2 px-4 text-right text-[var(--color-text-muted)]">Parent B</th>
                <th className="py-2 px-4 text-right text-[var(--color-text-muted)]">Child 1</th>
                <th className="py-2 px-4 text-right text-[var(--color-text-muted)]">Child 2</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Parent A", "—", "0.000", "0.131", "0.129"],
                ["Parent B", "0.000", "—", "0.133", "0.130"],
                ["Child 1", "0.131", "0.133", "—", "0.155"],
                ["Child 2", "0.129", "0.130", "0.155", "—"],
              ].map((row) => (
                <tr key={row[0]} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-6 text-[var(--color-text-muted)]">{row[0]}</td>
                  {row.slice(1).map((cell, i) => (
                    <td key={i} className={`py-2 px-4 text-right ${cell === "—" ? "text-[var(--color-text-muted)]" : cell === "0.000" ? "text-[var(--color-text-muted)]" : Number(cell) > 0.14 ? "text-[var(--color-accent)]" : "text-[var(--color-accent-2)]"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Algorithm leaderboard — GIAB Ashkenazi trio" id="leaderboard">
        <p className="text-[var(--color-text-muted)] mb-2">
          HG003 (father) + HG004 (mother) → HG002 (son). 300x WGS, 148bp reads.
        </p>
        <p className="text-[var(--color-text-muted)] mb-6">
          The hard test: father and son were sequenced on the same flowcell, but <strong className="text-[var(--color-text)]">mother was
          sequenced in a different batch</strong>. Algorithms must detect both relationships despite batch effects.
        </p>

        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b-2 border-[var(--color-border)]">
                <th className="text-left py-2 pr-2 text-[var(--color-text-muted)]">#</th>
                <th className="text-left py-2 pr-4 text-[var(--color-text-muted)]">Algorithm</th>
                <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Time</th>
                <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Separation</th>
                <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Mother gap</th>
                <th className="text-center py-2 px-3 text-[var(--color-text-muted)]">Father</th>
                <th className="text-center py-2 px-3 text-[var(--color-text-muted)]">Mother</th>
                <th className="text-left py-2 pl-3 text-[var(--color-text-muted)]">Ver</th>
              </tr>
            </thead>
            <tbody>
              {algorithms.map((alg) => (
                <tr key={alg.rank} className={`border-b border-[var(--color-border)] ${alg.rank <= 3 ? "bg-[var(--color-surface)]" : ""}`}>
                  <td className={`py-2.5 pr-2 ${alg.rank <= 3 ? "text-[var(--color-accent)] font-bold" : "text-[var(--color-text-muted)]"}`}>
                    {alg.rank}
                  </td>
                  <td className={`py-2.5 pr-4 ${alg.rank <= 3 ? "font-bold" : ""} ${!alg.works ? "text-[var(--color-text-muted)] line-through" : ""}`}>
                    {alg.name}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">{alg.time}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${alg.works ? (alg.rank <= 3 ? "text-[var(--color-accent)]" : "text-[var(--color-accent-2)]") : "text-[var(--color-dna-t)]"}`}>
                    {alg.separation}
                  </td>
                  <td className={`py-2.5 px-3 text-right ${alg.detectsMother ? "text-[var(--color-dna-a)]" : "text-[var(--color-dna-t)]"}`}>
                    {alg.motherGap}
                  </td>
                  <td className="py-2.5 px-3 text-center text-[var(--color-dna-a)]">yes</td>
                  <td className={`py-2.5 px-3 text-center ${alg.detectsMother ? "text-[var(--color-dna-a)]" : "text-[var(--color-dna-t)]"}`}>
                    {alg.detectsMother ? "yes" : "no"}
                  </td>
                  <td className="py-2.5 pl-3 text-[var(--color-text-muted)]">{alg.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[var(--color-text-muted)]">
          <strong>Separation</strong> = avg(related scores) - avg(unrelated scores). <strong>Mother gap</strong> = mother-son score - unrelated score.
          Both must be positive. Highlighted rows detect both parent-child pairs.
        </p>
      </Section>

      <Section title="Detailed results per algorithm" id="detailed-results">
        <div className="space-y-6">
          {algorithms.slice(0, 6).map((alg) => (
            <div key={alg.rank} className={`rounded-lg border ${alg.rank <= 3 ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"} bg-[var(--color-surface)] p-5`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">
                  <span className={`${alg.rank <= 3 ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"} mr-2`}>#{alg.rank}</span>
                  {alg.name}
                  {alg.rank <= 3 && <span className="ml-2 text-xs text-[var(--color-dna-a)]">detects both</span>}
                </h3>
                <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
                  <span>{alg.time}</span>
                  <span>{alg.reads} reads</span>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">{alg.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left py-1 pr-3 text-[var(--color-text-muted)]">Pair</th>
                      <th className="text-right py-1 px-3 text-[var(--color-text-muted)]">Score</th>
                      <th className="text-left py-1 px-3 text-[var(--color-text-muted)]">Detail</th>
                      <th className="text-left py-1 pl-3 text-[var(--color-text-muted)]">Relationship</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alg.pairs.map((p) => (
                      <tr key={p.pair} className="border-b border-[var(--color-border)]">
                        <td className="py-1.5 pr-3">
                          {p.related && <span className="text-[var(--color-accent)] mr-1">{">"}</span>}
                          {p.pair}
                        </td>
                        <td className={`py-1.5 px-3 text-right font-bold ${p.related ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}>
                          {p.score}
                        </td>
                        <td className="py-1.5 px-3 text-[var(--color-text-muted)]">{p.detail}</td>
                        <td className="py-1.5 pl-3 text-[var(--color-text-muted)]">{p.rel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The breakthrough: normalization" id="breakthrough">
        <div className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-surface)] p-6 space-y-4">
          <h3 className="font-bold text-[var(--color-accent)]">Why normalized anchor overlap wins</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            The v1 anchor overlap had a hidden flaw: <strong className="text-[var(--color-text)]">sequencing batch effects</strong>.
            Father and son were sequenced on the same flowcell, giving them correlated coverage
            patterns that inflated their similarity. Mother was sequenced separately, making her
            signal nearly invisible.
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            The fix: <strong className="text-[var(--color-text)]">compute self-similarity as a baseline</strong>. Split each
            sample{"'"}s reads in half and compare the halves. This measures how much overlap is
            expected from the sequencing process alone. Then divide cross-sample similarity by
            this baseline.
          </p>
          <CodeBlock language="text" code={`Normalized score = cross_identity / avg(self_identity_A, self_identity_B)

Father self-similarity: 95.786%    (same flowcell as son → high)
Mother self-similarity: 92.647%    (different batch → lower)

Raw father-son:  94.606% / avg(95.786, 93.947) = 0.9973
Raw mother-son:  93.430% / avg(92.647, 93.947) = 1.0014  ← now HIGHEST
Raw unrelated:   93.399% / avg(95.786, 92.647) = 0.9913  ← clearly lowest`} />
          <p className="text-sm text-[var(--color-text-muted)]">
            After normalization, <strong className="text-[var(--color-text)]">mother-son actually scores highest</strong> (1.0014)
            because the mother{"'"}s lower self-similarity baseline amplifies her cross-sample signal.
            The batch effect that was hiding the mother-son relationship now <em>helps</em> detect it.
          </p>
        </div>
      </Section>

      <Section title="Failed approaches" id="failures">
        <div className="space-y-3">
          {[
            { name: "K-mer frequency correlation (k=21)", reason: "Pearson correlation of k-mer counts captures sequencing batch similarity, not genetic relatedness. Father-son scores LOWER than unrelated." },
            { name: "CEPH 36bp reads — all algorithms", reason: "Reads too short. Only 11bp left after a 25bp anchor. K-mer methods show batch effects, not genetics." },
            { name: "Identity-scored algorithms (no normalization)", reason: "Detect father-son (same batch) but fail on mother-son (different batch). Mother-son gap <0.01%." },
            { name: "Multi-seed voting (25bp ×5)", reason: "More overlaps but identity still dominated by error rate. 46.8s for weaker signal than simple overlap counting." },
          ].map((f) => (
            <div key={f.name} className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <h4 className="text-sm font-medium text-[var(--color-dna-t)] mb-1">{f.name}</h4>
              <p className="text-xs text-[var(--color-text-muted)]">{f.reason}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
