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

% ── Colors (matching yalumba web theme) ──
\definecolor{yalumba-cyan}{HTML}{22D3EE}
\definecolor{yalumba-violet}{HTML}{A78BFA}
\definecolor{dna-A}{HTML}{22C55E}
\definecolor{dna-C}{HTML}{3B82F6}
\definecolor{dna-G}{HTML}{F59E0B}
\definecolor{dna-T}{HTML}{EF4444}
\definecolor{bg-dark}{HTML}{0A0A0A}
\definecolor{surface}{HTML}{111111}
\definecolor{surface-2}{HTML}{1A1A1A}
\definecolor{text-muted}{HTML}{737373}
\definecolor{table-alt}{HTML}{F5F5F5}
\definecolor{table-header}{HTML}{1A1A1A}
\definecolor{code-bg}{HTML}{111111}
\definecolor{pullquote-bg}{HTML}{F8FAFC}
\definecolor{keyfinding-bg}{HTML}{F0FDF4}
\definecolor{limitation-bg}{HTML}{FFFBEB}
\definecolor{definition-bg}{HTML}{EFF6FF}

% ── Hyperref setup ──
\hypersetup{
  colorlinks=true,
  linkcolor=yalumba-cyan!80!black,
  citecolor=yalumba-violet!80!black,
  urlcolor=yalumba-cyan!80!black,
  pdfborder={0 0 0},
}

% ── Section color cycling ──
\newcounter{sectioncoloridx}
\setcounter{sectioncoloridx}{0}

\newcommand{\getsectioncolor}{%
  \ifcase\value{sectioncoloridx}%
    dna-A%  0 -> green
  \or
    dna-C%  1 -> blue
  \or
    dna-G%  2 -> amber
  \or
    dna-T%  3 -> red
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
    \draw[yalumba-cyan,line width=1pt]
      ([yshift=-0.5cm]current page.north west)
      -- ([yshift=-0.5cm]current page.north east);
  \end{tikzpicture}%
}
\fancyhead[L]{\small\color{yalumba-cyan}\textsf{\textbf{yalumba}}}
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
    % ── Subtle accent line at top (single thin cyan rule) ──
    \fill[yalumba-cyan] (current page.north west)
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
    \fill[yalumba-cyan,opacity=0.08]
      (current page.north west) rectangle
      ([xshift=5pt]current page.south west);
  \end{tikzpicture}

  \vspace*{3cm}

  % ── Branding line ──
  {\color{yalumba-cyan}\textsf{\textsc{\large yalumba}}%
   \hfill
   \textsf{\small reference-free genomics}}

  \vspace{0.3cm}
  {\color{yalumba-cyan}\rule{\textwidth}{0.5pt}}

  \vspace{1cm}

  % ── Title ──
  {\fontsize{24}{29}\selectfont\sffamily\bfseries\@title\par}

  \vspace{1.2cm}

  % ── Author and date ──
  {\large\color{yalumba-violet}\textsf{\@author}%
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
    borderline west={3pt}{0pt}{yalumba-cyan},
    borderline north={0.5pt}{0pt}{yalumba-cyan!30},
    borderline south={0.5pt}{0pt}{yalumba-cyan!30},
    left=14pt,
    right=14pt,
    top=12pt,
    bottom=12pt,
    sharp corners,
    boxrule=0pt,
    shadow={1pt}{-1pt}{0pt}{yalumba-cyan!8},
  ]
  {\sffamily\bfseries\color{yalumba-cyan}\small ABSTRACT}%
  \par\vspace{6pt}
  {\small\@abstract}
  \end{tcolorbox}

  \vfill

  % ── Subtle footer accent ──
  \begin{tikzpicture}[remember picture,overlay]
    \fill[yalumba-cyan,opacity=0.15]
      ([yshift=6pt]current page.south west)
      rectangle ([yshift=9pt]current page.south east);
  \end{tikzpicture}

  \newpage
}

% ── Margin note command ──
\newcommand{\ymarginnote}[2][yalumba-cyan]{%
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
  borderline west={3.5pt}{0pt}{dna-A},
  left=12pt, right=10pt, top=10pt, bottom=10pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{dna-A},
  title={\raisebox{-0.5pt}{$\blacktriangleright$}\enspace Key Finding},
  breakable,
  before upper={\setstretch{1.2}},
}

% Limitation box
\newtcolorbox{limitation}{
  enhanced,
  colback=limitation-bg,
  colframe=white,
  borderline west={3.5pt}{0pt}{dna-G},
  left=12pt, right=10pt, top=10pt, bottom=10pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{dna-G!80!black},
  title={\raisebox{-0.5pt}{$\blacktriangle$}\enspace Limitation},
  breakable,
  before upper={\setstretch{1.2}},
}

% Definition box
\newtcolorbox{definition}{
  enhanced,
  colback=definition-bg,
  colframe=white,
  borderline west={3.5pt}{0pt}{dna-C},
  left=12pt, right=10pt, top=10pt, bottom=10pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{dna-C},
  title={\raisebox{-0.5pt}{$\bullet$}\enspace Definition},
  breakable,
  before upper={\setstretch{1.2}},
}

% ── Pull quote environment ──
\newenvironment{pullquote}[1][yalumba-cyan]{%
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
  \centering\large\color{#1!80!black}\sffamily\bfseries
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
  keywordstyle=\color{yalumba-cyan}\bfseries,
  stringstyle=\color{dna-A},
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
\def\tagform@#1{\maketag@@@{\color{yalumba-cyan!70!black}(\ignorespaces#1\unskip\@@italiccorr)}}
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
    borderline north={0.5pt}{0pt}{yalumba-cyan!30},
    borderline south={0.5pt}{0pt}{yalumba-cyan!30},
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
  labelfont={bf,color=yalumba-cyan!80!black},
  format=plain,
  margin=0.5cm,
}

% ── List styling ──
\setlist{leftmargin=2em,itemsep=0.3em}
\setlist[itemize]{label={\color{yalumba-cyan}\textbullet}}
\setlist[enumerate]{label={\color{yalumba-cyan}\arabic*.}}

\endinput
