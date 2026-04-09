---
name: experiment
description: Run a symbiogenesis algorithm experiment and generate a LaTeX-style scientific paper
user-invocable: true
---

# Experiment Workflow

When the user invokes `/experiment`, follow this exact workflow:

## 1. Identify the algorithm
Ask the user which algorithm to run, or if they specify one, confirm it. The algorithms live in `packages/symbiogenesis/src/algorithms/`.

## 2. Run the experiment
Run the algorithm on the CEPH 1463 dataset with full instrumentation:
```bash
bun run packages/symbiogenesis/src/run.ts
```

If a specific algorithm runner exists, use that. Capture ALL output including:
- Phase timing (load, prep, compare)
- Memory usage
- Per-pair scores and details
- Separation and weakest-gap metrics

## 3. Generate the scientific paper

Create a Next.js page at `apps/docs/src/app/reports/[slug]/page.tsx` using the Paper component from `@/components/paper`.

### Paper requirements — MANDATORY:

**The paper must be comprehensive (600-1000+ lines).** It is a scientific document, not a summary.

#### Structure:
1. **Title** — Specific, descriptive, includes the algorithm name and key result
2. **Abstract** — 150+ words with specific numbers (separation %, pair counts, timing)
3. **Introduction** — The problem, why this algorithm, what's novel about the approach
4. **Methods**
   - Dataset description with ASCII pedigree diagram
   - Algorithm description with pseudocode or equations (use Equation component)
   - Evaluation metrics with formulas
   - Implementation details (language, runtime, memory constraints)
5. **Results**
   - Full score table for ALL pairs (not just averages)
   - Per-phase timing breakdown table
   - Memory usage analysis
   - Comparison to baseline (Rare-Run P90 at +583% separation)
   - Score ranking with visual representation
6. **Discussion**
   - What the algorithm detected and why
   - Where it succeeds vs fails (specific pairs)
   - Connection to symbiogenesis theory
   - Connection to classical genomics (IBD, haplotype blocks)
   - Limitations (be honest and specific)
   - What would improve it
7. **Conclusion** — 2-3 paragraphs summarizing findings
8. **References** — 10+ real references

#### Design:
- Use `Paper` component from `@/components/paper` for serif typography
- Use `Equation` component for mathematical formulas
- Use `<div className="figure">` for tables with `<p className="figure-caption">` captions
- Use `<p className="mono">` for code/pseudocode blocks
- Tables should have proper headers and alignment

#### Data integrity:
- ALL numbers must come from actual experiment output — never fabricate
- Include raw scores to 6 decimal places
- Show timing to 2 decimal places
- Report memory in MB

## 4. Add to reports listing
Update `apps/docs/src/app/reports/page.tsx` to include the new report at the top of the list.

## 5. Build, commit, deploy
```bash
cd apps/docs && bun run build
git add -A && git commit -m "feat: [algorithm name] experiment report"
git push
cd apps/docs && vercel --prod
```

## 6. Report back
Show the user:
- Key results (separation, weakest gap, detects all?)
- Paper URL
- What visualizations would work for this data
- What to try next
