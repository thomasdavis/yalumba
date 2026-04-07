interface SectionProps {
  title: string;
  id: string;
  children: React.ReactNode;
}

export function Section({ title, id, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-6 text-2xl font-bold tracking-tight">
        <a href={`#${id}`} className="hover:text-[var(--color-accent)] transition-colors">
          {title}
        </a>
      </h2>
      {children}
    </section>
  );
}
