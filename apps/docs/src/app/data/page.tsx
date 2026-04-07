import { Section } from "@/components/section";
import { CodeBlock } from "@/components/code-block";

export default function DataPage() {
  return (
    <div className="space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Data sources</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Genomic datasets used for development, testing, and validation
          of the yalumba pipeline.
        </p>
      </header>

      <Section title="Synthetic family" id="synthetic">
        <p className="text-[var(--color-text-muted)] mb-4">
          We generate a 4-member family with controlled relatedness for
          validating our algorithms against known ground truth.
        </p>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mb-6 font-mono text-sm">
          <pre className="text-[var(--color-text-muted)]">{`Parent A ──┬── Parent B    (unrelated)
           │
      ┌────┴────┐
    Child 1   Child 2      (full siblings)`}</pre>
        </div>
        <div className="space-y-2 mb-6">
          <h4 className="font-medium text-sm">Parameters</h4>
          <div className="grid grid-cols-2 gap-2 text-sm max-w-md">
            {[
              ["Genome length", "100,000 bp"],
              ["Reads per person", "2,000"],
              ["Read length", "150 bp"],
              ["Mutation rate", "0.001"],
              ["Error rate", "0.005"],
              ["Recombination block", "5,000 bp"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <span className="text-[var(--color-text-muted)]">{k}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <CodeBlock language="bash" code="bun run packages/tooling/generate-family.ts" />

        <div className="mt-6">
          <h4 className="font-medium text-sm mb-3">Observed similarity (Jaccard k-mer)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-4 text-[var(--color-text-muted)]">Pair</th>
                  <th className="text-right py-2 px-4 text-[var(--color-text-muted)]">Jaccard</th>
                  <th className="text-left py-2 pl-4 text-[var(--color-text-muted)]">Expected relationship</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  ["Parent A ↔ Parent B", "0.000", "Unrelated"],
                  ["Parent A ↔ Child 1", "~0.131", "Parent-child"],
                  ["Parent A ↔ Child 2", "~0.129", "Parent-child"],
                  ["Parent B ↔ Child 1", "~0.133", "Parent-child"],
                  ["Child 1 ↔ Child 2", "~0.155", "Full siblings"],
                ].map(([pair, score, rel]) => (
                  <tr key={pair} className="border-b border-[var(--color-border)]">
                    <td className="py-2 pr-4">{pair}</td>
                    <td className="py-2 px-4 text-right text-[var(--color-accent)]">{score}</td>
                    <td className="py-2 pl-4 text-[var(--color-text-muted)]">{rel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="CEPH/Utah family 1463" id="ceph">
        <p className="text-[var(--color-text-muted)] mb-4">
          The gold standard for relatedness research. A 17-member, 3-generation
          pedigree from the Centre d{"'"}Etude du Polymorphisme Humain. Exome
          sequencing data available through the International Genome Sample Resource.
        </p>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mb-6 font-mono text-sm">
          <pre className="text-[var(--color-text-muted)]">{`Grandparents:  NA12889+NA12890 (paternal)    NA12891+NA12892 (maternal)
                    |                                 |
Parents:         NA12877 (father)    ────    NA12878 (mother)
                              |
Children:     NA12879, NA12880, NA12881, NA12882, NA12883,
              NA12884, NA12885, NA12886, NA12887, NA12888, NA12893`}</pre>
        </div>
        <div className="space-y-3 mb-6">
          <h4 className="font-medium text-sm">Expected shared DNA</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-4 text-[var(--color-text-muted)]">Relationship</th>
                  <th className="text-right py-2 px-4 text-[var(--color-text-muted)]">Expected cM</th>
                  <th className="text-right py-2 pl-4 text-[var(--color-text-muted)]">IBD</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  ["Parent ↔ Child", "~3,400", "50%"],
                  ["Full siblings", "~2,550", "~50%"],
                  ["Grandparent ↔ Grandchild", "~1,700", "25%"],
                  ["Uncle/Aunt ↔ Niece/Nephew", "~1,700", "25%"],
                  ["Half-siblings", "~1,700", "25%"],
                  ["First cousins", "~850", "12.5%"],
                ].map(([rel, cm, ibd]) => (
                  <tr key={rel} className="border-b border-[var(--color-border)]">
                    <td className="py-2 pr-4">{rel}</td>
                    <td className="py-2 px-4 text-right text-[var(--color-accent)]">{cm}</td>
                    <td className="py-2 pl-4 text-right text-[var(--color-accent-2)]">{ibd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <h4 className="font-medium text-sm mb-2">Data source</h4>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">
          Exome CRAMs from the 1000 Genomes Project via EBI FTP. ENA project: ERP001960.
        </p>
        <CodeBlock language="bash" code="bun run packages/tooling/download-ceph.ts" />
      </Section>
    </div>
  );
}
