export interface Achievement {
  value: string;
  label: string;
  detail: string;
}

export interface DemoHotspot {
  x: number;
  y: number;
  side: 'left' | 'right' | 'above';
  eyebrow: string;
  title: string;
  detail: string;
  metric: string;
  metricLabel: string;
  event: string;
}

export interface ProjectDemo {
  name: string;
  label: string;
  image: string;
  alt: string;
  description: string;
  meta: readonly (readonly [string, string])[];
  telemetry: readonly (readonly [string, string])[];
  activity: readonly string[];
  hotspots: readonly DemoHotspot[];
}

export interface CaseStudy {
  label: string;
  title: string;
  summary: string;
  role: string;
  constraints: string;
  approach: readonly string[];
  outcome: string;
  metric: string;
}

export interface PublicProfile {
  name: string;
  handle: string;
  url: string;
  summary: string;
  verifiedAt: string;
  metrics: readonly {
    value: string;
    label: string;
  }[];
}

export const intro = {
  eyebrow: 'Security researcher / threat intelligence / malware analysis',
  statement:
    'I turn exploitation signals, malware behavior, and fragmented telemetry into decisions defenders can explain and act on.',
  currentFocus: [
    'Exploitability-aware vulnerability intelligence',
    'Malware similarity and detection pipelines',
    'Evidence-led intrusion reconstruction',
  ],
} as const;

export const achievements = [
  {
    value: '47%',
    label: 'fewer false-positive incidents',
    detail: '511 cases resolved after tracing normalization defects across more than ten products.',
  },
  {
    value: '50K+',
    label: 'detections generated',
    detail: 'Stable features extracted across eight reverse-engineered malware families.',
  },
  {
    value: '22 / 31',
    label: 'tracked CVEs closed',
    detail: 'Emerging-threat findings carried from severity and exposure review through coverage fixes.',
  },
  {
    value: 'Full chain',
    label: 'intrusion reconstructed',
    detail: 'Identity and endpoint evidence connected from credential theft through Rclone exfiltration.',
  },
] satisfies readonly Achievement[];

export const projectDemos = [
  {
    name: 'ExploitRank',
    label: 'Vulnerability intelligence',
    image: '/work-exploitrank.png',
    alt: 'ExploitRank vulnerability prioritization interface',
    description:
      'A key-free prioritization product that combines EPSS, CISA KEV, CVSS, and public exploit evidence into a fixed review queue defenders can audit and self-grade.',
    meta: [
      ['Role', 'Product + engineering'],
      ['Decision', 'Act / track / defer'],
      ['Delivery', 'Go / static web'],
    ],
    telemetry: [
      ['NVD sync', 'Live'],
      ['KEV catalog', '1,481'],
      ['Review queue', '24 act'],
    ],
    activity: ['CVE evidence linked', 'Actor relationship resolved', 'Queue verdict recalculated'],
    hotspots: [
      {
        x: 66,
        y: 34,
        side: 'left',
        eyebrow: 'Connected evidence',
        title: 'Threat relationship graph',
        detail: 'Actors, malware, campaigns, ATT&CK techniques, and exploited CVEs resolve into one evidence model.',
        metric: '24',
        metricLabel: 'linked nodes',
        event: 'Actor to CVE edge verified',
      },
      {
        x: 55,
        y: 53,
        side: 'left',
        eyebrow: 'Decision layer',
        title: 'EPSS review queue',
        detail:
          'EPSS, CISA KEV, CVSS, and public exploit signals collapse into an auditable act / track / defer verdict.',
        metric: '0.91',
        metricLabel: 'top EPSS',
        event: 'Verdict promoted to ACT',
      },
      {
        x: 22,
        y: 88,
        side: 'above',
        eyebrow: 'Live posture',
        title: 'Exploitation pressure',
        detail: "A compact score turns the day's exploit activity into a defensible prioritization signal.",
        metric: '+18%',
        metricLabel: 'pressure',
        event: 'CISA KEV sync complete',
      },
    ],
  },
  {
    name: 'malscope',
    label: 'Malware analysis',
    image: '/work-malscope.png',
    alt: 'malscope malware analysis interface',
    description:
      'A private analysis pipeline with a separately publishable evidence surface for similarity clusters, configuration intelligence, defanged indicators, YARA, and Sigma.',
    meta: [
      ['Role', 'Research + architecture'],
      ['Evidence', 'imphash / TLSH'],
      ['Safety', 'Redacted by design'],
    ],
    telemetry: [
      ['Reports', '24'],
      ['Families', '9'],
      ['Rules ready', '31'],
    ],
    activity: ['New report indexed', 'imphash cluster resolved', 'Sigma coverage refreshed'],
    hotspots: [
      {
        x: 29,
        y: 24,
        side: 'right',
        eyebrow: 'Triage summary',
        title: 'Malicious report count',
        detail:
          'A safe overview separates malicious reports, families, and observed techniques without exposing live samples.',
        metric: '24',
        metricLabel: 'reports',
        event: 'New report safely indexed',
      },
      {
        x: 49,
        y: 42,
        side: 'above',
        eyebrow: 'Temporal evidence',
        title: 'Activity timeline',
        detail: 'First-seen dates and severity markers reveal how the analyzed sample set evolves over time.',
        metric: '7d',
        metricLabel: 'window',
        event: 'First-seen marker added',
      },
      {
        x: 27,
        y: 66,
        side: 'right',
        eyebrow: 'Similarity intelligence',
        title: 'Family clustering',
        detail: 'Stable family and imphash relationships make repeated infrastructure and code reuse visible.',
        metric: '9',
        metricLabel: 'families',
        event: 'imphash cluster resolved',
      },
      {
        x: 73,
        y: 66,
        side: 'left',
        eyebrow: 'Detection handoff',
        title: 'ATT&CK coverage',
        detail: 'Observed behaviors map to tactics and generated detections, ready for YARA and Sigma workflows.',
        metric: '17',
        metricLabel: 'techniques',
        event: 'Sigma coverage refreshed',
      },
    ],
  },
] satisfies readonly ProjectDemo[];

export const caseStudies = [
  {
    label: 'Nation-state intrusion',
    title: 'Reconstructing a Midnight Blizzard intrusion',
    summary:
      'An endpoint-and-identity investigation across an on-prem to Entra pivot, from credential theft and C2 through INC ransomware and hands-on Rclone exfiltration.',
    role: 'Investigation, telemetry correlation, timeline reconstruction, IOC narrative.',
    constraints:
      'Fragmented evidence across identity and endpoint systems; an active containment timeline; attribution claims had to remain evidence-bound.',
    approach: [
      'Normalized events into a single operator timeline.',
      'Pivoted through credentials, process ancestry, network activity, and identity changes.',
      'Separated confirmed behavior from hypotheses and translated the chain into containment-ready indicators.',
    ],
    outcome: 'Delivered the intrusion narrative used to drive proactive containment.',
    metric: 'Full kill chain',
  },
  {
    label: 'Detection quality',
    title: 'Finding the data defects behind false positives',
    summary:
      'A cross-product accuracy program covering Adobe Acrobat, Teams, Telegram, and other products where normalization and version mapping caused noisy detections.',
    role: 'Root-cause analysis, data-model specification, validation, rollout support.',
    constraints:
      'Ten-plus product schemas, inconsistent version formats, and production rules that could not be broadly disabled while fixes shipped.',
    approach: [
      'Clustered recurring incidents by normalization failure mode.',
      'Mapped source fields to canonical product/version identities.',
      'Authored nine of ten ingestion and normalization specifications and validated the downstream behavior.',
    ],
    outcome: 'Reduced false-positive incidents by 47%, with 511 cases resolved.',
    metric: '47% fewer',
  },
  {
    label: 'Threat hunting + malware RE',
    title: 'Turning Turla research into repeatable detection',
    summary:
      'A Diamond Model hunt paired with static and dynamic analysis of eight malware families, including Turla and Agent Tesla.',
    role: 'Threat research, reverse engineering, YARA authoring, VirusTotal workflow automation.',
    constraints:
      'High sample volume, variant drift, and the need to distinguish reusable operator behavior from one-off sample artifacts.',
    approach: [
      'Structured the hunt around adversary, infrastructure, capability, and victim pivots.',
      'Extracted stable code/configuration features across malware variants.',
      'Automated feed analysis and translated findings into YARA and behavioral coverage.',
    ],
    outcome: 'Generated 50,000+ detections and reduced triage from roughly two hours to near real-time.',
    metric: '50K+ detections',
  },
] satisfies readonly CaseStudy[];

export const publicProfiles = [
  {
    name: 'TryHackMe',
    handle: 'rinz0x0cruz',
    url: 'https://tryhackme.com/p/rinz0x0cruz',
    summary:
      'Hands-on security practice spanning offensive fundamentals, threat intelligence, SOC, DFIR, malware analysis, and SIEM.',
    verifiedAt: 'Public profile snapshot / July 2026',
    metrics: [
      { value: 'Top 3%', label: 'global standing' },
      { value: '91', label: 'rooms completed' },
      { value: '20', label: 'badges' },
    ],
  },
  {
    name: 'LeetCode',
    handle: 'rinz0x0cruz',
    url: 'https://leetcode.com/u/rinz0x0cruz/',
    summary:
      'Algorithm practice across C++, dynamic programming, divide and conquer, union-find, hashing, and graph-oriented problem solving.',
    verifiedAt: 'Public profile snapshot / July 2026',
    metrics: [
      { value: '460', label: 'problems solved' },
      { value: '1,562', label: 'contest rating' },
      { value: '6', label: 'badges' },
    ],
  },
] satisfies readonly PublicProfile[];
