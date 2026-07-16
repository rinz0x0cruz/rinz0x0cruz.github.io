import { PDFParse } from 'pdf-parse';

export const RESUME_HEADERS = [
  'PROFESSIONAL SUMMARY',
  'TECHNICAL SKILLS',
  'PROFESSIONAL EXPERIENCE',
  'PROJECTS',
  'EDUCATION',
  'CERTIFICATIONS',
  'LANGUAGES',
];

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const DATE = /([A-Za-z]{3,9})\.?\s+(\d{4})\s*[\u2013-]\s*(Present|([A-Za-z]{3,9})\.?\s+(\d{4}))/i;

export class ResumeParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResumeParseError';
  }
}

export async function extractPdfText(data) {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export function fixSpacing(value) {
  const tokens = value.trim().split(/\s+/);
  if (tokens.length > 3 && tokens.filter((token) => token.length === 1).length / tokens.length >= 0.6) {
    return value
      .split(/\s{2,}/)
      .map((word) => word.replace(/\s+/g, ''))
      .filter(Boolean)
      .join(' ');
  }
  return value.replace(/\s+/g, ' ').trim();
}

export function splitList(value) {
  const items = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(') depth += 1;
    else if (character === ')') depth = Math.max(0, depth - 1);
    if ((character === ',' || character === ';') && depth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function toYearMonth(month, year, field) {
  const monthNumber = MONTHS[String(month).slice(0, 3).toLowerCase()];
  if (!monthNumber) throw new ResumeParseError(`Unknown month "${month}" in ${field}.`);
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function httpsify(value) {
  return value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : null;
}

function normalizedLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function rawLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/^ +| +$/g, ''))
    .filter((line) => line.trim());
}

function buildSections(lines) {
  const indexes = new Map();
  lines.forEach((line, index) => {
    const header = line.toUpperCase();
    if (RESUME_HEADERS.includes(header)) indexes.set(header, index);
  });
  const missing = RESUME_HEADERS.filter((header) => !indexes.has(header));
  if (missing.length) {
    throw new ResumeParseError(`Missing required section${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  }

  return Object.fromEntries(
    RESUME_HEADERS.map((header) => {
      const start = indexes.get(header);
      const laterIndexes = [...indexes.values()].filter((index) => index > start);
      const end = laterIndexes.length ? Math.min(...laterIndexes) : lines.length;
      return [header, lines.slice(start + 1, end)];
    })
  );
}

function parseDate(match, field) {
  return {
    start: toYearMonth(match[1], match[2], field),
    end: /present/i.test(match[3]) ? null : toYearMonth(match[4], match[5], field),
  };
}

export function parseResumeText(text) {
  if (!text.trim()) throw new ResumeParseError('The PDF contained no extractable text.');
  const lines = normalizedLines(text);
  const originalLines = rawLines(text);
  const sections = buildSections(lines);
  const contact = lines[1] || '';

  const basics = {
    name: fixSpacing(originalLines[0] || lines[0] || ''),
    location: contact.split('\u00b7')[0].trim(),
    email: (contact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [null])[0],
    phone: (contact.match(/\+?\d[\d\s()-]{7,}\d/) || [null])[0]?.trim() ?? null,
    links: {
      linkedin: httpsify((contact.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/\S+/i) || [null])[0]),
      github: httpsify((contact.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/\S+/i) || [null])[0]),
    },
    summary: sections['PROFESSIONAL SUMMARY'].join(' ').trim(),
  };

  const skills = [];
  for (const line of sections['TECHNICAL SKILLS']) {
    const match = line.match(/^([A-Z][A-Za-z0-9 &/]+?):\s+(.*)$/);
    if (match) skills.push({ category: match[1].trim(), raw: match[2] });
    else if (skills.length) skills[skills.length - 1].raw += ` ${line}`;
  }
  const parsedSkills = skills.map(({ category, raw }) => ({
    category,
    items: splitList(raw).map(capitalize),
  }));

  const work = [];
  const experience = sections['PROFESSIONAL EXPERIENCE'];
  for (let index = 0; index < experience.length; index += 1) {
    const heading = experience[index].match(/^(.+?)\s[-\u2013]\s(.+)$/);
    const metadata = experience[index + 1] || '';
    const dateMatch = metadata.match(DATE);
    if (!heading || !dateMatch || !metadata.includes('\u00b7')) continue;
    const segments = metadata.split('\u00b7').map((segment) => segment.trim());
    segments.pop();
    work.push({
      org: heading[1].trim(),
      title: heading[2].trim(),
      blurb: segments.length >= 2 ? segments[0] : null,
      location: segments.length ? segments[segments.length - 1] : null,
      ...parseDate(dateMatch, `${heading[1].trim()} / ${heading[2].trim()}`),
    });
    index += 1;
  }

  const education = [];
  for (const line of sections.EDUCATION) {
    const dateMatch = line.match(DATE);
    const parts = line.split(/\s[-\u2013]\s/);
    if (parts.length < 2 || !dateMatch) continue;
    const tail = parts.slice(1).join(' - ');
    education.push({
      school: parts[0].trim(),
      degree: tail.slice(0, dateMatch.index).trim(),
      ...parseDate(dateMatch, parts[0].trim()),
      note: (line.split('\u00b7')[1] || '').trim(),
    });
  }

  const projects = [];
  for (const line of sections.PROJECTS) {
    if (!line.includes('\u00b7') || /\.$/.test(line)) continue;
    const [heading, ...tail] = line.split('\u00b7').map((segment) => segment.trim());
    const nameAndBlurb = heading.match(/^(.+?)\s[-\u2013]\s(.+)$/);
    const url = tail.find((segment) => /https?:\/\/|github\.com|\.\w{2,}\//i.test(segment)) || null;
    projects.push({
      name: (nameAndBlurb ? nameAndBlurb[1] : heading).trim(),
      blurb: nameAndBlurb ? nameAndBlurb[2].trim() : '',
      tech: tail.filter((segment) => segment !== url).join(', '),
      url: url ? (url.startsWith('http') ? url : `https://${url}`) : null,
    });
  }

  const parsed = {
    basics,
    work,
    skills: parsedSkills,
    projects,
    education,
    certifications: sections.CERTIFICATIONS.filter((line) => line.length > 2),
    languages: (sections.LANGUAGES.join(' ').match(/[^\u00b7]+/g) || [])
      .map((value) => value.trim())
      .filter(Boolean),
  };

  const emptySections = ['work', 'skills', 'projects', 'education', 'certifications', 'languages'].filter(
    (section) => parsed[section].length === 0
  );
  if (emptySections.length) {
    throw new ResumeParseError(`Required parsed section${emptySections.length === 1 ? '' : 's'} contained no data: ${emptySections.join(', ')}.`);
  }
  return parsed;
}

function appendMissing(parsed, existing, keyOf, preserveMissing) {
  if (!preserveMissing) return parsed;
  const parsedKeys = new Set(parsed.map(keyOf));
  return [...parsed, ...existing.filter((item) => !parsedKeys.has(keyOf(item)))];
}

export function mergeResume(parsed, existing, { preserveMissing = true } = {}) {
  const parsedWork = parsed.work.map((role) => {
    const previous = (existing.work || []).find(
      (candidate) => candidate.org === role.org && candidate.title === role.title
    );
    return {
      ...role,
      location: previous?.location ?? role.location,
      blurb: previous?.blurb ?? role.blurb ?? null,
      ...(previous?.tag ? { tag: previous.tag } : {}),
      ...(previous?.logo ? { logo: previous.logo } : {}),
      ...(previous?.volunteer ? { volunteer: previous.volunteer } : {}),
    };
  });

  return {
    basics: {
      ...parsed.basics,
      name: existing.basics?.name ?? parsed.basics.name,
      role: existing.basics?.role ?? '',
    },
    work: appendMissing(
      parsedWork,
      existing.work || [],
      (role) => `${role.org}\0${role.title}`,
      preserveMissing
    ),
    skills: appendMissing(parsed.skills, existing.skills || [], (group) => group.category, preserveMissing),
    projects: appendMissing(parsed.projects, existing.projects || [], (project) => project.name, preserveMissing),
    education: appendMissing(
      parsed.education,
      existing.education || [],
      (education) => `${education.school}\0${education.degree}`,
      preserveMissing
    ),
    certifications: appendMissing(parsed.certifications, existing.certifications || [], (value) => value, preserveMissing),
    languages: appendMissing(parsed.languages, existing.languages || [], (value) => value, preserveMissing),
  };
}

function compareRecord(changes, path, previous, next) {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  for (const key of [...keys].sort()) {
    const before = previous?.[key];
    const after = next?.[key];
    const fieldPath = `${path}.${key}`;
    if (before === undefined) changes.push({ kind: 'added', path: fieldPath, after });
    else if (after === undefined) changes.push({ kind: 'removed', path: fieldPath, before });
    else if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ kind: 'changed', path: fieldPath, before, after });
    }
  }
}

function compareCollection(changes, section, previous, next, keyOf) {
  const beforeByKey = new Map(previous.map((item) => [keyOf(item), item]));
  const afterByKey = new Map(next.map((item) => [keyOf(item), item]));
  const keys = new Set([...beforeByKey.keys(), ...afterByKey.keys()]);
  for (const key of [...keys].sort()) {
    const before = beforeByKey.get(key);
    const after = afterByKey.get(key);
    const path = `${section}[${key}]`;
    if (before === undefined) changes.push({ kind: 'added', path, after });
    else if (after === undefined) changes.push({ kind: 'removed', path, before });
    else if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ kind: 'changed', path, before, after });
  }
}

export function resumeChanges(previous, next) {
  const changes = [];
  compareRecord(changes, 'basics', previous.basics, next.basics);
  compareCollection(changes, 'work', previous.work, next.work, (role) => `${role.org} / ${role.title}`);
  compareCollection(changes, 'skills', previous.skills, next.skills, (group) => group.category);
  compareCollection(changes, 'projects', previous.projects, next.projects, (project) => project.name);
  compareCollection(
    changes,
    'education',
    previous.education,
    next.education,
    (education) => `${education.school} / ${education.degree}`
  );
  compareCollection(changes, 'certifications', previous.certifications, next.certifications, (value) => value);
  compareCollection(changes, 'languages', previous.languages, next.languages, (value) => value);
  return changes;
}

export function parseResumeArgs(args, defaultPdfPath) {
  const options = { write: false, check: false, acceptRemovals: false, pdfPath: defaultPdfPath, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--check') options.check = true;
    else if (argument === '--accept-removals') options.acceptRemovals = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--pdf') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new ResumeParseError('--pdf requires a file path.');
      options.pdfPath = value;
      index += 1;
    } else {
      throw new ResumeParseError(`Unknown argument: ${argument}`);
    }
  }
  if (options.write && options.check) throw new ResumeParseError('--write and --check cannot be used together.');
  if (options.acceptRemovals && !options.write) {
    throw new ResumeParseError('--accept-removals can only be used with --write.');
  }
  return options;
}