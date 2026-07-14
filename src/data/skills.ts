import { resume } from './resume';

export interface SkillGroup {
  label: string;
  items: string[];
}

// Skill groups come from the résumé (src/data/resume.json) so the toolbox stays
// in sync — regenerate with `npm run parse:resume`.
export const skillGroups: SkillGroup[] = resume.skills.map((s) => ({ label: s.category, items: s.items }));

// neofetch-style rows for the hero card + `neofetch` terminal command.
export const neofetch: { key: string; value: string }[] = [
  { key: 'role', value: 'Security Researcher' },
  { key: 'focus', value: 'CVE triage · malware RE · intel' },
  { key: 'stack', value: 'C++ · Python · Rust · Go · KQL' },
  { key: 'tools', value: 'IDA Pro · Ghidra · x64dbg · YARA' },
  { key: 'ships', value: 'exploitrank · Ikhor · malscope-dashboard' },
  { key: 'certs', value: 'ISC2 CC · DP-420' },
];
