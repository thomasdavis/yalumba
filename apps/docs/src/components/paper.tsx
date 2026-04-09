interface PaperProps {
  title: string;
  authors: string;
  date: string;
  abstract: string;
  slug?: string;
  children: React.ReactNode;
}

export function Paper({ title, authors, date, abstract, slug, children }: PaperProps) {
  return (
    <article className="paper max-w-3xl mx-auto">
      <style>{`
        .paper { font-family: "Computer Modern", "Latin Modern", "Times New Roman", Georgia, serif; }
        .paper h1 { font-family: "Computer Modern", "Latin Modern", "Times New Roman", Georgia, serif; }
        .paper h2 { font-size: 1.15rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.25rem; }
        .paper h3 { font-size: 1rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; font-style: italic; }
        .paper p { margin-bottom: 0.75rem; line-height: 1.65; text-align: justify; }
        .paper table { font-size: 0.8rem; border-collapse: collapse; width: 100%; margin: 1rem 0; }
        .paper th { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 2px solid var(--color-text); font-weight: 700; }
        .paper td { padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--color-border); }
        .paper .equation { text-align: center; margin: 1rem 0; font-style: italic; color: var(--color-accent); }
        .paper .figure { margin: 1.5rem 0; padding: 1rem; border: 1px solid var(--color-border); border-radius: 4px; }
        .paper .figure-caption { font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.5rem; }
        .paper .abstract-box { border-left: 3px solid var(--color-accent); padding-left: 1rem; margin: 1.5rem 0; }
        .paper code { font-family: "SF Mono", "Fira Code", monospace; font-size: 0.85em; background: var(--color-surface-2); padding: 0.1em 0.3em; border-radius: 2px; }
        .paper .mono { font-family: "SF Mono", "Fira Code", monospace; font-size: 0.85rem; }
      `}</style>

      <header className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-3">{title}</h1>
        <p className="text-[var(--color-accent-2)] mb-1">{authors}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{date}</p>
        {slug && (
          <a
            href={`/reports/${slug}.pdf`}
            download
            className="inline-block mt-3 px-4 py-1.5 text-xs font-mono rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg)] transition-colors"
          >
            Download PDF
          </a>
        )}
      </header>

      <div className="abstract-box">
        <p className="text-sm font-bold text-[var(--color-text-muted)] mb-1">Abstract</p>
        <p className="text-sm">{abstract}</p>
      </div>

      <div className="mt-8">
        {children}
      </div>
    </article>
  );
}

export function Equation({ children }: { children: React.ReactNode }) {
  return <div className="equation">{children}</div>;
}
