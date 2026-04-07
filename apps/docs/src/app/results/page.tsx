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

      <Section title="CEPH family 1463 — pending" id="ceph-results">
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-[var(--color-text-muted)]">
            Real data analysis in progress. Results will appear here as the
            CEPH family exome data is processed through the pipeline.
          </p>
        </div>
      </Section>
    </div>
  );
}
