const BASES = ["A", "C", "G", "T"] as const;
const COLORS: Record<string, string> = {
  A: "var(--color-dna-a)",
  C: "var(--color-dna-c)",
  G: "var(--color-dna-g)",
  T: "var(--color-dna-t)",
};

export function Dnastrand() {
  const sequence = "ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT";

  return (
    <div className="flex gap-[2px] overflow-hidden opacity-40">
      {sequence.split("").map((base, i) => (
        <span
          key={i}
          className="text-[10px] font-bold"
          style={{ color: COLORS[base] }}
        >
          {base}
        </span>
      ))}
    </div>
  );
}
