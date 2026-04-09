import Link from "next/link";
import { Section } from "@/components/section";

const reports = [
  {
    slug: "cross-dataset-2026-04",
    title: "Cross-Dataset Validation: 29 Algorithms on 3 Datasets (Synthetic, GIAB, CEPH 1463)",
    date: "April 2026",
    abstract: "Comprehensive validation across synthetic family, GIAB trio, and 6-member CEPH 1463 pedigree. On the hardest dataset (same-population, 10 pairs), only 2/29 algorithms detect all related pairs. Run-length algorithms dominate on easy datasets but fail when population background sharing confounds. Seed-extend overlap rate is the only algorithm robust across all three datasets. Identifies population baseline subtraction as the key research frontier.",
    authors: "yalumba project",
    tags: ["cross-dataset", "CEPH 1463", "population sharing", "robustness", "3 datasets"],
  },
  {
    slug: "symbiogenesis-run-length-2026-04",
    title: "Run-Length Symbiogenesis: 29 Algorithms for Reference-Free Relatedness Detection",
    date: "April 2026",
    abstract: "29 algorithms benchmarked on GIAB and synthetic data. Run Length P90 achieves +250% separation on real data — 2.8x better than recombination distance. 8 new symbiogenesis-inspired run-length variants exploit the insight that IBD segments produce compressible patterns of consecutive shared k-mers. 24/29 detect both parent-child pairs including cross-batch mother-son. Multi-dataset framework with caching validates results on synthetic ground truth.",
    authors: "yalumba project",
    tags: ["symbiogenesis", "run-length", "IBD", "GIAB", "29 algorithms"],
  },
  {
    slug: "algorithm-comparison-2026-04",
    title: "Relatedness Detection Algorithm Comparison (v1)",
    date: "April 2026",
    abstract: "Initial 21-algorithm comparison. Symbiogenesis-inspired recombination distance produces 83x stronger signal than any classical approach. 18/21 algorithms detect both parent-child relationships.",
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
