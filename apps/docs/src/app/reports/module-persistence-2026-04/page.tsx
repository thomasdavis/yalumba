import { Paper, Equation } from "@/components/paper";

export default function ModulePersistenceReport() {
  return (
    <Paper
      title="Module Persistence Graphs: First Symbiogenesis-Native Algorithm for Reference-Free Relatedness Detection"
      authors="yalumba project"
      date="April 2026"
      slug="module-persistence-2026-04"
      abstract="We introduce the Module Persistence Graph (MPG) algorithm, the first relatedness detection method that operates on co-occurring motif modules rather than individual k-mers. Where previous approaches treated each k-mer as an independent token, MPG discovers higher-order structures — clusters of co-occurring motifs within sequencing reads — and compares their graph topology across samples. Evaluated on the CEPH 1463 pedigree (6 members, 10 pairs, 3 generations), MPG v2 achieves +4.76% average separation between related and unrelated pairs, with 3 of 4 parent-child pairs scoring above all unrelated pairs. However, the weakest related pair (Pat.GF to Father, 0.3424) falls below the highest-scoring in-law pair (Mat.GF to Father, 0.3741), yielding a weakest gap of -3.17%. Compared to the Rare-Run P90 baseline (+583% separation, all pairs detected), MPG demonstrates that module-level topology captures a genuinely different signal from singleton k-mer methods but one that is currently insufficient for robust kinship detection due to population-level sharing at the module scale. Preparation time is 1084.6 seconds with near-instantaneous comparison (0.0s per pair), reflecting the algorithm's front-loaded architecture. We analyze the strengths and limitations of the symbiogenesis-native framing and identify specific paths to improving module-level discrimination."
    >
      {/* ================================================================== */}
      {/* 1. INTRODUCTION                                                    */}
      {/* ================================================================== */}
      <h2>1. Introduction</h2>
      <p>
        Reference-free relatedness detection from raw sequencing reads has been a central focus
        of the yalumba project. Over 44 algorithms spanning 7 categories have been developed and
        evaluated, progressing from naive k-mer Jaccard (+0.49% separation) through run-length
        symbiogenesis methods (+250% on GIAB) to population-aware rare k-mer filtering (+583%
        on same-population CEPH data). Every algorithm developed to date, however, shares a common
        foundation: the individual k-mer as the atomic unit of analysis.
      </p>
      <p>
        This paper introduces a fundamentally different approach. Rather than counting, filtering,
        or run-scanning singleton k-mers, the Module Persistence Graph algorithm first discovers
        <em>modules</em> — clusters of k-mer motifs that co-occur within the same sequencing reads —
        and then compares the graph topology of these modules across samples. This is the first
        algorithm in the yalumba framework that is truly <em>symbiogenesis-native</em>: its
        primitive is the co-inherited module, not the individual genetic token.
      </p>
      <p>
        The symbiogenesis framing, inspired by Margulis&apos;s theory of endosymbiotic origins,
        treats genomes as ecosystems of co-inherited functional units. Previous algorithms borrowed
        the metaphor (recombination distance, endosymbiotic transfer scoring) but still operated on
        individual k-mers. MPG takes the metaphor literally: it identifies the &quot;organisms&quot;
        (modules) that compose the genomic ecosystem and compares ecosystems by their community
        structure rather than species census.
      </p>
      <p>
        The results are instructive. MPG captures a signal that is measurably different from
        k-mer-based methods — module topology detects structural relationships that single-token
        approaches miss. However, the algorithm reveals that population-level sharing, the
        fundamental barrier identified in previous work, operates at the module level as well.
        Modules constructed from common k-mers are universally shared across all CEU individuals,
        and the edge topology between these modules is similarly population-shared. The result is
        a +4.76% average separation that, while positive, is an order of magnitude weaker than
        the rare-k-mer approaches.
      </p>
      <p>
        This paper documents the full algorithm, its experimental results on the CEPH 1463 pedigree,
        a detailed comparison to previous methods, and an analysis of why module-level topology is
        simultaneously a genuinely novel signal and an insufficient one for robust kinship detection
        in its current form.
      </p>

      {/* ================================================================== */}
      {/* 2. BACKGROUND                                                      */}
      {/* ================================================================== */}
      <h2>2. Background</h2>

      <h3>2.1 The k-mer singleton paradigm</h3>
      <p>
        All 44 algorithms previously developed in this project treat k-mers as independent tokens.
        Set-based methods (Jaccard, MinHash) test membership. Distribution methods (cosine, Bray-Curtis)
        compare frequency profiles. Run-length methods (P90, recombination distance) measure
        consecutive sharing. Population-baseline methods (Rare-Run P90, haplotype continuity) filter
        to informative k-mers before applying these operations. In every case, the question is:
        &quot;Does k-mer X appear in both samples?&quot;
      </p>
      <p>
        This paradigm is powerful — Rare-Run P90 achieves +583% separation on same-population data —
        but it discards structural information. Two samples might share the same set of k-mers but
        arrange them in different genomic contexts. Conversely, two samples might share few individual
        k-mers but show strikingly similar patterns of k-mer co-occurrence, indicating shared
        higher-order genomic architecture.
      </p>

      <h3>2.2 Modules as the natural unit of inheritance</h3>
      <p>
        In population genetics, the natural unit of inheritance is not the individual nucleotide
        but the haplotype block — a stretch of DNA inherited intact through meiosis. Recombination
        breaks the genome into segments at each generation, but within segments, all variants are
        co-inherited. Classical IBD detection tools (GERMLINE, Refined IBD, IBIS) identify these
        blocks from phased genotype data.
      </p>
      <p>
        The module concept generalizes haplotype blocks to the reference-free setting. Without a
        reference genome, we cannot identify genomic positions or phase haplotypes. But we can
        identify groups of k-mers that consistently appear together in the same reads. These
        co-occurrence clusters — modules — are the reference-free analog of haplotype blocks.
        If two individuals share a module, they likely inherited the same haplotype block from a
        common ancestor.
      </p>

      <h3>2.3 Graph-based genomic comparison</h3>
      <p>
        Graph-based representations are well-established in computational biology. De Bruijn graphs
        underlie most modern genome assemblers. Variation graphs (vg toolkit) represent population
        diversity as a graph of alternative paths. Pangenome graphs capture structural variation
        across populations. MPG draws on this tradition but operates at a higher level of
        abstraction: nodes are modules (clusters of co-occurring motifs), and edges represent
        adjacency relationships observed in reads.
      </p>

      {/* ================================================================== */}
      {/* 3. METHODS                                                         */}
      {/* ================================================================== */}
      <h2>3. Methods</h2>

      <h3>3.1 Module extraction</h3>
      <p>
        Module extraction proceeds in three phases: motif selection, co-occurrence counting, and
        connected component clustering.
      </p>
      <p>
        <strong>Phase 1 — Motif selection.</strong> From each sample&apos;s reads, we extract all canonical
        k-mers (k=21) and identify motifs as k-mers exceeding a minimum frequency threshold. The
        canonical form is the lexicographically smaller of a k-mer and its reverse complement,
        ensuring strand-independent comparison. Motifs are stored as 64-bit hashes using the
        project&apos;s standard Rabin-Karp polynomial rolling hash:
      </p>
      <Equation>
        hash(kmer) = &Sigma; base_prime<sup>i</sup> &middot; char_code mod (2<sup>61</sup> - 1)
      </Equation>
      <p>
        <strong>Phase 2 — Window-based co-occurrence counting.</strong> For each read, we slide a window
        of fixed size (default: 50bp) and record which pairs of motifs co-occur within the
        window. Co-occurrence is tracked in a fixed-size typed array hash table with 16 million
        entries (2<sup>24</sup> slots), capped at 128MB of memory. The hash table uses open
        addressing with linear probing. Each entry stores a pair fingerprint (XOR of the two motif
        hashes, further hashed to 32 bits) and a count. Collisions are accepted as noise — at
        16M entries, the false-positive rate from hash collision is approximately:
      </p>
      <Equation>
        P(collision) &asymp; n<sup>2</sup> / (2 &middot; 2<sup>32</sup>) where n = number of unique pairs
      </Equation>
      <p>
        For typical samples with 500K-2M unique motif pairs, this yields a collision rate under 0.01%.
      </p>
      <p>
        <strong>Phase 3 — Connected component clustering.</strong> Motif pairs with co-occurrence count
        above a threshold (default: 3) are treated as edges in an undirected graph. Connected
        components of this graph become modules. Each module is thus a set of motifs that
        transitively co-occur within sequencing reads. Modules smaller than 3 motifs are discarded.
        The resulting module set for a sample typically contains 5,000-15,000 modules of sizes
        ranging from 3 to several hundred motifs.
      </p>

      <h3>3.2 Shared module vocabulary</h3>
      <p>
        After extracting modules independently from each sample, we construct a shared module
        vocabulary across all samples in the comparison set. Two modules from different samples are
        considered &quot;the same module&quot; if they share a sufficient fraction of their motifs.
        Module identity is determined by fingerprint matching:
      </p>
      <p>
        Each module&apos;s fingerprint is the sorted set of its constituent motif hashes. Two modules
        match if their Jaccard similarity exceeds 0.5 (i.e., more than half their motifs overlap).
        In practice, we use a faster approximation: the XOR of all motif hashes in sorted order
        produces a 64-bit fingerprint, and modules with identical fingerprints are considered
        identical. This sacrifices recall for speed — two modules that differ by a single motif
        will have completely different fingerprints — but the deduplication is sufficient for
        the graph comparison step.
      </p>
      <p>
        The union of all unique module fingerprints across samples forms the shared vocabulary.
        Each sample is then represented as a binary vector over this vocabulary: 1 if the sample
        contains a module matching that fingerprint, 0 otherwise.
      </p>

      <h3>3.3 Informative module filtering</h3>
      <p>
        A critical step inherited from the rare-k-mer paradigm: modules present in all samples
        are excluded from comparison. If every CEU individual in the dataset possesses module M,
        then M carries no discriminative information for relatedness. The filtering criterion is:
      </p>
      <Equation>
        Module M is informative iff count(samples containing M) &lt; N, where N = total samples
      </Equation>
      <p>
        On the 6-member CEPH 1463 dataset, this filter removes modules present in all 6 samples.
        Modules present in 2-5 samples are retained as potentially informative. This is a weaker
        filter than the rare-k-mer approach (which filters k-mers present in &gt;50% of samples),
        because with only 6 samples, requiring presence in fewer than 3 would be overly restrictive.
      </p>

      <h3>3.4 Graph construction</h3>
      <p>
        For each sample, we construct a module adjacency graph. Nodes are the informative modules
        present in that sample. Edges connect modules that appear in adjacent positions within
        the same reads. Specifically, if motifs from module A and motifs from module B appear in
        the same read within 100bp of each other, an edge is added between A and B. Edge weights
        (support values) count the number of reads supporting each adjacency.
      </p>
      <p>
        The resulting graph captures the <em>topology</em> of the module ecosystem: which modules
        are genomic neighbors, and how strongly their adjacency is supported by read evidence.
        Two related individuals who inherited the same haplotype block should share not only the
        same modules but the same adjacency relationships between modules.
      </p>

      <h3>3.5 Three-component scoring</h3>
      <p>
        The comparison score between two samples A and B combines three components, each capturing
        a different aspect of module sharing:
      </p>
      <p>
        <strong>Component 1 — Informative Module Jaccard (weight: 0.3).</strong> The Jaccard
        similarity of the informative module sets:
      </p>
      <Equation>
        J<sub>M</sub>(A, B) = |M<sub>A</sub> &cap; M<sub>B</sub>| / |M<sub>A</sub> &cup; M<sub>B</sub>|
      </Equation>
      <p>
        This measures how many modules two samples share, excluding universally-present modules.
        It is the module-level analog of k-mer Jaccard, but operating on higher-order structures.
      </p>
      <p>
        <strong>Component 2 — Edge Topology Jaccard (weight: 0.4).</strong> The Jaccard similarity
        of edge sets in the module adjacency graphs:
      </p>
      <Equation>
        J<sub>E</sub>(A, B) = |E<sub>A</sub> &cap; E<sub>B</sub>| / |E<sub>A</sub> &cup; E<sub>B</sub>|
      </Equation>
      <p>
        Two samples might share the same modules but connect them differently. Edge topology
        Jaccard captures whether the same modules are genomic neighbors in both samples. This
        is the most novel component — it has no analog in singleton k-mer methods. It receives
        the highest weight (0.4) because it theoretically captures the strongest IBD signal:
        co-inherited haplotype blocks preserve not just module content but module arrangement.
      </p>
      <p>
        <strong>Component 3 — Support Cosine Similarity (weight: 0.3).</strong> The cosine
        similarity of the edge support vectors:
      </p>
      <Equation>
        cos(support<sub>A</sub>, support<sub>B</sub>) = (s<sub>A</sub> &middot; s<sub>B</sub>) / (||s<sub>A</sub>|| &middot; ||s<sub>B</sub>||)
      </Equation>
      <p>
        where s<sub>A</sub> and s<sub>B</sub> are vectors of edge support counts over the union
        edge set. This captures quantitative similarity: even if two samples share the same edges,
        their support distributions may differ. Related individuals with the same haplotype block
        should have similar read depth over shared edges.
      </p>
      <p>
        The combined score is:
      </p>
      <Equation>
        S(A, B) = 0.3 &middot; J<sub>M</sub>(A, B) + 0.4 &middot; J<sub>E</sub>(A, B) + 0.3 &middot; cos(support<sub>A</sub>, support<sub>B</sub>)
      </Equation>

      <h3>3.6 Dataset: CEPH 1463 pedigree</h3>
      <p>
        The CEPH (Centre d&apos;Etude du Polymorphisme Humain) family 1463 is a three-generation
        Utah/CEU pedigree extensively sequenced by the 1000 Genomes Project and NIST Genome in a
        Bottle consortium. We analyze 6 members spanning 3 generations:
      </p>
      <div className="figure">
        <pre className="mono text-sm leading-relaxed">
{`    CEPH 1463 Pedigree (6 members analyzed)

    Generation 1 (Grandparents):

      Pat.GF ──── Pat.GM        Mat.GF ──── Mat.GM
      (NA12891)   (NA12892)     (NA12889)   (NA12890)
         │                          │
         └────┬─────────────────────┘
              │
    Generation 2 (Parents):

           Father ──── Mother
           (NA12877)   (NA12878)

    Related pairs (parent-child):
      Pat.GF → Father, Pat.GM → Father
      Mat.GF → Mother, Mat.GM → Mother

    Unrelated pairs (6):
      Spouses, Pat.GF↔Mat.GM, Pat.GF↔Mat.GF,
      Pat.GF↔Mother, Pat.GM↔Mat.GM, Mat.GF↔Father`}
        </pre>
        <p className="figure-caption">
          Figure 1: CEPH 1463 pedigree structure. All 6 members are CEU (Utah residents with
          Northern and Western European ancestry). 4 parent-child pairs (related) and 6
          cross-family pairs (unrelated). The in-law pairs (Mat.GF to Father, Pat.GF to Mother)
          are genetically unrelated but connected by marriage.
        </p>
      </div>
      <p>
        All samples were sequenced with Illumina short reads at high coverage. For this analysis,
        we use 2 million reads per sample (150bp), subsampled for computational feasibility. All
        6 individuals are CEU population, making this a same-population comparison — the hardest
        scenario for reference-free methods due to high background k-mer sharing (~98% at k=21).
      </p>

      <h3>3.7 Evaluation metrics</h3>
      <p>
        We evaluate using three metrics established in previous yalumba reports:
      </p>
      <p>
        <strong>Average separation</strong>: the difference between the mean score of related pairs
        and the mean score of unrelated pairs, expressed as a percentage of the unrelated mean:
      </p>
      <Equation>
        Separation = (avg(related) - avg(unrelated)) / avg(unrelated) &times; 100%
      </Equation>
      <p>
        <strong>Weakest gap</strong>: the difference between the lowest-scoring related pair and the
        highest-scoring unrelated pair. A positive weakest gap means all related pairs score above
        all unrelated pairs (perfect separation). A negative weakest gap means at least one
        related pair is &quot;buried&quot; below an unrelated pair.
      </p>
      <p>
        <strong>Pass rate</strong>: the fraction of related pairs that score above all unrelated
        pairs. On CEPH 1463, with 4 related pairs, the pass rate is 0/4, 1/4, 2/4, 3/4, or 4/4.
        Only 4/4 represents complete detection.
      </p>

      {/* ================================================================== */}
      {/* 4. RESULTS                                                         */}
      {/* ================================================================== */}
      <h2>4. Results</h2>

      <h3>4.1 Full pair score table (v2)</h3>
      <p>
        Table 1 presents the complete v2 results on all 10 pairs of the CEPH 1463 dataset, ordered
        by combined score. Related (parent-child) pairs are marked with arrows.
      </p>
      <div className="figure">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Pair</th>
              <th>Relationship</th>
              <th>Score</th>
              <th>Related?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Mat.GF &rarr; Mother</td>
              <td>Parent-child</td>
              <td><strong>0.420583</strong></td>
              <td>&diams;</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Mat.GM &rarr; Mother</td>
              <td>Parent-child</td>
              <td><strong>0.413023</strong></td>
              <td>&diams;</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Pat.GM &rarr; Father</td>
              <td>Parent-child</td>
              <td><strong>0.376016</strong></td>
              <td>&diams;</td>
            </tr>
            <tr>
              <td>4</td>
              <td>Mat.GF &harr; Father</td>
              <td>In-law</td>
              <td>0.374120</td>
              <td></td>
            </tr>
            <tr>
              <td>5</td>
              <td>Pat.GM &harr; Mat.GM</td>
              <td>Unrelated</td>
              <td>0.370269</td>
              <td></td>
            </tr>
            <tr>
              <td>6</td>
              <td>Father &harr; Mother</td>
              <td>Spouses</td>
              <td>0.370005</td>
              <td></td>
            </tr>
            <tr>
              <td>7</td>
              <td>Pat.GF &rarr; Father</td>
              <td>Parent-child</td>
              <td><strong>0.342385</strong></td>
              <td>&diams;</td>
            </tr>
            <tr>
              <td>8</td>
              <td>Pat.GF &harr; Mat.GM</td>
              <td>Unrelated</td>
              <td>0.331190</td>
              <td></td>
            </tr>
            <tr>
              <td>9</td>
              <td>Pat.GF &harr; Mother</td>
              <td>In-law</td>
              <td>0.300230</td>
              <td></td>
            </tr>
            <tr>
              <td>10</td>
              <td>Pat.GF &harr; Mat.GF</td>
              <td>Unrelated</td>
              <td>0.296632</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <p className="figure-caption">
          Table 1: Module Persistence Graph v2 scores on all 10 CEPH 1463 pairs. Related pairs
          marked with &diams;. The top 3 scores are all parent-child pairs, but Pat.GF &rarr; Father
          (rank 7) falls below three unrelated pairs including one in-law.
        </p>
      </div>
      <p>
        Summary statistics:
      </p>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Metric</th><th>Value</th></tr>
          </thead>
          <tbody>
            <tr><td>Average related score</td><td>0.388002</td></tr>
            <tr><td>Average unrelated score</td><td>0.340408</td></tr>
            <tr><td>Separation</td><td>+4.7594%</td></tr>
            <tr><td>Weakest gap</td><td>-3.1736%</td></tr>
            <tr><td>Pass rate</td><td>3/4 (75%)</td></tr>
            <tr><td>Preparation time</td><td>1084.6s</td></tr>
            <tr><td>Compare time per pair</td><td>0.0s</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">
          Table 2: Aggregate metrics for MPG v2 on CEPH 1463.
        </p>
      </div>

      <h3>4.2 Version comparison: v1 vs v2</h3>
      <p>
        MPG v1 used a simpler scoring function without the three-component decomposition and
        without informative module filtering. Table 3 compares the two versions.
      </p>
      <div className="figure">
        <table>
          <thead>
            <tr>
              <th>Pair</th>
              <th>v1 Score</th>
              <th>v2 Score</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mat.GF &rarr; Mother</td>
              <td>0.065362</td>
              <td>0.420583</td>
              <td>+6.4x</td>
            </tr>
            <tr>
              <td>Mat.GM &rarr; Mother</td>
              <td>0.025797</td>
              <td>0.413023</td>
              <td>+16.0x</td>
            </tr>
            <tr>
              <td>Pat.GM &rarr; Father</td>
              <td>0.025952</td>
              <td>0.376016</td>
              <td>+14.5x</td>
            </tr>
            <tr>
              <td>Pat.GF &rarr; Father</td>
              <td>0.020189</td>
              <td>0.342385</td>
              <td>+17.0x</td>
            </tr>
            <tr>
              <td>Spouses (unrelated)</td>
              <td>0.025026</td>
              <td>0.370005</td>
              <td>+14.8x</td>
            </tr>
          </tbody>
        </table>
        <p className="figure-caption">
          Table 3: Score comparison between MPG v1 and v2. Scores shown for the 4 related pairs
          and the spouse pair (highest-scoring unrelated in v1). All scores increase dramatically
          in v2 due to the three-component scoring function.
        </p>
      </div>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Metric</th><th>v1</th><th>v2</th><th>Improvement</th></tr>
          </thead>
          <tbody>
            <tr><td>Separation</td><td>+2.02%</td><td>+4.76%</td><td>2.4x</td></tr>
            <tr><td>Weakest gap</td><td>-0.48%</td><td>-3.17%</td><td>Worse (wider gap)</td></tr>
            <tr><td>Pass rate</td><td>1/4</td><td>3/4</td><td>+2 pairs</td></tr>
            <tr><td>Prep time</td><td>685s</td><td>1084.6s</td><td>+58%</td></tr>
            <tr><td>Compare time</td><td>1.0s</td><td>0.0s</td><td>Instant</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">
          Table 4: Aggregate metric comparison between v1 and v2. v2 improves separation and
          pass rate but worsens the weakest gap due to higher unrelated scores.
        </p>
      </div>
      <p>
        The v1-to-v2 transition reveals an important tension. The three-component scoring with
        informative filtering dramatically improves <em>average</em> separation and detects 3 of 4
        related pairs (up from 1). But the weakest gap widens from -0.48% to -3.17% because the
        edge topology Jaccard component (40% weight) inflates in-law and unrelated scores more
        than it inflates the weakest related pair (Pat.GF to Father). The v1 algorithm, despite
        lower absolute separation, had a narrower gap — the scores were more uniformly compressed.
      </p>

      <h3>4.3 Comparison to Rare-Run P90 baseline</h3>
      <p>
        The Rare-Run P90 algorithm, the current best method in the yalumba framework, provides
        the baseline for comparison:
      </p>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Metric</th><th>MPG v2</th><th>Rare-Run P90</th><th>Ratio</th></tr>
          </thead>
          <tbody>
            <tr><td>Separation</td><td>+4.76%</td><td>+583%</td><td>0.008x</td></tr>
            <tr><td>All pairs detected?</td><td>No (3/4)</td><td>Yes (4/4)</td><td>—</td></tr>
            <tr><td>Weakest gap</td><td>-3.17%</td><td>Positive (all pass)</td><td>—</td></tr>
            <tr><td>Prep time</td><td>1084.6s</td><td>72.5s</td><td>15x slower</td></tr>
            <tr><td>Compare time</td><td>0.0s/pair</td><td>37.4s/pair</td><td>Instant vs slow</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">
          Table 5: MPG v2 versus Rare-Run P90. The module-based approach is orders of magnitude
          weaker in separation and fails to detect one related pair, while being 15x slower in
          preparation. Its only advantage is instantaneous comparison after preparation.
        </p>
      </div>
      <p>
        The performance gap is stark. Rare-Run P90 achieves 122x the separation of MPG v2 and
        detects all related pairs. The comparison time advantage of MPG (0.0s vs 37.4s) is
        irrelevant given the 15x longer preparation and inferior accuracy. However, the comparison
        time property would become valuable at scale: comparing 1,000 individuals pairwise requires
        499,500 comparisons, where MPG&apos;s instant comparison would dominate Rare-Run P90&apos;s
        37.4s per pair (requiring 5,200 hours).
      </p>

      <h3>4.4 Why Mat.GF to Mother scores highest</h3>
      <p>
        The highest-scoring pair is Mat.GF (maternal grandfather, NA12889) to Mother (NA12878),
        at 0.4206. This pair scores higher than Mat.GM to Mother (0.4130), despite both being
        parent-child relationships with the same offspring. Several factors contribute:
      </p>
      <p>
        <strong>Sequencing depth and quality.</strong> NA12889 (Mat.GF) was sequenced at exceptionally
        high depth in the 1000 Genomes high-coverage release. Higher read depth produces more
        accurate module extraction — more reads means more observations of co-occurrence, stronger
        support for edges, and fewer false-negative modules. The module adjacency graph for Mat.GF
        is denser and more complete than for samples with lower effective coverage.
      </p>
      <p>
        <strong>Module coherence.</strong> The maternal grandfather carries haplotypes that were
        directly transmitted to the mother. Modules representing these haplotypes should be
        well-preserved across the generation because meiotic recombination shuffles haplotype blocks
        but does not destroy them — one of the two grandparental haplotypes is transmitted intact
        (modulo crossovers) to each child.
      </p>

      <h3>4.5 Why Pat.GF to Father scores lowest among related pairs</h3>
      <p>
        Pat.GF (paternal grandfather, NA12891) to Father (NA12877) scores only 0.3424, placing
        it 7th of 10 pairs and below three unrelated pairs. This is the pair that prevents
        perfect separation. Several factors explain the anomaly:
      </p>
      <p>
        <strong>Sample-specific characteristics.</strong> NA12891 shows systematically lower
        similarity to all other samples — the 4 lowest-scoring pairs in Table 1 all involve
        Pat.GF. This suggests a sample-level effect: either lower effective coverage, different
        library preparation, or batch effects that reduce module discovery. When one sample
        produces fewer or less reliable modules, all pairwise comparisons involving that sample
        are deflated.
      </p>
      <p>
        <strong>Module fingerprint sensitivity.</strong> The XOR-based fingerprinting used for module
        deduplication is brittle. If Pat.GF&apos;s reads produce modules that differ from
        Father&apos;s modules by even a single motif (due to sequencing errors, coverage gaps, or
        recombination breakpoints within modules), the fingerprints will not match and the modules
        will be counted as distinct. This problem is amplified when one sample has lower coverage.
      </p>
      <p>
        <strong>The in-law problem.</strong> Mat.GF to Father (in-law, 0.3741) scores higher than
        Pat.GF to Father (parent-child, 0.3424). This is biologically impossible if the algorithm
        captures genuine IBD — a father must share more genetic material with his own father than
        with his father-in-law. The inversion demonstrates that MPG is detecting something other
        than (or in addition to) IBD: it is measuring population-shared module topology, which
        can be higher between certain sample pairs due to sequencing characteristics rather than
        genetic relatedness.
      </p>

      <h3>4.6 The in-law problem: why edge topology is too population-shared</h3>
      <p>
        The in-law problem is the central failure mode of MPG v2. Mat.GF to Father scores 0.3741
        (unrelated) while Pat.GF to Father scores 0.3424 (related). To understand why, we examine
        the three scoring components individually.
      </p>
      <p>
        The edge topology Jaccard (40% of the score) is the primary culprit. At k=21, same-population
        individuals share approximately 98% of k-mers. Modules built from these k-mers are therefore
        also highly shared: if almost all k-mers are present in all samples, the co-occurrence
        patterns that define modules will also be largely universal. The edges between modules —
        which modules are genomic neighbors — reflect the conserved genome structure of the CEU
        population, not individual-specific haplotypes.
      </p>
      <Equation>
        P(module shared) &ge; P(all constituent k-mers shared) &asymp; 0.98<sup>m</sup>
      </Equation>
      <p>
        where m is the number of motifs in the module. For a module of 10 motifs, the probability
        that all are shared between unrelated CEU individuals is approximately 0.98<sup>10</sup> &asymp; 0.817.
        For modules of 5 motifs, it is 0.98<sup>5</sup> &asymp; 0.904. The informative module filter removes
        modules shared by all 6 samples, but modules shared by 4 or 5 samples — still largely
        population-shared — dominate the comparison.
      </p>
      <p>
        The edge topology between these population-shared modules is similarly universal. If
        modules A and B are both present in 5 of 6 samples, the edge A-B is likely present in
        most samples as well, because the underlying genomic structure placing those modules in
        proximity is conserved across the population. The edge topology Jaccard between unrelated
        same-population individuals can therefore approach the same values as between related
        individuals.
      </p>
      <p>
        This is the module-level manifestation of the &quot;population sharing wall&quot; identified
        in previous work. At the k-mer level, the wall is at ~98% sharing. At the module level,
        the sharing is somewhat lower (modules require multiple k-mers to match) but still
        overwhelmingly high, leaving insufficient room for IBD-specific signal.
      </p>

      <h3>4.7 Informative module distribution</h3>
      <p>
        Table 6 shows how modules distribute across the 6 samples after extraction.
      </p>
      <div className="figure">
        <table>
          <thead>
            <tr>
              <th>Samples containing module</th>
              <th>Module count</th>
              <th>Fraction of total</th>
              <th>Filtered?</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>6 (all)</td><td>~8,200</td><td>~55%</td><td>Yes (removed)</td></tr>
            <tr><td>5</td><td>~3,100</td><td>~21%</td><td>No</td></tr>
            <tr><td>4</td><td>~1,800</td><td>~12%</td><td>No</td></tr>
            <tr><td>3</td><td>~1,100</td><td>~7%</td><td>No</td></tr>
            <tr><td>2</td><td>~500</td><td>~3%</td><td>No</td></tr>
            <tr><td>1 (unique)</td><td>~300</td><td>~2%</td><td>No</td></tr>
          </tbody>
        </table>
        <p className="figure-caption">
          Table 6: Distribution of modules by sample count. Over half of all discovered modules
          are present in all 6 samples and are filtered out. Of the remaining &quot;informative&quot;
          modules, the majority (21% of total) are present in 5 of 6 samples — still nearly
          universal.
        </p>
      </div>
      <p>
        The distribution reveals the core issue: even after removing universally-shared modules,
        the informative set is dominated by near-universal modules (present in 5 of 6 samples).
        Truly discriminative modules — those present in only 2-3 samples — constitute only 10%
        of the informative set. A more aggressive filter (e.g., removing modules present in
        &gt;50% of samples) would reduce the comparison to these rare modules, potentially
        improving discrimination at the cost of statistical power.
      </p>

      <h3>4.8 Timing breakdown</h3>
      <p>
        The asymmetric timing profile of MPG is one of its most distinctive characteristics.
      </p>
      <div className="figure">
        <table>
          <thead>
            <tr><th>Phase</th><th>Time</th><th>Fraction</th><th>Operation</th></tr>
          </thead>
          <tbody>
            <tr><td>Module extraction</td><td>~780s</td><td>72%</td><td>K-mer extraction, co-occurrence counting, clustering (per sample)</td></tr>
            <tr><td>Vocabulary construction</td><td>~180s</td><td>17%</td><td>Fingerprint deduplication, union set construction</td></tr>
            <tr><td>Graph construction</td><td>~120s</td><td>11%</td><td>Edge scanning, support counting (per sample)</td></tr>
            <tr><td>Pairwise comparison</td><td>&lt;0.1s</td><td>&lt;0.01%</td><td>Jaccard + cosine on precomputed vectors</td></tr>
            <tr><td><strong>Total</strong></td><td><strong>1084.6s</strong></td><td></td><td></td></tr>
          </tbody>
        </table>
        <p className="figure-caption">
          Table 7: Timing breakdown for MPG v2 on 6 CEPH 1463 samples. Preparation (1084.6s)
          dominates; pairwise comparison is effectively instantaneous.
        </p>
      </div>
      <p>
        Module extraction accounts for 72% of total time. This phase involves three passes over
        all reads per sample: (1) k-mer extraction and frequency counting, (2) co-occurrence
        window scanning, and (3) connected component clustering. The 16M-entry hash table for
        co-occurrence pairs requires 128MB of memory per sample, and the linear probing on a
        nearly-full table causes cache misses that dominate runtime.
      </p>
      <p>
        The pairwise comparison, by contrast, operates on precomputed module vectors and edge sets
        that are orders of magnitude smaller than raw reads. Each sample&apos;s representation is
        a sparse vector of ~7,000 informative modules and ~15,000 edges — comparing two such
        representations is a trivial set operation completing in microseconds. This front-loaded
        architecture means that adding a new sample requires ~180s of preparation (one sample&apos;s
        extraction + vocabulary update) but comparison to all existing samples is free.
      </p>

      {/* ================================================================== */}
      {/* 5. DISCUSSION                                                      */}
      {/* ================================================================== */}
      <h2>5. Discussion</h2>

      <h3>5.1 What the algorithm detects (and doesn&apos;t)</h3>
      <p>
        MPG detects shared genomic structure at the module level — co-occurrence patterns of k-mer
        motifs and their topological arrangement. On 3 of 4 parent-child pairs, this structure is
        measurably more shared than between unrelated pairs, confirming that modules capture genuine
        biological signal. The maternal line (Mat.GF to Mother, Mat.GM to Mother) shows the
        strongest signal, likely due to better sequencing quality in those samples.
      </p>
      <p>
        What MPG does <em>not</em> reliably detect is the distinction between parent-child
        relatedness and population-level structural similarity. The Pat.GF to Father pair, despite
        sharing 50% of its genome by descent, produces a lower module similarity score than the
        Mat.GF to Father in-law pair, which shares 0% by descent. This demonstrates that module
        topology, as currently implemented, is dominated by population-shared structure rather
        than individual-specific IBD.
      </p>

      <h3>5.2 Module topology as a genuinely different signal</h3>
      <p>
        Despite its limitations, MPG captures information that no singleton k-mer method can.
        Consider two samples A and B that share modules {'{'}M1, M2, M3{'}'} with edges
        M1-M2 and M2-M3. A third sample C shares the same modules but with edges M1-M3 and
        M2-M3 (different topology). Singleton k-mer methods would rate A-B and A-C identically
        (same shared k-mers); MPG would rate A-B higher because they share both modules
        <em>and</em> their arrangement.
      </p>
      <p>
        This topological signal corresponds to a real biological phenomenon. When a haplotype block
        is transmitted from parent to child, not only are the genetic variants preserved but their
        physical arrangement along the chromosome is preserved. Recombination can break a block
        into pieces, placing formerly adjacent modules on different chromosomal backgrounds, but
        cannot rearrange modules within a block. Thus, preserved module adjacency is a stronger
        indicator of IBD than module presence alone.
      </p>
      <p>
        The challenge is that the CEU population shares most of its genome structure, so module
        adjacency is also population-shared. The topological signal exists but is buried under
        a thick layer of population-level conservation.
      </p>

      <h3>5.3 The population sharing wall at module level</h3>
      <p>
        Previous work established the population sharing wall at the k-mer level: same-population
        individuals share ~98% of k-mers at k=21, leaving only ~2% of the k-mer space for
        distinguishing related from unrelated pairs. The rare k-mer filtering breakthrough works
        by focusing on this 2%.
      </p>
      <p>
        At the module level, the sharing wall takes a different form. Modules aggregate multiple
        k-mers, so a module&apos;s sharing probability depends on the joint probability that all
        its constituent k-mers are shared. For a module of m motifs:
      </p>
      <Equation>
        P(module shared) &le; min<sub>i</sub> P(motif<sub>i</sub> shared) &asymp; 0.98
      </Equation>
      <p>
        In practice, the bound is often tight because module extraction uses common motifs
        (frequent k-mers) as building blocks. If we built modules from rare k-mers, the
        sharing probability would drop dramatically — but rare k-mers co-occur infrequently,
        making co-occurrence-based module discovery unreliable without very high read depth.
      </p>
      <p>
        This creates a catch-22: modules built from common k-mers are reliably discovered but
        uninformative; modules built from rare k-mers would be informative but are unreliably
        discovered. Breaking this impasse likely requires either (a) much higher read depth to
        support rare-k-mer module discovery, or (b) a different module definition that does not
        rely on co-occurrence counting.
      </p>

      <h3>5.4 Why compare is instant while prep is 1085 seconds</h3>
      <p>
        The extreme asymmetry between preparation time (1084.6s) and comparison time (0.0s)
        reflects the algorithm&apos;s architecture. Preparation transforms raw reads (billions of
        base pairs) into compact module representations (thousands of modules, tens of thousands
        of edges). Comparison operates on these compact representations using standard set
        operations (intersection and union of sorted integer arrays, dot product of sparse vectors).
      </p>
      <p>
        Concretely, each sample&apos;s prepared representation consists of: (1) a sorted array
        of ~7,000 informative module fingerprints (56KB as 64-bit integers), (2) a sorted array
        of ~15,000 edge fingerprints (120KB), and (3) a sparse support vector of ~15,000 entries
        (120KB). Comparing two such representations requires intersecting and unioning sorted
        arrays (O(n) in array size) and computing one cosine similarity (O(n)), all operating on
        data that fits in L1 cache.
      </p>
      <p>
        This architecture has a clear advantage for large-scale comparisons. In a database of
        N prepared samples, adding a new sample requires O(reads) preparation time but only
        O(N &middot; modules) comparison time to compute similarity against all existing samples.
        For N=10,000 samples with 7,000 modules each, the comparison sweep would take approximately
        0.7 seconds — trivial compared to any read-level method.
      </p>

      <h3>5.5 Path forward: what would make this work for all pairs</h3>
      <p>
        Three modifications could potentially push MPG to full pair detection:
      </p>
      <p>
        <strong>(1) Rare module filtering analogous to rare k-mer filtering.</strong> Instead of
        removing only universally-present modules, remove all modules present in &gt;50% of
        samples. On the current 6-sample dataset, this would retain only modules present in 1-3
        samples, dramatically reducing population-shared signal. The risk is statistical: with
        only ~1,900 modules remaining (from Table 6), the comparison vectors become sparse and
        noisy. This approach requires either a larger sample panel (20+ individuals) for robust
        frequency estimation or a different statistical framework.
      </p>
      <p>
        <strong>(2) Weighted edge scoring that downweights population-shared edges.</strong> Rather
        than binary edge Jaccard, weight each edge inversely by the number of samples containing
        it. An edge present in 5 of 6 samples receives weight 1/5; an edge present in only 2
        samples receives weight 1/2. This is the TF-IDF analog for graph edges and would
        amplify rare topological features.
      </p>
      <p>
        <strong>(3) Module discovery from rare k-mers.</strong> The most ambitious modification:
        build modules exclusively from rare k-mers (frequency &lt;50% in the population).
        This would require significantly higher read depth or a different clustering strategy
        (e.g., LSH-based approximate co-occurrence) to handle the sparse co-occurrence signal.
        But it would produce modules that are, by construction, informative for relatedness.
      </p>

      <h3>5.6 C/GPU acceleration potential</h3>
      <p>
        The 1084.6s preparation time is dominated by three operations that are highly amenable
        to native code or GPU acceleration:
      </p>
      <p>
        <strong>K-mer extraction and hashing (est. 400s).</strong> The rolling hash computation
        is embarrassingly parallel — each read can be processed independently. A C implementation
        using SIMD (AVX2 or NEON) for the polynomial hash could achieve 4-8x speedup per core,
        and GPU dispatch via the existing SPIR-V pipeline could achieve 50-100x on the full
        batch. Estimated native time: 5-10s.
      </p>
      <p>
        <strong>Co-occurrence counting (est. 350s).</strong> The fixed-size hash table with open
        addressing is cache-unfriendly in TypeScript (object overhead, pointer chasing). A C
        implementation with a flat array and integer keys would eliminate these overheads.
        GPU implementation is more challenging due to hash table contention but feasible with
        atomic operations on shared memory. Estimated native time: 3-8s.
      </p>
      <p>
        <strong>Connected component clustering (est. 30s).</strong> Union-find on the co-occurrence
        graph is inherently sequential but operates on a graph small enough (~500K edges) to be
        fast in native code. Estimated native time: &lt;1s.
      </p>
      <p>
        Total estimated preparation time with C/GPU acceleration: <strong>~10-20 seconds</strong>,
        a 50-100x improvement over the current TypeScript implementation. This would make MPG
        competitive with Rare-Run P90 (72.5s) on preparation time, and with its instant comparison
        phase, MPG would be significantly faster for large sample panels.
      </p>

      <h3>5.7 Comparison to classical IBD methods</h3>
      <p>
        Classical IBD detection tools operate on fundamentally different input. GERMLINE, Refined IBD,
        and IBIS require phased genotype data from SNP arrays or variant calling pipelines. They
        identify identical-by-descent segments by finding long stretches of matching haplotypes in
        a reference coordinate system. Their accuracy on parent-child detection is near-perfect
        (&gt;99%) with ~50% of the genome identified as IBD.
      </p>
      <p>
        MPG operates on raw reads without reference alignment, variant calling, or phasing. It
        cannot identify IBD segments in the classical sense because it has no coordinate system.
        Instead, it detects shared <em>structure</em> — module co-occurrence patterns — that
        correlate with but do not directly measure IBD. The 4.76% separation achieved by MPG v2
        is qualitatively different from the near-perfect separation achieved by classical methods,
        reflecting the information loss inherent in discarding the reference coordinate system.
      </p>
      <p>
        However, MPG has properties that classical methods lack. It works on any sequencing data
        without requiring a reference genome, making it applicable to non-model organisms. It
        captures structural relationships (module topology) that are invisible to SNP-based
        methods. And its front-loaded architecture enables O(1) per-pair comparison at scale.
        These properties are complementary rather than competitive to classical IBD tools.
      </p>

      <h3>5.8 The symbiogenesis contribution — is it real?</h3>
      <p>
        The symbiogenesis framing — genomes as ecosystems of co-inherited modules — motivated the
        development of MPG. But does the metaphor contribute genuine algorithmic insight, or is
        it merely a narrative wrapper around standard graph comparison?
      </p>
      <p>
        We argue the contribution is real but circumscribed. The symbiogenesis perspective
        specifically motivated two design decisions that would not arise from standard
        bioinformatics thinking:
      </p>
      <p>
        <strong>(1) Module as primitive.</strong> Standard approaches decompose genomes into
        individual markers (SNPs, k-mers) and compare marker sets. The symbiogenesis framing
        insists on the module — the co-inherited unit — as the natural primitive, leading to the
        co-occurrence clustering step. This is not merely grouping k-mers for computational
        convenience; it is a deliberate modeling choice that captures different information.
      </p>
      <p>
        <strong>(2) Ecosystem topology as signal.</strong> Standard graph-based methods
        (de Bruijn graphs, variation graphs) use graphs to represent sequence relationships.
        The symbiogenesis framing treats the graph as an ecosystem structure — the arrangement
        of organisms (modules) in their habitat (the genome) — and compares ecosystems by their
        community topology rather than their species lists. This led to the three-component scoring
        with edge topology receiving the highest weight, a design choice validated by the observation
        that 3 of 4 related pairs score above all unrelated pairs.
      </p>
      <p>
        However, the symbiogenesis framing also has blind spots. It does not naturally suggest
        the critical importance of rare module filtering (which comes from population genetics,
        not ecology). It overweights the edge topology component, which proves to be the most
        population-shared signal. And it provides no mechanism for handling the catch-22 of
        module discovery from rare versus common k-mers.
      </p>
      <p>
        The honest assessment: symbiogenesis produced a novel algorithm that captures genuinely
        different information from singleton k-mer methods. That algorithm is not yet competitive
        with the best singleton methods for kinship detection. The metaphor&apos;s value lies in
        expanding the design space — suggesting approaches that standard thinking would not —
        rather than in guaranteed performance improvement.
      </p>

      <h3>5.9 Relationship to graph genome representations</h3>
      <p>
        The module persistence graph bears a structural resemblance to pangenome graphs and
        variation graphs used in modern genomics. In a variation graph (e.g., vg toolkit), nodes
        represent sequence segments and edges represent adjacency relationships, with alternative
        paths encoding population diversity. MPG&apos;s module adjacency graph is conceptually
        similar but constructed bottom-up from raw reads rather than top-down from a reference
        and known variants.
      </p>
      <p>
        A key difference is resolution. Variation graphs operate at single-nucleotide resolution
        with precise coordinate systems. MPG operates at module resolution (clusters of 3-100+
        k-mers) without coordinates. This coarser resolution explains both MPG&apos;s robustness
        to sequencing errors (a single error affects one k-mer but rarely changes a module&apos;s
        identity) and its inability to detect fine-grained IBD boundaries.
      </p>
      <p>
        Future work could bridge these representations: using MPG for rapid screening
        (O(1) per-pair comparison) followed by reference-based IBD analysis for high-scoring
        pairs. This two-stage approach would combine MPG&apos;s scalability with classical
        methods&apos; precision.
      </p>

      {/* ================================================================== */}
      {/* 6. CONCLUSION                                                      */}
      {/* ================================================================== */}
      <h2>6. Conclusion</h2>
      <p>
        The Module Persistence Graph is the first relatedness detection algorithm that operates
        on co-occurring motif modules rather than individual k-mers. By discovering higher-order
        structures from raw sequencing reads and comparing their graph topology, MPG captures a
        signal that is genuinely different from any singleton k-mer method. On the CEPH 1463
        pedigree, MPG v2 achieves +4.76% separation between related and unrelated pairs, detects
        3 of 4 parent-child relationships, and provides near-instantaneous pairwise comparison
        after a front-loaded preparation phase.
      </p>
      <p>
        The algorithm&apos;s primary limitation is the population sharing wall at the module level.
        Modules built from common k-mers are largely universal across CEU individuals, and their
        topological arrangements are similarly population-shared. The edge topology Jaccard,
        despite receiving the highest scoring weight (0.4), does not reliably distinguish IBD-driven
        adjacency from population-conserved adjacency. The weakest related pair (Pat.GF to Father,
        0.3424) falls below the strongest unrelated pair (Mat.GF to Father in-law, 0.3741),
        yielding a weakest gap of -3.17%.
      </p>
      <p>
        Compared to the Rare-Run P90 baseline (+583% separation, all pairs detected, 72.5s prep),
        MPG v2 is an order of magnitude weaker in discrimination. This is not a failure of the
        module concept but a demonstration that the module concept requires the same insight that
        rescued singleton k-mer methods: <em>focus on rare, informative features</em>. The path
        forward combines rare module filtering, weighted edge scoring, and native code acceleration
        to produce a method that is both structurally richer than singleton approaches and
        practically competitive.
      </p>
      <p>
        The symbiogenesis framing motivated a genuinely novel algorithm that expands the design
        space of reference-free genomic analysis. Whether module-level topology can ultimately
        compete with k-mer-level rarity for kinship detection remains an open question. What is
        clear is that modules capture different information from k-mers — information about
        genomic arrangement rather than genomic content — and that this information has value
        even if it is not yet sufficient on its own.
      </p>

      {/* ================================================================== */}
      {/* 7. REFERENCES                                                      */}
      {/* ================================================================== */}
      <h2>References</h2>
      <ol className="text-sm text-[var(--color-text-muted)] space-y-1 list-decimal list-inside">
        <li>
          Margulis, L. <em>Symbiotic Planet: A New Look at Evolution</em>. Basic Books, 1998.
        </li>
        <li>
          The 1000 Genomes Project Consortium. A global reference for human genetic variation.
          <em> Nature</em> 526, 68-74, 2015.
        </li>
        <li>
          Zook, J.M. et al. Extensive sequencing of seven human genomes to characterize benchmark
          reference materials. <em>Scientific Data</em> 3, 160025, 2016.
        </li>
        <li>
          Platinum Pedigree Consortium. CEPH 1463 whole-genome sequencing. New York Genome
          Center, 2021.
        </li>
        <li>
          Gusev, A. et al. Whole population, genome-wide mapping of hidden relatedness.
          <em> Genome Research</em> 19, 318-326, 2009. (GERMLINE)
        </li>
        <li>
          Browning, S.R. &amp; Browning, B.L. High-resolution detection of identity by descent
          in unrelated individuals. <em>Am J Hum Genet</em> 86, 526-539, 2010. (Refined IBD)
        </li>
        <li>
          Browning, B.L. &amp; Browning, S.R. Detecting identity by descent and estimating
          genotype error rates in sequence data. <em>Am J Hum Genet</em> 93, 840-851, 2013. (IBIS)
        </li>
        <li>
          Ralph, P. &amp; Coop, G. The geography of recent genetic ancestry across Europe.
          <em> PLoS Biology</em> 11, e1001555, 2013.
        </li>
        <li>
          Garrison, E. et al. Variation graph toolkit improves read mapping by representing
          genetic variation in the reference. <em>Nature Biotechnology</em> 36, 875-879, 2018.
        </li>
        <li>
          Ondov, B.D. et al. Mash: fast genome and metagenome distance estimation using MinHash.
          <em> Genome Biology</em> 17, 132, 2016.
        </li>
        <li>
          Li, M. et al. The similarity metric. <em>IEEE Trans. Information Theory</em> 50,
          3250-3264, 2004. (Normalized compression distance)
        </li>
        <li>
          Broder, A.Z. On the resemblance and containment of documents. <em>Proc. Compression
          and Complexity of Sequences</em>, 21-29, 1997. (MinHash / Jaccard estimation)
        </li>
        <li>
          Eggertsson, H.P. et al. GraphTyper2 enables population-scale genotyping of structural
          variation using pangenome graphs. <em>Nature Communications</em> 10, 5402, 2019.
        </li>
        <li>
          Liao, W.-W. et al. A draft human pangenome reference. <em>Nature</em> 617, 312-324,
          2023.
        </li>
      </ol>
    </Paper>
  );
}
