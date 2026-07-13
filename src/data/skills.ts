export interface SkillGroup {
  label: string;
  items: string[];
}

// Grouped skills for the Skills section. Kept to what's defensible / confirmed.
export const skillGroups: SkillGroup[] = [
  {
    label: 'Threat Intelligence',
    items: ['CVE triage', 'Threat hunting', 'EPSS / CISA KEV', 'IOC & campaign clustering', 'Diamond Model', 'STIX 2.1 / MISP'],
  },
  {
    label: 'Detection Engineering',
    items: ['YARA', 'Sigma', 'KQL', 'Suricata / Zeek', 'Sysmon', 'MITRE ATT&CK'],
  },
  {
    label: 'Malware Analysis & RE',
    items: ['IDA Pro', 'Ghidra', 'x64dbg', 'FLOSS', 'Volatility', 'imphash / TLSH'],
  },
  {
    label: 'Languages',
    items: ['C++', 'Python', 'Rust', 'Go', 'x86-64 asm', 'SQL'],
  },
  {
    label: 'Cloud & Infra',
    items: ['AWS', 'Azure / Entra ID', 'Docker', 'Kubernetes', 'CI/CD', 'Git'],
  },
  {
    label: 'Frameworks & Standards',
    items: ['ISO/IEC 27001', 'ISO/IEC 42001', 'PCI DSS', 'Zero Trust', 'ISC2 CC', 'DP-420'],
  },
];

// neofetch-style rows for the hero card + `neofetch` terminal command.
export const neofetch: { key: string; value: string }[] = [
  { key: 'role', value: 'Security Researcher' },
  { key: 'focus', value: 'CVE triage · malware RE · intel' },
  { key: 'stack', value: 'C++ · Python · Rust · Go · KQL' },
  { key: 'tools', value: 'IDA Pro · Ghidra · x64dbg · YARA' },
  { key: 'ships', value: 'exploitrank · Ikhor · malscope' },
  { key: 'certs', value: 'ISC2 CC · DP-420' },
];
