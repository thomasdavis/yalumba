% yalumba.cls — Custom document class for yalumba research papers
% Modern, spacious, branded design inspired by Nature Briefing / Stripe
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{yalumba}[2026/04/10 yalumba research paper class v2]

\LoadClass[11pt,a4paper]{article}

% ── Core packages ──
\RequirePackage[left=1.2in,right=1.0in,top=1.4in,bottom=1.2in,
                marginparwidth=0.85in,marginparsep=0.15in]{geometry}
\RequirePackage[table]{xcolor}
\RequirePackage{tikz}
\RequirePackage{booktabs}
\RequirePackage{colortbl}
\RequirePackage{tabularx}
\RequirePackage{listings}
\RequirePackage{amsmath,amssymb}
\RequirePackage{hyperref}
\RequirePackage{fancyhdr}
\RequirePackage{titlesec}
\RequirePackage{tcolorbox}
\RequirePackage{enumitem}
\RequirePackage{caption}
\RequirePackage{microtype}
\RequirePackage{etoolbox}
\RequirePackage{multicol}
\RequirePackage{parskip}
\RequirePackage{graphicx}
\RequirePackage{lastpage}
\RequirePackage{marginnote}
\RequirePackage{setspace}
\RequirePackage{float}
\RequirePackage{calc}

\tcbuselibrary{skins,breakable}
\usetikzlibrary{calc,positioning,decorations.pathmorphing,backgrounds}

% ── Line spacing ──
\setstretch{1.3}

% ── Colors (Yalumba wine palette — from Winesmiths Shiraz packaging) ──
% Primary: deep wine burgundy
\definecolor{yalumba-wine}{HTML}{6B1D2A}
% Accent: champagne gold
\definecolor{yalumba-gold}{HTML}{C4A35A}
% Warm cream (paper/label tone)
\definecolor{yalumba-cream}{HTML}{F5F0E8}
% Charcoal (body text emphasis)
\definecolor{yalumba-charcoal}{HTML}{2D2D2D}
% Slate gray (secondary text)
\definecolor{yalumba-slate}{HTML}{5A5A5A}
% Rich black (deep accents)
\definecolor{yalumba-black}{HTML}{1A1A1A}
% Lighter burgundy for tints
\definecolor{yalumba-rose}{HTML}{8B3A4A}
% Warm paper white
\definecolor{yalumba-paper}{HTML}{FDFBF7}

% Semantic aliases (used throughout the class)
\definecolor{accent}{HTML}{6B1D2A}        % wine — primary accent
\definecolor{accent-light}{HTML}{8B3A4A}  % rose — lighter accent
\definecolor{accent-gold}{HTML}{C4A35A}   % gold — secondary accent
\definecolor{bg-dark}{HTML}{1A1A1A}
\definecolor{surface}{HTML}{2D2D2D}
\definecolor{surface-2}{HTML}{3D3D3D}
\definecolor{text-muted}{HTML}{5A5A5A}
\definecolor{table-alt}{HTML}{F5F0E8}     % cream alternating rows
\definecolor{table-header}{HTML}{2D2D2D}  % charcoal header
\definecolor{code-bg}{HTML}{2D2D2D}       % charcoal code blocks
\definecolor{pullquote-bg}{HTML}{FDFBF7}  % warm paper
\definecolor{keyfinding-bg}{HTML}{F5F0E8} % cream
\definecolor{limitation-bg}{HTML}{FDF2F2} % very light rose
\definecolor{definition-bg}{HTML}{F5F0E8} % cream

% Legacy aliases for compatibility
\colorlet{yalumba-cyan}{yalumba-wine}
\colorlet{yalumba-violet}{yalumba-gold}

% DNA base colors (used in \dnaseq command — kept as subtle grays for print)
\definecolor{dna-A}{HTML}{4A4A4A}
\definecolor{dna-C}{HTML}{5A5A5A}
\definecolor{dna-G}{HTML}{6A6A6A}
\definecolor{dna-T}{HTML}{7A7A7A}

% ── Hyperref setup (understated — dark links, not colorful) ──
\hypersetup{
  colorlinks=true,
  linkcolor=yalumba-charcoal,
  citecolor=yalumba-slate,
  urlcolor=yalumba-slate,
  pdfborder={0 0 0},
}

% ── Section color cycling (wine palette tones) ──
\newcounter{sectioncoloridx}
\setcounter{sectioncoloridx}{0}

\newcommand{\getsectioncolor}{%
  \ifcase\value{sectioncoloridx}%
    yalumba-wine%   0 -> deep burgundy
  \or
    yalumba-gold%   1 -> champagne gold
  \or
    yalumba-rose%   2 -> lighter burgundy
  \or
    yalumba-slate%  3 -> warm slate
  \fi
}

\newcommand{\advancesectioncolor}{%
  \stepcounter{sectioncoloridx}%
  \ifnum\value{sectioncoloridx}>3
    \setcounter{sectioncoloridx}{0}%
  \fi
}

% ── Page header/footer ──
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Thin colored line at top of page
\fancyhead[C]{%
  \begin{tikzpicture}[remember picture,overlay]
    \draw[yalumba-wine,line width=1pt]
      ([yshift=-0.5cm]current page.north west)
      -- ([yshift=-0.5cm]current page.north east);
  \end{tikzpicture}%
}
\fancyhead[L]{\small\color{yalumba-charcoal}\textsf{\textbf{yalumba}}}
\fancyhead[R]{\small\color{text-muted}\textsf{\nouppercase{\leftmark}}}
\fancyfoot[C]{\small\color{text-muted}\textsf{Page \thepage\ of \pageref{LastPage}}}

% Apply to plain style too (first page of sections)
\fancypagestyle{plain}{%
  \fancyhf{}%
  \renewcommand{\headrulewidth}{0pt}%
  \fancyfoot[C]{\small\color{text-muted}\textsf{Page \thepage\ of \pageref{LastPage}}}%
}

% ── Section formatting with cycling colors ──
\titleformat{\section}
  {\Large\sffamily\bfseries}
  {\thesection}{1em}
  {}
  [\advancesectioncolor\vspace{-0.5em}{\color{\getsectioncolor}\rule{4cm}{2.5pt}}]

\titleformat{\subsection}
  {\large\sffamily\bfseries}
  {\thesubsection}{0.8em}{}

\titleformat{\subsubsection}
  {\normalsize\sffamily\bfseries\itshape}
  {\thesubsubsection}{0.6em}{}

\titlespacing*{\section}{0pt}{2em}{1em}
\titlespacing*{\subsection}{0pt}{1.5em}{0.6em}
\titlespacing*{\subsubsection}{0pt}{1em}{0.4em}

% ── Title page ──
\newcommand{\reportslug}[1]{\def\@reportslug{#1}}
\reportslug{report}

% Store abstract
\newcommand{\@abstract}{}
\newcommand{\setabstract}[1]{\long\def\@abstract{#1}}

\renewcommand{\maketitle}{%
  \thispagestyle{empty}
  \begin{tikzpicture}[remember picture,overlay]
    % ── Subtle accent line at top (single thin wine rule) ──
    \fill[yalumba-wine] (current page.north west)
      rectangle ([yshift=-3pt]current page.north east);
    %
    % ── DNA watermark along left edge ──
    \node[rotate=90,anchor=south,opacity=0.06,
          font=\ttfamily\fontsize{7}{8}\selectfont,
          text=yalumba-cyan,inner sep=0pt]
      at ([xshift=12pt,yshift=-14cm]current page.north west)
      {ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG%
       ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG%
       ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG};
    \node[rotate=90,anchor=south,opacity=0.04,
          font=\ttfamily\fontsize{7}{8}\selectfont,
          text=yalumba-violet,inner sep=0pt]
      at ([xshift=22pt,yshift=-14cm]current page.north west)
      {GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAG%
       GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAG%
       GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAG};
    %
    % ── Subtle sidebar accent ──
    \fill[yalumba-wine,opacity=0.06]
      (current page.north west) rectangle
      ([xshift=5pt]current page.south west);
  \end{tikzpicture}

  \vspace*{3cm}

  % ── Branding line ──
  {\color{yalumba-charcoal}\textsf{\textsc{\large yalumba}}%
   \hfill
   \textsf{\small reference-free genomics}}

  \vspace{0.3cm}
  {\color{yalumba-wine}\rule{\textwidth}{0.5pt}}

  \vspace{1cm}

  % ── Title ──
  {\fontsize{24}{29}\selectfont\sffamily\bfseries\@title\par}

  \vspace{1.2cm}

  % ── Author and date ──
  {\large\color{yalumba-charcoal}\textsf{\@author}%
   \hfill
   \textsf{\@date}}

  \vspace{0.3cm}
  {\color{text-muted}\rule{\textwidth}{0.25pt}}

  \vspace{1.2cm}

  % ── Abstract box ──
  \begin{tcolorbox}[
    enhanced,
    colback=white,
    colframe=white,
    borderline west={3pt}{0pt}{yalumba-wine},
    borderline north={0.5pt}{0pt}{yalumba-wine!20},
    borderline south={0.5pt}{0pt}{yalumba-wine!20},
    left=14pt,
    right=14pt,
    top=12pt,
    bottom=12pt,
    sharp corners,
    boxrule=0pt,
    shadow={1pt}{-1pt}{0pt}{yalumba-wine!8},
  ]
  {\sffamily\bfseries\color{yalumba-charcoal}\small ABSTRACT}%
  \par\vspace{6pt}
  {\small\@abstract}
  \end{tcolorbox}

  \vfill

  % ── Subtle footer accent ──
  \begin{tikzpicture}[remember picture,overlay]
    \fill[yalumba-wine,opacity=0.12]
      ([yshift=6pt]current page.south west)
      rectangle ([yshift=9pt]current page.south east);
  \end{tikzpicture}

  \newpage
}

% ── Margin note command ──
\newcommand{\ymarginnote}[2][yalumba-slate]{%
  \marginnote{%
    \raggedright\footnotesize\color{#1}\sffamily #2%
  }%
}

% ── Custom environments ──

% Key finding box
\newtcolorbox{keyfinding}{
  enhanced,
  colback=keyfinding-bg,
  colframe=white,
  borderline west={3.5pt}{0pt}{yalumba-wine},
  left=12pt, right=10pt, top=10pt, bottom=10pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{yalumba-charcoal},
  title={\raisebox{-0.5pt}{$\blacktriangleright$}\enspace Key Finding},
  breakable,
  before upper={\setstretch{1.2}},
}

% Limitation box
\newtcolorbox{limitation}{
  enhanced,
  colback=limitation-bg,
  colframe=white,
  borderline west={3.5pt}{0pt}{yalumba-gold},
  left=12pt, right=10pt, top=10pt, bottom=10pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{yalumba-charcoal},
  title={\raisebox{-0.5pt}{$\blacktriangle$}\enspace Limitation},
  breakable,
  before upper={\setstretch{1.2}},
}

% Definition box
\newtcolorbox{definition}{
  enhanced,
  colback=definition-bg,
  colframe=white,
  borderline west={3.5pt}{0pt}{yalumba-slate},
  left=12pt, right=10pt, top=10pt, bottom=10pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{yalumba-charcoal},
  title={\raisebox{-0.5pt}{$\bullet$}\enspace Definition},
  breakable,
  before upper={\setstretch{1.2}},
}

% ── Pull quote environment ──
\newenvironment{pullquote}[1][yalumba-slate]{%
  \begin{center}
  \begin{minipage}{0.85\textwidth}
  \begin{tcolorbox}[
    enhanced,
    colback=pullquote-bg,
    colframe=white,
    borderline north={1pt}{0pt}{#1!40},
    borderline south={1pt}{0pt}{#1!40},
    left=16pt, right=16pt, top=14pt, bottom=14pt,
    sharp corners,
    boxrule=0pt,
  ]
  \centering\large\color{yalumba-charcoal}\sffamily\bfseries
}{%
  \end{tcolorbox}
  \end{minipage}
  \end{center}
}

% ── Tables ──
\newcommand{\tablestyle}{%
  \small\sffamily%
  \rowcolors{2}{table-alt}{white}%
}

\newenvironment{yalumbatable}[2][htbp]{%
  \begin{table}[#1]
  \centering
  \tablestyle
  \begin{tabular}{#2}
  \toprule
  \rowcolor{table-header}
}{%
  \bottomrule
  \end{tabular}
  \end{table}
}

% ── Code listings ──
\lstdefinestyle{yalumba}{
  backgroundcolor=\color{code-bg},
  basicstyle=\ttfamily\small\color{white},
  keywordstyle=\color{white}\bfseries,
  stringstyle=\color{white!70},
  commentstyle=\color{text-muted}\itshape,
  numberstyle=\tiny\color{text-muted},
  breaklines=true,
  frame=single,
  rulecolor=\color{surface-2},
  xleftmargin=1em,
  xrightmargin=1em,
  aboveskip=1em,
  belowskip=1em,
  numbers=left,
  numbersep=8pt,
  tabsize=2,
  showstringspaces=false,
}
\lstset{style=yalumba}

% ── Equation tag coloring ──
\makeatletter
\def\tagform@#1{\maketag@@@{\color{yalumba-charcoal}(\ignorespaces#1\unskip\@@italiccorr)}}
\makeatother

% ── DNA sequence decoration ──
\newcommand{\dnaseq}[1]{%
  \begingroup
  \ttfamily\small
  \@tfor\next:=#1\do{%
    \ifx\next A\textcolor{dna-A}{\next}\fi
    \ifx\next C\textcolor{dna-C}{\next}\fi
    \ifx\next G\textcolor{dna-G}{\next}\fi
    \ifx\next T\textcolor{dna-T}{\next}\fi
  }%
  \endgroup
}

% ── Pedigree diagram environment ──
\newenvironment{pedigree}{%
  \begin{tcolorbox}[
    enhanced, colback=surface!3, colframe=surface!15,
    borderline north={0.5pt}{0pt}{yalumba-wine!20},
    borderline south={0.5pt}{0pt}{yalumba-wine!20},
    left=14pt, right=14pt, top=10pt, bottom=10pt,
    sharp corners, boxrule=0.5pt,
    fonttitle=\sffamily\small\color{text-muted},
    title={\textsf{Pedigree}},
  ]
  \ttfamily\small
}{%
  \end{tcolorbox}
}

% ── Caption styling ──
\captionsetup{
  font={small,sf},
  labelfont={bf,color=yalumba-charcoal},
  format=plain,
  margin=0.5cm,
}

% ── List styling ──
\setlist{leftmargin=2em,itemsep=0.3em}
\setlist[itemize]{label={\color{yalumba-wine}\textbullet}}
\setlist[enumerate]{label={\color{yalumba-wine}\arabic*.}}

\endinput
