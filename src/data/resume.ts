// Typed accessor for the structured résumé data in resume.json.
//
// resume.json is the single source of truth for résumé-derived content. It can
// be edited by hand or regenerated from the résumé PDF with:
//     npm run parse:resume -- --write
// Components import from here so the data stays typed and in one place.
import data from './resume.json';

export interface ResumeLinks {
  linkedin: string;
  github: string;
}

export interface ResumeBasics {
  name: string;
  role: string;
  location: string;
  email: string;
  phone: string;
  links: ResumeLinks;
  summary: string;
}

export interface WorkRole {
  org: string;
  title: string;
  /** Optional sub-line under the title (team, or a short descriptor). */
  blurb: string | null;
  location: string;
  /** "YYYY-MM". */
  start: string;
  /** "YYYY-MM", or null for a current role. */
  end: string | null;
  /** Optional badge for non-current roles (e.g. "OSINT"). */
  tag?: string;
  /** Optional self-hosted logo path (e.g. "/logos/black-hills.png"). */
  logo?: string | null;
  /** Marks a volunteer role — shown separately from paid work experience. */
  volunteer?: boolean;
}

export interface ResumeSkillGroup {
  category: string;
  items: string[];
}

export interface ResumeProject {
  name: string;
  blurb: string;
  tech: string;
  url: string | null;
}

export interface ResumeEducation {
  school: string;
  degree: string;
  start: string;
  end: string;
  note: string;
}

export interface Resume {
  basics: ResumeBasics;
  work: WorkRole[];
  skills: ResumeSkillGroup[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  certifications: string[];
  languages: string[];
}

export const resume = data as unknown as Resume;

/** Parse a "YYYY-MM" string into a Date at the first of that month. */
export function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}

/** "May 2024", "Jun 2025" — short month + year. */
export function formatMonthYear(ym: string): string {
  return parseYearMonth(ym).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/** "Jun 2025 – Present" / "May 2024 – Jul 2024" (en-dash range). */
export function formatRange(start: string, end: string | null): string {
  return `${formatMonthYear(start)} \u2013 ${end ? formatMonthYear(end) : 'Present'}`;
}
