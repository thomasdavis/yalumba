import { Section } from "@/components/section";

export default function ResultsPage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Results</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Analysis results from running yalumba against synthetic and real
          genomic datasets. This page is updated as the analysis progresses.
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
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Full siblings show higher similarity than parent-child because siblings
          can share identical segments from <em>both</em> parents (IBD2 regions),
          while parent-child pairs only share one copy.
        </p>
      </Section>

      <Section title="CEPH trio — 1000 Genomes (real data)" id="ceph-results">
        <p className="text-[var(--color-text-muted)] mb-4">
          Low-coverage whole-genome sequencing from the 1000 Genomes Project, phase 3.
          NA12891 (father) + NA12892 (mother) → NA12878 (daughter).
        </p>
        <p className="text-[var(--color-text-muted)] mb-4">
          Config: 50,000 reads per sample, 1.8M bases, k=21.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 pr-4 text-[var(--color-text-muted)]">Pair</th>
                <th className="text-right py-2 px-4 text-[var(--color-text-muted)]">Jaccard</th>
                <th className="text-right py-2 px-4 text-[var(--color-text-muted)]">Shared k-mers</th>
                <th className="text-left py-2 pl-4 text-[var(--color-text-muted)]">Relationship</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["NA12891 ↔ NA12892", "0.008120", "28,212", "Unrelated spouses"],
                ["NA12891 ↔ NA12878", "0.006164", "21,602", "Father ↔ Daughter"],
                ["NA12892 ↔ NA12878", "0.006284", "22,002", "Mother ↔ Daughter"],
              ].map(([pair, score, shared, rel]) => (
                <tr key={pair} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4">{pair}</td>
                  <td className="py-2 px-4 text-right text-[var(--color-accent)]">{score}</td>
                  <td className="py-2 px-4 text-right">{shared}</td>
                  <td className="py-2 pl-4 text-[var(--color-text-muted)]">{rel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
          <h4 className="font-medium text-sm text-[var(--color-accent-2)]">Key finding</h4>
          <p className="text-sm text-[var(--color-text-muted)]">
            Raw k-mer Jaccard similarity on low-coverage shotgun reads does <strong className="text-[var(--color-text)]">not</strong> cleanly
            separate related from unrelated individuals. The unrelated spouses (NA12891 ↔ NA12892) actually
            show slightly <em>higher</em> Jaccard than parent-child pairs.
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            This happens because at low coverage (~4x), random reads from two samples rarely land on
            the same genomic positions. K-mer overlap is dominated by sequencing coverage overlap,
            not genetic relatedness.
          </p>
          <h4 className="font-medium text-sm text-[var(--color-accent-2)] pt-2">Next steps</h4>
          <ul className="text-sm text-[var(--color-text-muted)] list-disc pl-5 space-y-1">
            <li>Align reads to a reference genome, then compare at overlapping positions</li>
            <li>Use higher coverage data (exome or deep WGS) where read overlap is guaranteed</li>
            <li>Implement a reference-free approach using MinHash on much larger read sets</li>
            <li>Build a position-aware comparison that only scores regions with coverage in both samples</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}
