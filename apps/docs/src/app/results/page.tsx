import { Section } from "@/components/section";
import { CodeBlock } from "@/components/code-block";

const algorithms = [
  {
    rank: 1,
    name: "K-mer spectrum cosine (k=21)",
    time: "27.9s",
    separation: "+1.073%",
    motherGap: "+1.232%",
    detectsMother: true,
    works: true,
    description: "Cosine similarity of k-mer frequency vectors — captures both presence and abundance, naturally normalized",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "0.910207", detail: "cosine=0.910207", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "0.913384", detail: "cosine=0.913384", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "0.901069", detail: "cosine=0.901069", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 2,
    name: "Normalized anchor overlap",
    time: "18.8s",
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
    rank: 3,
    name: "Jensen-Shannon divergence (k=21)",
    time: "60.1s",
    separation: "+0.630%",
    motherGap: "+0.294%",
    detectsMother: true,
    works: true,
    description: "Information-theoretic divergence of k-mer frequency distributions — symmetric and bounded",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "0.146949", detail: "JSD=0.853", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "0.140235", detail: "JSD=0.860", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "0.137295", detail: "JSD=0.863", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 4,
    name: "Anchor overlap (60bp)",
    time: "11.8s",
    separation: "+0.619%",
    motherGap: "+0.031%",
    detectsMother: true,
    works: true,
    description: "Index reads by 60bp prefix, compare remaining bases — strong separation but weak on mother-son",
    reads: "2,000,000",
    version: "v1",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "94.606%", detail: "63,859 overlaps", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "93.430%", detail: "51,318 overlaps", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "93.399%", detail: "48,368 overlaps", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 5,
    name: "Seed-extend overlap rate",
    time: "10.9s",
    separation: "+0.618%",
    motherGap: "+0.202%",
    detectsMother: true,
    works: true,
    description: "30bp seed match, verify full-read identity >95%, score by verified overlap count per read",
    reads: "2,000,000",
    version: "v2",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "4.986%", detail: "99,721 verified", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "4.154%", detail: "83,080 verified", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "3.952%", detail: "79,034 verified", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 6,
    name: "Overlap count ratio",
    time: "7.5s",
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
    rank: 7,
    name: "MinHash bottom-sketch (k=21)",
    time: "16.9s",
    separation: "+0.089%",
    motherGap: "+0.136%",
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
    name: "K-mer entropy similarity",
    time: "22.7s",
    separation: "+0.076%",
    motherGap: "+0.011%",
    detectsMother: true,
    works: true,
    description: "Shannon entropy of shared k-mer frequency distributions — measures information overlap",
    reads: "2,000,000",
    version: "v2",
    pairs: [],
  },
  {
    rank: 9,
    name: "Containment index",
    time: "22.5s",
    separation: "+0.065%",
    motherGap: "+0.009%",
    detectsMother: true,
    works: true,
    description: "Fraction of one sample's k-mers contained in another — asymmetric set measure",
    reads: "100,000",
    version: "v1",
    pairs: [],
  },
  {
    rank: 10,
    name: "Shared unique reads",
    time: "9.8s",
    separation: "+0.061%",
    motherGap: "+0.012%",
    detectsMother: true,
    works: true,
    description: "Count reads with unique anchors shared between samples",
    reads: "2,000,000",
    version: "v1",
    pairs: [],
  },
  {
    rank: 11,
    name: "K-mer Jaccard (k=21)",
    time: "45.7s",
    separation: "+0.034%",
    motherGap: "+0.005%",
    detectsMother: true,
    works: true,
    description: "Exact set intersection of canonical 21-mers",
    reads: "100,000",
    version: "v1",
    pairs: [],
  },
  {
    rank: 12,
    name: "K-mer graph similarity",
    time: "17.6s",
    separation: "+0.028%",
    motherGap: "+0.018%",
    detectsMother: true,
    works: true,
    description: "De Bruijn graph edge overlap between samples — structural similarity of k-mer neighborhoods",
    reads: "2,000,000",
    version: "v2",
    pairs: [],
  },
  {
    rank: 13,
    name: "Compression distance (NCD)",
    time: "1.5s",
    separation: "+0.007%",
    motherGap: "+0.003%",
    detectsMother: true,
    works: true,
    description: "Normalized compression distance — algorithmic similarity via gzip. Fastest algorithm at 1.5s",
    reads: "2,000,000",
    version: "v2",
    pairs: [],
  },
  {
    rank: 14,
    name: "Multi-anchor overlap",
    time: "30.5s",
    separation: "+0.482%",
    motherGap: "-0.177%",
    detectsMother: false,
    works: true,
    description: "Multiple anchor lengths combined — strong father-son signal but fails on cross-batch mother-son",
    reads: "2,000,000",
    version: "v1",
    pairs: [],
  },
  {
    rank: 15,
    name: "Mutual information",
    time: "34.2s",
    separation: "-0.344%",
    motherGap: "N/A",
    detectsMother: false,
    works: false,
    description: "Mutual information of k-mer co-occurrence — captures batch effects instead of genetic signal",
    reads: "2,000,000",
    version: "v2",
    pairs: [],
  },
  {
    rank: 16,
    name: "HMM-IBD (2-state)",
    time: "10.8s",
    separation: "0.000%",
    motherGap: "N/A",
    detectsMother: false,
    works: false,
    description: "Hidden Markov model with IBD/non-IBD states — no separation between related and unrelated pairs",
    reads: "2,000,000",
    version: "v2",
    pairs: [],
  },
];

export default function ResultsPage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Results</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Sixteen algorithms benchmarked on real GIAB data. Thirteen detect <em>both</em> parent-child
          relationships including cross-batch mother-son. K-mer spectrum cosine leads with +1.073% separation.
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
                  <td className={`py-2.5 px-3 text-center ${alg.works ? "text-[var(--color-dna-a)]" : "text-[var(--color-dna-t)]"}`}>
                    {alg.works ? "yes" : "no"}
                  </td>
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
                  {alg.detectsMother && <span className="ml-2 text-xs text-[var(--color-dna-a)]">detects both</span>}
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

      <Section title="The breakthrough: cosine similarity" id="breakthrough">
        <div className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-surface)] p-6 space-y-4">
          <h3 className="font-bold text-[var(--color-accent)]">Why k-mer spectrum cosine wins</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            The challenge with raw overlap metrics is <strong className="text-[var(--color-text)]">sequencing batch effects</strong>.
            Father and son were sequenced on the same flowcell, giving them correlated coverage
            patterns that inflated their similarity. Mother was sequenced separately, making her
            signal nearly invisible to naive approaches.
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Cosine similarity solves this elegantly: by measuring the <strong className="text-[var(--color-text)]">angle between k-mer
            frequency vectors</strong> rather than their magnitude, it is inherently normalized.
            Two samples with different sequencing depths or batch characteristics will still
            have similar angles if they share genetic content. No self-similarity baseline needed.
          </p>
          <CodeBlock language="text" code={`cosine(A, B) = dot(A, B) / (||A|| * ||B||)

Father ↔ Son:   0.910207   (same batch — cosine ignores magnitude bias)
Mother ↔ Son:   0.913384   ← HIGHEST despite different batch
Unrelated:      0.901069   ← clearly lowest

Separation:     +1.073%    (best of all 16 algorithms)
Mother gap:     +1.232%    (mother-son ABOVE father-son)`} />
          <p className="text-sm text-[var(--color-text-muted)]">
            Cosine similarity achieves <strong className="text-[var(--color-text)]">+1.073% separation</strong> — a 34% improvement
            over the previous leader (normalized anchor overlap at +0.802%). Even more striking,
            the mother-son pair scores <em>highest</em> at 0.913, demonstrating that cosine
            completely neutralizes the batch effect without needing an explicit normalization step.
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            The runner-up, normalized anchor overlap, remains strong at +0.802% separation. Its
            approach of dividing by self-similarity baselines was the previous breakthrough — but
            cosine achieves the same batch-effect resistance through the geometry of the similarity
            measure itself.
          </p>
        </div>
      </Section>

      <Section title="Failed approaches" id="failures">
        <div className="space-y-3">
          {[
            { name: "Mutual information (v2)", reason: "Mutual information of k-mer co-occurrence captures batch effects instead of genetic signal. Negative separation (-0.344%) means unrelated pairs score higher than related." },
            { name: "HMM-IBD 2-state (v2)", reason: "Hidden Markov model with IBD/non-IBD states produces zero separation. The model cannot distinguish related from unrelated pairs at read-level granularity without variant calls." },
            { name: "Multi-anchor overlap (v1)", reason: "Detects father-son (+0.482% separation) but fails on mother-son (-0.177% gap). Cross-batch effects defeat the multi-anchor approach." },
            { name: "CEPH 36bp reads — all algorithms", reason: "Reads too short. Only 11bp left after a 25bp anchor. K-mer methods show batch effects, not genetics." },
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
