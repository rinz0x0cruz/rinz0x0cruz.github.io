// Curated project list, security-first. `featured` projects lead the
// "Selected Work" grid; the rest fall into "More projects".

export type ProjectStatus = 'live' | 'active' | 'research';

export interface Project {
  name: string;
  tagline: string;
  description: string;
  stack: string[];
  tags: string[];
  featured: boolean;
  status: ProjectStatus;
  links: {
    repo?: string;
    live?: string;
  };
  highlights: string[];
}

export const projects: Project[] = [
  {
    name: 'exploitrank',
    tagline: 'Exploitability-aware CVE prioritizer.',
    description:
      'Fuses CVSS, EPSS, CISA KEV, and public-PoC signals into a single SSVC-style act / track / defer verdict, so teams patch what is actually being exploited first — not just what scores high. Ships an offline threat board and runs completely key-free.',
    stack: ['Go'],
    tags: ['Vulnerability Management', 'Threat Intel'],
    featured: true,
    status: 'live',
    links: {
      repo: 'https://github.com/rinz0x0cruz/exploitrank',
      live: 'https://rinz0x0cruz.github.io/exploitrank/',
    },
    highlights: [
      'Merges CVSS · EPSS · CISA KEV · public-PoC signals into one verdict',
      'SSVC-style decision output (act / track / defer)',
      'Offline dashboard, zero API keys required',
    ],
  },
  {
    name: 'Ikhor',
    tagline: 'Async command-and-control framework.',
    description:
      'A custom, multi-threaded C2 agent for malware simulation and red-team task scheduling — built to study real adversary tradecraft and validate detections from the operator side of the keyboard.',
    stack: ['C++', 'Qt'],
    tags: ['Offensive Security', 'Malware Simulation'],
    featured: true,
    status: 'active',
    links: {
      repo: 'https://github.com/rinz0x0cruz/Ikhor',
    },
    highlights: [
      'Async, multi-threaded agent architecture',
      'Red-team task scheduling & tasking',
      'Built for detection validation and adversary emulation',
    ],
  },
  {
    name: 'malscope',
    tagline: 'Sample in, structured malware-analysis report out.',
    description:
      'An offline-first companion for a malware-analysis lab: it parses capa / Suricata / Zeek / FLOSS / Volatility output into a report, clusters samples by imphash and TLSH, auto-generates YARA + Sigma detections, and guards the git repo so a live sample can never be committed by accident.',
    stack: ['Python', 'Nuxt'],
    tags: ['Malware Analysis', 'Detection Engineering', 'Threat Intel'],
    featured: true,
    status: 'active',
    links: {
      repo: 'https://github.com/rinz0x0cruz/malscope',
    },
    highlights: [
      'Parses capa · Suricata · Zeek · FLOSS · Volatility into one report',
      'imphash + TLSH clustering catches recompiled variants',
      'Auto-generates YARA & Sigma rules; STIX 2.1 / MISP export',
      'Pre-commit guard blocks live samples from being committed',
    ],
  },
  {
    name: 'SkillForge',
    tagline: '352 HTB Academy modules as a gamified security skill tree.',
    description:
      'A client-side React app that turns Hack The Box Academy into a gamified skill tree — 22 skills with ranks, ordered learning paths, a MITRE ATT&CK coverage map, spaced-repetition practice, and a real-world exploited-CVE layer. No backend, fully offline PWA.',
    stack: ['React', 'TypeScript', 'Vite'],
    tags: ['Security Education', 'Detection Engineering'],
    featured: false,
    status: 'active',
    links: {
      repo: 'https://github.com/rinz0x0cruz/skillforge',
    },
    highlights: [
      '22 security skills + 33 DSA concepts with ranks & prerequisites',
      'MITRE ATT&CK coverage map + CISA KEV "exploited in the wild" layer',
      'Installable offline PWA; all progress stays local',
    ],
  },
  {
    name: 'quorum',
    tagline: 'Put several AI models in a room and make them debate.',
    description:
      'A provider-agnostic CLI that runs a deliberation between multiple language models — refining the prompt, then proposing / critiquing / revising while a judge scores each round. It bakes in a dozen research papers (multi-agent debate, Mixture-of-Agents, Self-Refine) and a benchmark harness to prove which strategy actually wins.',
    stack: ['Python'],
    tags: ['AI Research', 'Tooling'],
    featured: false,
    status: 'research',
    links: {
      repo: 'https://github.com/rinz0x0cruz/quorum',
    },
    highlights: [
      'Multiple deliberation strategies grounded in published research',
      'Judge with adaptive stopping + position-bias mitigation',
      'Runs fully offline via a built-in mock provider',
    ],
  },
  {
    name: 'jobscope',
    tagline: 'Resume-driven job scout, enricher, and application-prep tool.',
    description:
      'Point it at your resume; it scrapes fitting roles, ranks them with a transparent fit score, enriches each with public intel, flags scam / ghost jobs, and assembles a review-ready application package — deterministic-first, with a human always clicking submit.',
    stack: ['Python'],
    tags: ['Automation', 'Tooling'],
    featured: false,
    status: 'active',
    links: {
      repo: 'https://github.com/rinz0x0cruz/jobscope',
    },
    highlights: [
      'Transparent fit scoring + scam / ghost-job detection',
      'Local-first & private (SQLite, OS-keychain secrets)',
      'Never drives your logged-in accounts',
    ],
  },
  {
    name: 'claudebudget',
    tagline: 'Local-first monitor for the Claude Pro usage limits.',
    description:
      "Reads Claude Code's own usage logs on your machine and turns the invisible rolling 5-hour and weekly caps into live gauges, reset countdowns, pre-cap alerts, and an offline dashboard — so you pace your work and avoid lockouts.",
    stack: ['Python'],
    tags: ['Dev Tooling'],
    featured: false,
    status: 'active',
    links: {
      repo: 'https://github.com/rinz0x0cruz/claudebudget',
    },
    highlights: [
      'Live 5-hour / weekly / Opus usage windows',
      'Pre-cap toast alerts + a reduce-usage advisor',
      'Self-contained offline dashboard, no servers',
    ],
  },
];

export const featuredProjects = projects.filter((p) => p.featured);
export const moreProjects = projects.filter((p) => !p.featured);
