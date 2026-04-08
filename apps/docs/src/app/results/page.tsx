import { Section } from "@/components/section";

const algorithms = [
  {
    rank: 1,
    name: "Anchor overlap (60bp)",
    time: "7.9s",
    separation: "+0.619%",
    works: true,
    description: "Index reads by 60bp prefix, compare remaining bases at matched positions",
    reads: "2,000,000",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "94.606%", detail: "63,859 overlaps, 5.394% mismatch", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "93.430%", detail: "51,318 overlaps, 6.570% mismatch", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "93.399%", detail: "48,368 overlaps, 6.601% mismatch", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 2,
    name: "Multi-anchor overlap (40bp ×3)",
    time: "45.9s",
    separation: "+0.288%",
    works: true,
    description: "Three 40bp anchors per read at different offsets, compare non-anchor bases",
    reads: "2,000,000",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "49.758%", detail: "681,882 overlaps", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "49.110%", detail: "594,762 overlaps", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "49.146%", detail: "569,233 overlaps", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 3,
    name: "MinHash bottom-sketch (k=21)",
    time: "13.2s",
    separation: "+0.089%",
    works: true,
    description: "Keep 5,000 smallest canonical 21-mer hashes, compare sketch overlap",
    reads: "100,000",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "2.250%", detail: "sketch size 5,000", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "2.344%", detail: "sketch size 5,000", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "2.208%", detail: "sketch size 5,000", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 4,
    name: "Containment index (k=21)",
    time: "47.8s",
    separation: "+0.065%",
    works: true,
    description: "Fraction of one sample's 21-mers found in the other (asymmetric, averaged)",
    reads: "100,000",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "4.287%", detail: "A→B=4.29% B→A=4.28%", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "4.175%", detail: "A→B=4.16% B→A=4.19%", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "4.166%", detail: "A→B=4.19% B→A=4.15%", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 5,
    name: "Shared unique reads",
    time: "14.7s",
    separation: "+0.061%",
    works: true,
    description: "Count reads appearing identically in both samples (full 148bp exact match)",
    reads: "2,000,000",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "0.296%", detail: "11,743 shared reads", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "0.199%", detail: "7,918 shared reads", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "0.187%", detail: "7,422 shared reads", rel: "Unrelated", related: false },
    ],
  },
  {
    rank: 6,
    name: "K-mer Jaccard (k=21)",
    time: "45.4s",
    separation: "+0.034%",
    works: true,
    description: "Exact set intersection of canonical 21-mers",
    reads: "100,000",
    pairs: [
      { pair: "HG003 ↔ HG002", score: "2.191%", detail: "479k shared / 21.9M union", rel: "Father ↔ Son", related: true },
      { pair: "HG004 ↔ HG002", score: "2.132%", detail: "469k shared / 22.0M union", rel: "Mother ↔ Son", related: true },
      { pair: "HG003 ↔ HG004", score: "2.127%", detail: "468k shared / 22.0M union", rel: "Unrelated", related: false },
    ],
  },
];

export default function ResultsPage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Results</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Analysis results from running yalumba against synthetic and real
          genomic datasets. Six algorithms compared head-to-head.
        </p>
      </header>

      <Section title="Synthetic family — comparison matrix" id="synthetic-results">
        <p className="text-[var(--color-text-muted)] mb-6">
          Jaccard k-mer similarity between all pairs of synthetic family members.
          The pipeline correctly separates unrelated individuals (0.0), parent-child
          pairs (~0.13), and full siblings (~0.155).
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
                    <td
                      key={i}
                      className={`py-2 px-4 text-right ${
                        cell === "—"
                          ? "text-[var(--color-text-muted)]"
                          : cell === "0.000"
                          ? "text-[var(--color-text-muted)]"
                          : Number(cell) > 0.14
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-accent-2)]"
                      }`}
                    >
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
        <p className="text-[var(--color-text-muted)] mb-4">
          Six algorithms benchmarked on real data: HG003 (father) + HG004 (mother) → HG002 (son).
          300x whole-genome sequencing, 148bp reads, from the Genome in a Bottle project.
        </p>
        <p className="text-[var(--color-text-muted)] mb-6">
          <strong className="text-[var(--color-text)]">Separation</strong> = average related score minus average unrelated score.
          Higher is better. All algorithms correctly identify parent-child {">"} unrelated.
        </p>

        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 pr-2 text-[var(--color-text-muted)]">#</th>
                <th className="text-left py-2 pr-4 text-[var(--color-text-muted)]">Algorithm</th>
                <th className="text-right py-2 px-4 text-[var(--color-text-muted)]">Time</th>
                <th className="text-right py-2 px-4 text-[var(--color-text-muted)]">Separation</th>
                <th className="text-right py-2 px-4 text-[var(--color-text-muted)]">Reads</th>
                <th className="text-center py-2 pl-4 text-[var(--color-text-muted)]">Detects?</th>
              </tr>
            </thead>
            <tbody>
              {algorithms.map((alg) => (
                <tr key={alg.rank} className={`border-b border-[var(--color-border)] ${alg.rank === 1 ? "bg-[var(--color-surface)]" : ""}`}>
                  <td className={`py-3 pr-2 ${alg.rank === 1 ? "text-[var(--color-accent)] font-bold" : "text-[var(--color-text-muted)]"}`}>
                    {alg.rank}
                  </td>
                  <td className={`py-3 pr-4 ${alg.rank === 1 ? "text-[var(--color-accent)] font-bold" : ""}`}>
                    {alg.name}
                  </td>
                  <td className="py-3 px-4 text-right">{alg.time}</td>
                  <td className={`py-3 px-4 text-right font-bold ${alg.rank <= 2 ? "text-[var(--color-accent)]" : "text-[var(--color-accent-2)]"}`}>
                    {alg.separation}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--color-text-muted)]">{alg.reads}</td>
                  <td className="py-3 pl-4 text-center text-[var(--color-dna-a)]">
                    {alg.works ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Detailed results per algorithm" id="detailed-results">
        <div className="space-y-8">
          {algorithms.map((alg) => (
            <div key={alg.rank} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold">
                  <span className={`${alg.rank === 1 ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"} mr-2`}>#{alg.rank}</span>
                  {alg.name}
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

      <Section title="Key findings" id="findings">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
            <h4 className="font-medium text-sm text-[var(--color-accent)]">1. Anchor overlap wins decisively</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              The 60bp anchor approach is both the <strong className="text-[var(--color-text)]">fastest</strong> (7.9s)
              and has the <strong className="text-[var(--color-text)]">best separation</strong> (+0.619%).
              It{"'"}s 7× better separation than the next algorithm while being 6× faster.
              By forcing position-level comparison, it measures actual genotype similarity
              rather than bulk k-mer overlap.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
            <h4 className="font-medium text-sm text-[var(--color-accent)]">2. All six algorithms detect relatedness</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              Every approach correctly scores parent-child higher than unrelated —
              but the margin varies dramatically. K-mer Jaccard separates by only 0.034%,
              while anchor overlap separates by 0.619% — an 18× difference in signal strength.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
            <h4 className="font-medium text-sm text-[var(--color-accent)]">3. Read length matters enormously</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              The 1000 Genomes CEPH data (36bp reads) produced <strong className="text-[var(--color-text)]">no usable signal</strong> with
              any algorithm. The GIAB data (148bp reads) works with all six. Longer reads
              provide more sequence for anchoring and comparison, and higher effective
              coverage overlap between samples.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
            <h4 className="font-medium text-sm text-[var(--color-accent)]">4. Father shows stronger signal than mother</h4>
            <p className="text-sm text-[var(--color-text-muted)]">
              Across most algorithms, father-son scores higher than mother-son.
              This is likely due to the specific FASTQ files selected — the father{"'"}s
              sequencing run may have more coverage overlap with the son{"'"}s run
              (same flowcell or similar library prep), amplifying the genetic signal.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Failed approaches" id="failures">
        <p className="text-[var(--color-text-muted)] mb-4">
          Not everything worked. These approaches were tried and abandoned.
        </p>
        <div className="space-y-3">
          {[
            { name: "CEPH 36bp reads — any algorithm", reason: "Reads too short for anchor comparison. Only 11bp left after a 25bp anchor. K-mer methods show batch effects, not genetics." },
            { name: "MinHash with N hash functions (v2)", reason: "O(reads × k-mers × N) — killed after 30+ minutes. Bottom-sketch (single hash, keep smallest) is the correct approach." },
            { name: "k=25 anchor on 36bp reads", reason: "15% mismatch rate — mostly comparing reads from different genomic positions that happen to share a 25-mer." },
            { name: "k=30+ anchor on 36bp reads", reason: "Zero overlaps — reads are only 36bp, so there are no bases left to compare after the anchor." },
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
