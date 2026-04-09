% yalumba.cls — Custom document class for yalumba research papers
% Modern, colorful, branded design inspired by Nature/Cell
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{yalumba}[2026/04/10 yalumba research paper class]

\LoadClass[11pt,a4paper]{article}

% ── Core packages ──
\RequirePackage[margin=1in,top=1.2in,bottom=1.2in]{geometry}
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

\tcbuselibrary{skins,breakable}

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

% ── Hyperref setup ──
\hypersetup{
  colorlinks=true,
  linkcolor=yalumba-cyan,
  citecolor=yalumba-violet,
  urlcolor=yalumba-cyan,
  pdfborder={0 0 0},
}

% ── Page header/footer ──
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\fancyhead[L]{\small\color{text-muted}\textsf{yalumba}}
\fancyhead[R]{\small\color{text-muted}\textsf{\leftmark}}
\fancyfoot[C]{\small\color{text-muted}\textsf{\thepage\,/\,\pageref{LastPage}}}
% Colored top strip
\fancyhead[C]{\makebox[\textwidth]{\color{yalumba-cyan}\rule{\paperwidth}{1.5pt}}\vspace{-1.2em}}

% ── Section formatting ──
% Section underlines cycle through DNA colors
\titleformat{\section}
  {\Large\sffamily\bfseries}
  {\thesection}{1em}{}
  [\vspace{-0.5em}{\color{yalumba-cyan}\rule{3cm}{2.5pt}}]

\titleformat{\subsection}
  {\large\sffamily\bfseries}
  {\thesubsection}{0.8em}{}

\titleformat{\subsubsection}
  {\normalsize\sffamily\bfseries\itshape}
  {\thesubsubsection}{0.6em}{}

% ── Title page ──
\newcommand{\reportslug}[1]{\def\@reportslug{#1}}
\reportslug{report}

\renewcommand{\maketitle}{%
  \thispagestyle{empty}
  \begin{tikzpicture}[remember picture,overlay]
    % DNA color gradient bar at top
    \fill[dna-A] (current page.north west) rectangle ([yshift=-4pt]current page.north east);
    \fill[dna-C] ([yshift=-4pt]current page.north west) rectangle ([yshift=-8pt]current page.north east);
    \fill[dna-G] ([yshift=-8pt]current page.north west) rectangle ([yshift=-12pt]current page.north east);
    \fill[dna-T] ([yshift=-12pt]current page.north west) rectangle ([yshift=-16pt]current page.north east);
    % Sidebar accent
    \fill[yalumba-cyan,opacity=0.15] (current page.north west) rectangle ([xshift=6pt]current page.south west);
  \end{tikzpicture}

  \vspace*{2cm}

  {\color{yalumba-cyan}\textsf{\textsc{\large yalumba}}\hfill\textsf{\small reference-free genomics}}

  \vspace{0.8cm}

  {\Huge\sffamily\bfseries\@title\par}

  \vspace{0.8cm}

  {\large\color{yalumba-violet}\textsf{\@author}\hfill\textsf{\@date}}

  \vspace{1cm}

  \begin{tcolorbox}[
    enhanced,
    colback=white,
    colframe=white,
    borderline west={3pt}{0pt}{yalumba-cyan},
    left=12pt,
    right=8pt,
    top=8pt,
    bottom=8pt,
    sharp corners,
    boxrule=0pt,
  ]
  \small\textbf{Abstract}\par\vspace{4pt}
  \@abstract
  \end{tcolorbox}

  \vspace{0.5cm}
  \newpage
}

% Store abstract using a simple command
\newcommand{\@abstract}{}
\newcommand{\setabstract}[1]{\long\def\@abstract{#1}}

% ── Custom environments ──

% Key finding box
\newtcolorbox{keyfinding}{
  enhanced,
  colback=dna-A!5,
  colframe=white,
  borderline west={3pt}{0pt}{dna-A},
  left=10pt, right=8pt, top=6pt, bottom=6pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{dna-A},
  title=Key Finding,
  breakable,
}

% Limitation box
\newtcolorbox{limitation}{
  enhanced,
  colback=dna-G!5,
  colframe=white,
  borderline west={3pt}{0pt}{dna-G},
  left=10pt, right=8pt, top=6pt, bottom=6pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{dna-G},
  title=Limitation,
  breakable,
}

% Definition box
\newtcolorbox{definition}{
  enhanced,
  colback=dna-C!5,
  colframe=white,
  borderline west={3pt}{0pt}{dna-C},
  left=10pt, right=8pt, top=6pt, bottom=6pt,
  sharp corners,
  boxrule=0pt,
  fonttitle=\sffamily\bfseries\color{dna-C},
  title=Definition,
  breakable,
}

% ── Tables ──
\newcommand{\tablestyle}{%
  \small\sffamily%
  \rowcolors{2}{table-alt}{white}%
}

\newenvironment{yalumbatable}[1]{%
  \begin{table}[htbp]
  \centering
  \tablestyle
  \begin{tabular}{#1}
  \toprule
  \rowcolor{table-header}
}{%
  \bottomrule
  \end{tabular}
  \end{table}
}

% ── Code listings ──
\lstdefinestyle{yalumba}{
  backgroundcolor=\color{surface},
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
}
\lstset{style=yalumba}

% ── Equation coloring ──
\makeatletter
\def\tagform@#1{\maketag@@@{\color{yalumba-cyan}(\ignorespaces#1\unskip\@@italiccorr)}}
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

% ── Pedigree diagram ──
\newenvironment{pedigree}{%
  \begin{tcolorbox}[
    enhanced, colback=surface!3, colframe=surface!20,
    left=10pt, right=10pt, top=6pt, bottom=6pt,
    sharp corners, boxrule=0.5pt,
  ]
  \ttfamily\small
}{%
  \end{tcolorbox}
}

\endinput
