import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "yalumba — genomics compute engine",
  description: "A living tutorial documenting genome analysis from FASTQ to relatedness metrics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <nav className="border-b border-[var(--color-border)] px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <a href="/" className="text-lg font-bold tracking-tight text-[var(--color-accent)]">
              yalumba
            </a>
            <div className="flex gap-6 text-sm text-[var(--color-text-muted)]">
              <a href="/" className="hover:text-[var(--color-text)] transition-colors">overview</a>
              <a href="/pipeline" className="hover:text-[var(--color-text)] transition-colors">pipeline</a>
              <a href="/data" className="hover:text-[var(--color-text)] transition-colors">data</a>
              <a href="/results" className="hover:text-[var(--color-text)] transition-colors">results</a>
              <a href="/packages" className="hover:text-[var(--color-text)] transition-colors">packages</a>
              <a href="/reports" className="hover:text-[var(--color-text)] transition-colors">reports</a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-5xl px-6 py-12">
          {children}
        </main>
        <footer className="border-t border-[var(--color-border)] px-6 py-8 text-center text-xs text-[var(--color-text-muted)]">
          yalumba — built from scratch, no external bioinformatics libraries
        </footer>
      </body>
    </html>
  );
}
