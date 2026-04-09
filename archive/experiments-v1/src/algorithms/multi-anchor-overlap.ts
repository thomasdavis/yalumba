import type { Experiment, SampleData, ExperimentScore } from "../types.js";

/** Three 40bp anchors at different positions per read */
export const multiAnchorOverlap: Experiment = {
  name: "Multi-anchor overlap (40bp ×3)",
  version: 1,
  description: "Three 40bp anchors per read at different offsets, compare non-anchor bases",

  compare(a: SampleData, b: SampleData): ExperimentScore {
    const anchorLen = 40;
    const trim = 10;
    const numAnchors = 3;
    const readLen = a.reads[0]?.length ?? 0;
    const stride = Math.max(1, Math.floor((readLen - trim * 2 - anchorLen) / (numAnchors - 1)));

    const indices: Map<string, { readIdx: number; offset: number }[]>[] = [];
    for (let s = 0; s < numAnchors; s++) {
      const offset = trim + s * stride;
      const idx = new Map<string, { readIdx: number; offset: number }[]>();
      for (let i = 0; i < a.reads.length; i++) {
        const read = a.reads[i]!;
        if (offset + anchorLen > read.length - trim) continue;
        const key = read.slice(offset, offset + anchorLen);
        const existing = idx.get(key);
        if (existing) { if (existing.length < 3) existing.push({ readIdx: i, offset }); }
        else { idx.set(key, [{ readIdx: i, offset }]); }
      }
      indices.push(idx);
    }

    const verified = new Set<string>();
    let matches = 0, mismatches = 0;

    for (let bi = 0; bi < b.reads.length; bi++) {
      const readB = b.reads[bi]!;
      for (let s = 0; s < numAnchors; s++) {
        const offset = trim + s * stride;
        if (offset + anchorLen > readB.length - trim) continue;
        const key = readB.slice(offset, offset + anchorLen);
        const hits = indices[s]!.get(key);
        if (!hits) continue;
        for (const hit of hits) {
          const pairKey = `${hit.readIdx}:${bi}`;
          if (verified.has(pairKey)) continue;
          verified.add(pairKey);
          const readA = a.reads[hit.readIdx]!;
          const end = Math.min(readA.length, readB.length) - trim;
          for (let i = hit.offset + anchorLen; i < end; i++) {
            if (readA[i] === readB[i]) matches++; else mismatches++;
          }
          for (let i = trim; i < hit.offset; i++) {
            if (readA[i] === readB[i]) matches++; else mismatches++;
          }
        }
      }
    }

    const total = matches + mismatches;
    const identity = total > 0 ? matches / total : 0;
    return {
      score: identity,
      detail: `${verified.size.toLocaleString()} overlaps, ${(identity * 100).toFixed(3)}% identity`,
    };
  },
};
