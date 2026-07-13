// Central identity + contact config. Everything that describes "who this is"
// lives here so the layout, sections, terminal, and structured data stay in sync.

export interface Social {
  name: string;
  url: string;
  handle: string;
  /** Simple-icons style slug, used for inline SVG icons. */
  icon: 'github' | 'linkedin' | 'leetcode' | 'tryhackme' | 'email';
}

export const site = {
  name: 'Mohit Sharma',
  handle: 'rinz0x0cruz',
  alias: 'Rinzler',
  host: 'rinzler@grid',
  role: 'Security Researcher',

  // Hero one-liner (kept short + punchy).
  heroLine: 'I build tools that hunt threats.',

  // Meta description / default OG copy.
  tagline:
    'Security researcher focused on CVE triage, malware reverse engineering, and detection engineering — I build small, sharp tools that turn raw threat data into readable intelligence.',

  // Longer About copy (paragraphs).
  bio: [
    "I'm a security researcher working across vulnerability management, detection engineering, and threat intelligence. Day to day that means triaging CVEs, reverse-engineering malware, and turning messy threat data into signals a defender can actually act on.",
    'I build small, deterministic-first tools to do it — exploitability-aware CVE prioritization, malware-analysis tooling, and threat-intel pipelines. Everything runs standalone; AI is an optional enrichment layer, never a dependency.',
  ],

  url: 'https://rinz0x0cruz.github.io',
  email: 'rinz0x0cruz@gmail.com',
  ogImage: '/og.png',

  availableForWork: true,
  availabilityNote: 'Open to security roles & consulting',

  socials: [
    { name: 'GitHub', url: 'https://github.com/rinz0x0cruz', handle: '@rinz0x0cruz', icon: 'github' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/rinz0x0cruz/', handle: 'in/rinz0x0cruz', icon: 'linkedin' },
    { name: 'LeetCode', url: 'https://leetcode.com/u/rinz0x0cruz/', handle: 'u/rinz0x0cruz', icon: 'leetcode' },
    { name: 'TryHackMe', url: 'https://tryhackme.com/p/rinz0x0cruz', handle: 'p/rinz0x0cruz', icon: 'tryhackme' },
    { name: 'Email', url: 'mailto:rinz0x0cruz@gmail.com', handle: 'rinz0x0cruz@gmail.com', icon: 'email' },
  ] satisfies Social[],

  // Résumé is shared on request, not published publicly.
  resumeRequest: 'mailto:rinz0x0cruz@gmail.com?subject=Resume%20request',

  knowsAbout: [
    'Vulnerability Management',
    'Threat Intelligence',
    'Detection Engineering',
    'Malware Analysis',
    'Reverse Engineering',
    'CVE Triage',
    'Incident Response',
  ],
} as const;

export type Site = typeof site;
