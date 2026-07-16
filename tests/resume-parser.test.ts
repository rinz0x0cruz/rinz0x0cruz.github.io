import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resumeSchema } from '../src/data/resume.schema';
import {
  ResumeParseError,
  extractPdfText,
  fixSpacing,
  mergeResume,
  parseResumeArgs,
  parseResumeText,
  resumeChanges,
  splitList,
} from '../scripts/lib/resume-parser.mjs';

const existing = resumeSchema.parse(
  JSON.parse(readFileSync(new URL('../src/data/resume.json', import.meta.url), 'utf8'))
);

const fixtureText = `M O H I T  S H A R M A
Punjab, India · rinz0x0cruz@gmail.com · +91 88476-80164 · linkedin.com/in/rinz0x0cruz · github.com/rinz0x0cruz
PROFESSIONAL SUMMARY
Security researcher focused on deterministic tooling.
TECHNICAL SKILLS
Detection & Response: YARA, KQL/Kusto (Azure Data Explorer),
Incident response; DFIR
PROFESSIONAL EXPERIENCE
Example Corp - Security Researcher
Detection Team · Remote · Jun 2025 – Present
Investigated threats.
PROJECTS
Example Tool - Triage Platform · Go · github.com/rinz0x0cruz/example
EDUCATION
Example University - B.Tech Jan 2021 – Jan 2025 · CGPA: 9.0
CERTIFICATIONS
ISC2 Certified in Cybersecurity (CC)
LANGUAGES
English · Hindi
`;

describe('resume parser helpers', () => {
  it('fixes letter spacing and preserves separators inside parentheses', () => {
    expect(fixSpacing('M O H I T  S H A R M A')).toBe('MOHIT SHARMA');
    expect(splitList('YARA, KQL/Kusto (Azure, ADX); DFIR')).toEqual([
      'YARA',
      'KQL/Kusto (Azure, ADX)',
      'DFIR',
    ]);
  });

  it('parses required sections, wrapped skills, dates, and URLs', () => {
    const parsed = parseResumeText(fixtureText);
    expect(parsed.basics).toMatchObject({
      name: 'MOHIT SHARMA',
      email: 'rinz0x0cruz@gmail.com',
      phone: '+91 88476-80164',
    });
    expect(parsed.skills[0].items).toEqual([
      'YARA',
      'KQL/Kusto (Azure Data Explorer)',
      'Incident response',
      'DFIR',
    ]);
    expect(parsed.work[0]).toMatchObject({ start: '2025-06', end: null, location: 'Remote' });
    expect(parsed.projects[0].url).toBe('https://github.com/rinz0x0cruz/example');
  });

  it('fails loudly when a required section is missing', () => {
    expect(() => parseResumeText(fixtureText.replace('CERTIFICATIONS', 'OTHER'))).toThrow(
      /Missing required section: CERTIFICATIONS/
    );
  });

  it('preserves curated records and fields unless removals are explicitly accepted', () => {
    const parsed = parseResumeText(fixtureText);
    const currentRole = {
      org: 'Example Corp',
      title: 'Security Researcher',
      blurb: 'Curated team name',
      location: 'Remote, United States',
      start: '2025-06',
      end: null,
      tag: 'CURRENT',
    };
    const historicRole = {
      org: 'Historic Corp',
      title: 'Intern',
      blurb: null,
      location: 'Remote',
      start: '2024-01',
      end: '2024-02',
    };
    const base = { ...existing, work: [currentRole, historicRole] };

    const preserved = mergeResume(parsed, base);
    expect(preserved.work).toHaveLength(2);
    expect(preserved.work[0]).toMatchObject({ blurb: 'Curated team name', tag: 'CURRENT' });
    expect(preserved.work[1]).toEqual(historicRole);

    const replacement = mergeResume(parsed, base, { preserveMissing: false });
    expect(replacement.work).toHaveLength(1);
    expect(resumeChanges(base, replacement)).toContainEqual(
      expect.objectContaining({ kind: 'removed', path: 'work[Historic Corp / Intern]' })
    );
  });

  it('rejects conflicting and incomplete CLI options', () => {
    expect(() => parseResumeArgs(['--write', '--check'], 'resume.pdf')).toThrow(ResumeParseError);
    expect(() => parseResumeArgs(['--pdf'], 'resume.pdf')).toThrow(/requires a file path/);
    expect(() => parseResumeArgs(['--accept-removals'], 'resume.pdf')).toThrow(/only be used with --write/);
  });
});

describe('resume schema', () => {
  it('rejects invalid months, reverse ranges, and duplicate roles', () => {
    const invalid = structuredClone(existing);
    invalid.work[0].start = '2025-13';
    invalid.work[1].start = '2026-07';
    invalid.work[1].end = '2026-06';
    invalid.work.push(structuredClone(invalid.work[2]));
    const result = resumeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join('\n');
      expect(messages).toContain('Expected a valid YYYY-MM date');
      expect(messages).toContain('Role end date cannot be before its start date');
      expect(messages).toContain('Work roles must be unique');
    }
  });
});

describe('committed resume PDF', () => {
  it('parses to the committed validated data with no semantic drift', async () => {
    const pdf = readFileSync(new URL('../public/Mohit-Sharma-Resume.pdf', import.meta.url));
    const parsed = parseResumeText(await extractPdfText(pdf));
    const merged = resumeSchema.parse(mergeResume(parsed, existing));
    expect(resumeChanges(existing, merged)).toEqual([]);
  });
});