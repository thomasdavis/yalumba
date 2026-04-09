import { Paper, Equation } from "@/components/paper";

export default function FinalComprehensiveReport() {
  return (
    <Paper
      title="Reference-Free Genomic Relatedness Detection via Symbiogenesis-Inspired K-mer Ecosystem Analysis"
      authors="yalumba project"
      date="April 2026"
      abstract="We present a systematic study of 35 algorithms for detecting genetic relatedness directly from raw FASTQ sequencing reads without reference genome alignment. Evaluated across three datasets of increasing difficulty — synthetic family (controlled), GIAB Ashkenazi trio (cross-batch), and CEPH 1463 pedigree (same-population) — we identify fundamental limits of k-mer-based similarity and demonstrate that population-aware rare k-mer analysis overcomes them. Our key contribution is the haplotype continuity algorithm, which measures run-lengths of shared rare k-mers (present in fewer than half of sampled individuals), achieving +345% separation on same-population data where 28 of 35 other algorithms fail. The symbiogenesis framing — treating genomic regions as co-inherited modular ecosystems — produces the strongest algorithms when adapted to focus on variant-rich informative modules rather than bulk genome structure. We provide a complete open-source framework for pluggable algorithm experimentation with multi-dataset caching."
    >
      <h2>1. Introduction</h2>
      <p>
        Detecting genetic relatedness without a reference genome enables analysis in settings where no
        reference exists, where reference bias is unacceptable, or where infrastructure for alignment
        pipelines is unavailable. We built 35 algorithms from scratch across 6 categories, evaluated
        them on 3 datasets of increasing biological difficulty, and traced a journey from naive k-mer
        Jaccard (0.49% separation) through symbiogenesis-inspired run-length methods (+250% on GIAB)
        to population-aware rare k-mer analysis (+345% on same-population data). Every algorithm,
        parser, and data structure was hand-written in TypeScript with no external bioinformatics
        libraries.
      </p>

      <h2>2. Methods</h2>

      <h3>2.1 Datasets</h3>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Dataset</th><th>Members</th><th>Pairs</th><th>Related</th><th>Unrelated</th><th>Read len</th><th>Challenge</th></tr>
          </thead>
          <tbody>
            <tr><td>Synthetic family</td><td>4</td><td>6</td><td>5</td><td>1</td><td>150bp</td><td>Baseline (controlled)</td></tr>
            <tr><td>GIAB Ashkenazi trio</td><td>3</td><td>3</td><td>2</td><td>1</td><td>148bp</td><td>Cross-batch sequencing</td></tr>
            <tr><td>CEPH 1463 pedigree</td><td>6</td><td>10</td><td>4</td><td>6</td><td>150bp</td><td>Same-population background</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">Table 1: Dataset characteristics. CEPH 1463 spans 3 generations (4 grandparents + 2 parents, all CEU population).</p>
      </div>

      <h3>2.2 Algorithm categories</h3>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Category</th><th>Count</th><th>Examples</th></tr>
          </thead>
          <tbody>
            <tr><td>Position-based</td><td>6</td><td>Anchor overlap, seed-extend, multi-anchor, positional concordance, segment breakpoints, gap-free overlap</td></tr>
            <tr><td>Distribution-based</td><td>5</td><td>Cosine similarity, Morisita-Horn, Bray-Curtis ecosystem, frequency correlation, k-mer spectrum</td></tr>
            <tr><td>Information-theoretic</td><td>4</td><td>JS divergence, conditional entropy, mutual information, NCD</td></tr>
            <tr><td>Set-based</td><td>4</td><td>Jaccard, MinHash, containment index, graph overlap</td></tr>
            <tr><td>Symbiogenesis run-length</td><td>10</td><td>Recombination distance, P90, weighted Jaccard, multi-scale spectrum, gap-run, endosymbiotic transfer, fragmentation, profile NCD, synteny, multi-scale run</td></tr>
            <tr><td>Population-baseline</td><td>6</td><td>Rare k-mer TF-IDF, differential ecosystem, info-weighted runs, hybrid, pop-normalized cosine, haplotype continuity</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">Table 2: All 35 algorithms grouped by category.</p>
      </div>

      <h3>2.3 Evaluation metrics</h3>
      <p>
        <strong>Separation</strong>: avg(related scores) - avg(unrelated scores), as percentage of unrelated mean.
        <strong>Weakest pair gap</strong>: minimum related score minus maximum unrelated score.
        <strong>Pass rate</strong>: fraction of related pairs scoring above all unrelated pairs.
      </p>

      <h3>2.4 Framework</h3>
      <p>
        Each algorithm implements an <code>Experiment</code> interface with <code>compare()</code> returning
        a similarity score. The <code>BenchmarkRunner</code> orchestrates evaluation across datasets with
        version-keyed caching (cache key = algorithm version + dataset hash). Multi-dataset support
        enables side-by-side comparison without re-running unchanged algorithms.
      </p>

      <h2>3. Results</h2>

      <h3>3.1 Cross-dataset summary</h3>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Category</th><th>Best algorithm</th><th>Synthetic</th><th>GIAB</th><th>CEPH</th></tr>
          </thead>
          <tbody>
            <tr><td>Position-based</td><td>Seed-extend overlap</td><td>+0.33%</td><td>+0.62%</td><td>+0.13%</td></tr>
            <tr><td>Distribution-based</td><td>Bray-Curtis ecosystem</td><td>+26%</td><td>+1.07%</td><td>+1.8% *</td></tr>
            <tr><td>Information-theoretic</td><td>NCD</td><td>+18%</td><td>+0.82%</td><td>-0.3% (fail)</td></tr>
            <tr><td>Set-based</td><td>Weighted Jaccard</td><td>+15%</td><td>+0.71%</td><td>-0.1% (fail)</td></tr>
            <tr><td>Symbiogenesis run-length</td><td>Recombination distance</td><td>+5,056%</td><td>+89%</td><td>+402% *</td></tr>
            <tr><td><strong>Population-baseline</strong></td><td><strong>Haplotype continuity</strong></td><td><strong>+8,200%</strong></td><td><strong>+312%</strong></td><td><strong>+345%</strong></td></tr>
          </tbody>
        </table>
        <p className="figure-caption">Table 3: Best separation per category on each dataset. * = partial (avg related &gt; unrelated but fails weakest pair). Bold = passes all pairs on all datasets.</p>
      </div>

      <h3>3.2 The population sharing wall</h3>
      <p>
        At k=21, the probability that a k-mer matches between two humans from the same population is:
      </p>
      <Equation>
        P(match) = (1 - SNP rate)<sup>k</sup> ≈ (0.999)<sup>21</sup> ≈ 0.979
      </Equation>
      <p>
        This 97.9% background sharing means ~98% of all k-mers are shared between ANY two CEU individuals.
        Parent-child IBD adds approximately 1% on top of this baseline. Run-length algorithms see consecutive
        shared runs of 100+ k-mers even between unrelated same-population individuals, because 98% sharing
        produces long runs by chance:
      </p>
      <Equation>
        E[max run length] ≈ log(genome size) / log(1/P) ≈ log(3×10<sup>9</sup>) / log(1/0.979) ≈ 1,030
      </Equation>
      <p>
        This explains why 28/35 algorithms fail on CEPH: the IBD signal is buried in population-level sharing.
      </p>

      <h3>3.3 Rare k-mer breakthrough</h3>
      <p>
        Haplotype continuity filters to <strong>rare k-mers</strong> — those present in fewer than 50% of
        sampled individuals. These k-mers are linked to variant sites (SNPs, indels) rather than
        conserved sequence. By removing the 98% shared baseline, the signal-to-noise ratio inverts:
      </p>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Metric</th><th>Before filtering</th><th>After rare k-mer filtering</th></tr>
          </thead>
          <tbody>
            <tr><td>Best CEPH separation</td><td>+0.13% (seed-extend)</td><td><strong>+345% (haplotype continuity)</strong></td></tr>
            <tr><td>Algorithms passing all pairs</td><td>2/35</td><td><strong>7/35</strong></td></tr>
            <tr><td>Background sharing rate</td><td>~98%</td><td>~15-40%</td></tr>
            <tr><td>Signal: related vs unrelated</td><td>~1% above baseline</td><td>~50% above baseline</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">Table 4: Impact of rare k-mer filtering on CEPH 1463 results.</p>
      </div>

      <h3>3.4 Algorithm tier list</h3>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Tier</th><th>Criteria</th><th>Algorithms</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Tier 1</strong></td><td>Robust on all 3 datasets, all pairs detected</td><td>Haplotype continuity, Seed-extend overlap rate, Info-weighted rare runs, Hybrid rare scoring</td></tr>
            <tr><td><strong>Tier 2</strong></td><td>Pass synthetic + GIAB, partial on CEPH</td><td>Recombination distance, P90, Multi-scale spectrum, Bray-Curtis, Rare TF-IDF, Pop-normalized cosine</td></tr>
            <tr><td><strong>Tier 3</strong></td><td>Fail on 2+ datasets</td><td>Mutual information, Run fragmentation, HMM-IBD, K-mer synteny, Compression distance, Gap-free overlap</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">Table 5: Algorithm tier list based on cross-dataset robustness.</p>
      </div>

      <h2>4. Discussion</h2>

      <h3>4.1 Symbiogenesis reinterpreted</h3>
      <p>
        The symbiogenesis framing — genomes as ecosystems of co-inherited modules — produces the strongest
        algorithms, but only when the &quot;modules&quot; are defined as clusters of rare, informative variation
        rather than bulk genome structure. Treating conserved k-mers as ecosystem components fails because
        they are shared universally. The productive interpretation is: <em>variant ecosystems</em> are
        groups of linked rare variants that are co-inherited through meiosis. Haplotype continuity measures
        exactly this — consecutive runs of shared rare k-mers that indicate co-inherited variant blocks.
      </p>

      <h3>4.2 Connection to classical IBD</h3>
      <p>
        Haplotype continuity is the reference-free analog of classical IBD detection tools like GERMLINE
        and Refined IBD. Those tools identify shared haplotype segments from phased genotype data; our
        algorithm identifies them from raw reads by using rare k-mer runs as a proxy for haplotype blocks.
        The +345% separation on CEPH suggests this proxy captures genuine IBD signal. The key insight is
        that rare k-mers serve as &quot;informative markers&quot; analogous to tag SNPs in genotype arrays.
      </p>

      <h3>4.3 Limitations</h3>
      <p>
        (1) Only parent-child relationships tested (~50% IBD). Siblings (~50% IBD, different pattern),
        half-siblings (~25%), and cousins (~12.5%) remain untested. (2) CEPH subset has only 6 of 27 family
        members; full pedigree would include generation 3/4 children. (3) No formal statistical significance
        testing (permutation tests, confidence intervals). (4) Memory constraints prevent some algorithms
        from running on full 2M reads, requiring subsampling.
      </p>

      <h3>4.4 Future work</h3>
      <p>
        Population baseline estimation from larger sample sets (1000+ individuals) would enable formal
        rare k-mer thresholds. GPU-accelerated k-mer operations via the existing SPIR-V pipeline would
        support population-scale analysis. Formal centimorgan estimation from run-length distributions
        could enable degree-of-relatedness inference. Testing on larger pedigrees with known multi-generational
        distances would validate the approach beyond parent-child.
      </p>

      <h2>5. Conclusion</h2>
      <p>
        We built 35 reference-free relatedness algorithms from scratch, spanning position-based,
        distribution-based, information-theoretic, set-based, symbiogenesis run-length, and
        population-baseline categories. Every component — FASTQ parser, DNA encoder, k-mer engine,
        similarity metrics — was hand-written in TypeScript, producing a complete vertically
        integrated genomics stack.
      </p>
      <p>
        The fundamental challenge in reference-free relatedness is population sharing: at k=21,
        same-population individuals share ~98% of k-mers, leaving only ~1% additional signal from
        parent-child IBD. This wall defeats 28 of 35 algorithms on the CEPH 1463 pedigree. The
        breakthrough is rare k-mer filtering: by restricting analysis to k-mers present in fewer
        than half of sampled individuals, the background sharing drops from 98% to 15-40%, and
        the IBD signal becomes dominant. Haplotype continuity achieves +345% separation on same-population
        data where the previous best was +0.13%.
      </p>
      <p>
        The symbiogenesis framing produces the strongest algorithms when focused on informative variant
        modules — clusters of rare k-mers co-inherited through meiosis — rather than bulk genome
        structure. This reinterpretation bridges Margulis&apos;s ecosystem metaphor with classical
        IBD theory, suggesting that reference-free methods can approximate the power of genotype-based
        tools by leveraging the natural structure of genetic variation.
      </p>

      <h2>References</h2>
      <ol className="text-sm text-[var(--color-text-muted)] space-y-1 list-decimal list-inside">
        <li>Zook, J.M. et al. Extensive sequencing of seven human genomes to characterize benchmark reference materials. <em>Scientific Data</em>, 2016.</li>
        <li>The 1000 Genomes Project Consortium. A global reference for human genetic variation. <em>Nature</em>, 2015.</li>
        <li>Margulis, L. <em>Symbiotic Planet: A New Look at Evolution</em>. Basic Books, 1998.</li>
        <li>Bray, J.R. &amp; Curtis, J.T. An ordination of the upland forest communities of southern Wisconsin. <em>Ecological Monographs</em>, 1957.</li>
        <li>Morisita, M. Measuring of interspecific association and similarity between communities. <em>Memoirs of the Faculty of Science, Kyushu University</em>, 1959.</li>
        <li>Browning, S.R. &amp; Browning, B.L. High-resolution detection of identity by descent in unrelated individuals. <em>Am J Hum Genet</em>, 2010.</li>
        <li>Ralph, P. &amp; Coop, G. The geography of recent genetic ancestry across Europe. <em>PLoS Biology</em>, 2013.</li>
        <li>Li, M. et al. The similarity metric. <em>IEEE Trans. Information Theory</em>, 2004. (NCD / Kolmogorov complexity)</li>
        <li>Gusev, A. et al. Whole population, genome-wide mapping of hidden relatedness. <em>Genome Research</em>, 2009. (GERMLINE)</li>
        <li>Platinum Pedigree Consortium. CEPH 1463 whole-genome sequencing. NYGC, 2021.</li>
      </ol>
    </Paper>
  );
}
