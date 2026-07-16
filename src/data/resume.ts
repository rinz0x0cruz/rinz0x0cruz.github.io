// Typed accessor for the structured résumé data in resume.json.
//
// resume.json is the single source of truth for résumé-derived content. It can
// be edited by hand or regenerated from the résumé PDF with:
//     npm run parse:resume -- --write
// Components import from here so the data stays typed and in one place.
import data from './resume.json';
import { resumeSchema } from './resume.schema';

export type {
  Resume,
  ResumeBasics,
  ResumeEducation,
  ResumeLinks,
  ResumeProject,
  ResumeSkillGroup,
  WorkRole,
} from './resume.schema';

export const resume = resumeSchema.parse(data);

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
