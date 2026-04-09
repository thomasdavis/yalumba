/**
 * Extract motifs from reads.
 * A motif is a canonical k-mer hash — the atomic building block of modules.
 * We use k=15 (shorter than the k=21 used in v1 experiments) because
 * modules need denser motif coverage to detect co-occurrence.
 */

const DEFAULT_K = 15;

/** Extract all motif hashes from a read */
export function extractMotifs(read: string, k: number = DEFAULT_K): number[] {
  const motifs: number[] = [];
  for (let i = 0; i <= read.length - k; i++) {
    if (isLowComplexity(read, i, k)) continue;
    motifs.push(canonicalHash(read, i, k));
  }
  return motifs;
}

/** Extract motifs with positions */
export function extractMotifsWithPositions(
  read: string, k: number = DEFAULT_K,
): { hash: number; position: number }[] {
  const result: { hash: number; position: number }[] = [];
  for (let i = 0; i <= read.length - k; i++) {
    if (isLowComplexity(read, i, k)) continue;
    result.push({ hash: canonicalHash(read, i, k), position: i });
  }
  return result;
}

function canonicalHash(seq: string, offset: number, k: number): number {
  let fwd = 0x811c9dc5 | 0;
  for (let i = offset; i < offset + k; i++) {
    fwd ^= seq.charCodeAt(i);
    fwd = Math.imul(fwd, 0x01000193);
  }
  fwd = fwd >>> 0;

  let rev = 0x811c9dc5 | 0;
  for (let i = offset + k - 1; i >= offset; i--) {
    const c = seq.charCodeAt(i);
    const comp = c === 65 ? 84 : c === 84 ? 65 : c === 67 ? 71 : c === 71 ? 67 : c;
    rev ^= comp;
    rev = Math.imul(rev, 0x01000193);
  }
  rev = rev >>> 0;
  return fwd < rev ? fwd : rev;
}

function isLowComplexity(seq: string, offset: number, k: number): boolean {
  const counts = [0, 0, 0, 0];
  for (let i = offset; i < offset + k; i++) {
    const c = seq.charCodeAt(i);
    if (c === 65) counts[0]++;
    else if (c === 67) counts[1]++;
    else if (c === 71) counts[2]++;
    else if (c === 84) counts[3]++;
  }
  if (Math.max(counts[0]!, counts[1]!, counts[2]!, counts[3]!) > k * 0.8) return true;
  let di = 0;
  for (let i = offset + 2; i < offset + k; i++) {
    if (seq.charCodeAt(i) === seq.charCodeAt(i - 2)) di++;
  }
  return di > (k - 2) * 0.6;
}
