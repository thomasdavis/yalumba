import Link from "next/link";
import { Section } from "@/components/section";

const reports = [
  {
    slug: "algorithm-comparison-2026-04",
    title: "Relatedness Detection Algorithm Comparison",
    date: "April 2026",
    abstract: "21 algorithms benchmarked on GIAB Ashkenazi trio data. Symbiogenesis-inspired recombination distance produces 83x stronger signal than any classical approach. 18/21 algorithms detect both parent-child relationships including cross-batch mother-son.",
    authors: "yalumba project",
    tags: ["relatedness", "symbiogenesis", "k-mer", "GIAB"],
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Reports</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Scientific reports documenting yalumba analysis results,
          algorithm comparisons, and methodological findings.
        </p>
      </header>

      <Section title="Published reports" id="reports">
        <div className="space-y-4">
          {reports.map((report) => (
            <Link
              key={report.slug}
              href={`/reports/${report.slug}`}
              className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 hover:border-[var(--color-accent)] transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-bold">{report.title}</h3>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0 ml-4">{report.date}</span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] mb-3">
                {report.abstract}
              </p>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[var(--color-accent-2)]">{report.authors}</span>
                <div className="flex gap-2">
                  {report.tags.map((tag) => (
                    <span key={tag} className="rounded bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
