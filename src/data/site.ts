// Central identity + contact config. Everything that describes "who this is"
// lives here so the layout, sections, terminal, and structured data stay in sync.

export interface Social {
  name: string;
  url: string;
  handle: string;
  /** Simple-icons style slug, used for inline SVG icons. */
  icon: 'github' | 'linkedin' | 'leetcode' | 'tryhackme' | 'email';
  /** Show this link in the compact identity plate. */
  featured?: boolean;
}

export const site = {
  name: 'Mohit Sharma',
  handle: 'rinz0x0cruz',
  alias: 'Rinzler',
  host: 'rinzler@grid',
  role: 'Security Researcher',

  // Meta description / default OG copy.
  tagline:
    'Security researcher focused on CVE triage, malware reverse engineering, threat hunting, and detection engineering, turning raw threat data into defensible intelligence.',

  // Longer About copy (paragraphs).
  bio: [
    "I'm a security researcher who spends the day in the parts of the internet you're warned about: vulnerability management, detection engineering, and threat intel. In practice that means triaging CVEs, taking malware apart to see what makes it tick, and turning a mess of telemetry into something a defender can actually act on.",
    'I track threat actors and their TTPs across MITRE ATT&CK, run Diamond Model hunts, and rebuild intrusion kill chains like a very grim jigsaw, then write it up as detections and advisories that survive a "says who?". Evidence over vibes, every time.',
  ],

  url: 'https://rinz0x0cruz.github.io',
  email: 'rinz0x0cruz@gmail.com',
  ogImage: '/og.png',

  availableForWork: true,
  availabilityNote: 'Open to roles, consulting & interesting malware',

  socials: [
    { name: 'GitHub', url: 'https://github.com/rinz0x0cruz', handle: '@rinz0x0cruz', icon: 'github', featured: true },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/rinz0x0cruz/', handle: 'in/rinz0x0cruz', icon: 'linkedin', featured: true },
    { name: 'LeetCode', url: 'https://leetcode.com/u/rinz0x0cruz/', handle: 'u/rinz0x0cruz', icon: 'leetcode' },
    { name: 'TryHackMe', url: 'https://tryhackme.com/p/rinz0x0cruz', handle: 'p/rinz0x0cruz', icon: 'tryhackme' },
    { name: 'Email', url: 'mailto:rinz0x0cruz@gmail.com', handle: 'rinz0x0cruz@gmail.com', icon: 'email' },
  ] satisfies Social[],

  // Résumé PDF, downloadable from the site.
  resumeUrl: '/Mohit-Sharma-Resume.pdf',

  knowsAbout: [
    'Vulnerability Management',
    'Threat Intelligence',
    'Threat Hunting',
    'Detection Engineering',
    'Malware Analysis',
    'Reverse Engineering',
    'CVE Triage',
    'Incident Response',
  ],
} as const;

export type Site = typeof site;
