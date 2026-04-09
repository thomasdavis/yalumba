---
name: experiment
description: Run a symbiogenesis algorithm experiment on CEPH 1463 and generate a LaTeX scientific paper
user-invocable: true
---

# Experiment Workflow

When the user invokes `/experiment`, execute this complete pipeline:

## 1. Identify the algorithm
Confirm which algorithm to run. Algorithms live in `packages/symbiogenesis/src/algorithms/`.

## 2. Run the experiment on CEPH 1463
Run with full instrumentation via `packages/symbiogenesis/src/run.ts`.
Capture ALL output: phase timing, memory, per-pair scores, separation, weakest gap.

## 3. Generate LaTeX paper

Create `apps/docs/latex/reports/[slug].tex` using the yalumba document class.

### Paper requirements — ALL MANDATORY:

**Length: 1000+ lines LaTeX source, targeting 25-30 pages PDF.**

#### Design rules:
- Use `\documentclass{../yalumba}` (wine palette — brand colors for ornaments only)
- ALL text is white/gray/black — no colored typography
- Brand colors (wine burgundy, champagne gold) used ONLY for ornamental elements: rules, borders, box edges, bullets
- Use `\setabstract{...}` for the abstract
- Use `keyfinding`, `limitation`, `definition` environments for callout boxes
- Use `pedigree` environment for family tree diagrams
- Use proper `\begin{equation}` for all math
- Use booktabs tables with full data
- End with `\bibliographystyle{plain}` and `\bibliography{../references}`

#### Sections (ALL required):
1. **Abstract** (250+ words, all key numbers)
2. **Introduction** (~2 pages) — problem, why this algorithm, symbiogenesis framing, contributions
3. **Background** (~2 pages) — classical IBD, k-mer limitations, population sharing wall with math, module inheritance theory
4. **Methods** (~4 pages) — dataset with pedigree diagram, algorithm pipeline (every step), equations for all metrics, implementation details (language, memory, timing infrastructure)
5. **Results** (~5 pages) — full score table for ALL pairs with ALL component values, score ranking, separation analysis with keyfinding box, weakest gap analysis with limitation box, component contributions, comparison to baselines (v1 experiments + Module Persistence), timing breakdown, memory analysis
6. **Discussion** (~4 pages) — what works/fails (specific pairs), connection to classical genomics, symbiogenesis contribution assessment, computational profile, native acceleration potential, 6+ specific limitations each with honest analysis
7. **Future work** (~1 page) — 5+ concrete directions
8. **Conclusion** (~1 page) — 3 substantial paragraphs
9. **References** (14+ entries using \cite{})

#### Data integrity:
- ALL numbers from actual experiment output — never fabricate
- Raw scores to 6 decimal places
- Timing to 2 decimal places
- Memory in MB
- Include every pair, every component value

## 4. Compile PDF
```bash
cd apps/docs/latex && tectonic reports/[slug].tex -o ../public/reports/
```

## 5. Add to reports listing
Update `apps/docs/src/app/reports/page.tsx` with the new report.
Add `slug` prop to the report's TSX page for the download button.

## 6. Build, commit, push, deploy
```bash
cd apps/docs && bun run build
cd ../.. && git add -A && git commit -m "feat: [algorithm] experiment + 30-page LaTeX paper"
git push
cd apps/docs && vercel --prod
```

## 7. Report back to user
Show: key results, paper URL, PDF URL, what to try next.
