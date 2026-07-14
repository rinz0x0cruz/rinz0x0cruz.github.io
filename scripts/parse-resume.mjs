// Parse the résumé PDF into structured data for src/data/resume.json.
//
// Deterministic — no AI, no network. Reliable on the structured fields the
// portfolio actually uses (name, contact, roles + dates, skills, education,
// certs, languages); best-effort on prose. Always review the git diff after a
// --write; PDF text extraction is never perfect.
//
// Usage:
//   npm run parse:resume                # dry run — print what was parsed
//   npm run parse:resume -- --write     # merge into src/data/resume.json
//   npm run parse:resume -- --pdf <path>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { PDFParse } from 'pdf-parse';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const pdfFlag = args.indexOf('--pdf');
const pdfPath = pdfFlag >= 0 ? args[pdfFlag + 1] : join(root, 'public', 'Mohit-Sharma-Resume.pdf');
const outPath = join(root, 'src', 'data', 'resume.json');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const toYM = (mon, year) => {
  const m = MONTHS[String(mon).slice(0, 3).toLowerCase()];
  return m ? `${year}-${String(m).padStart(2, '0')}` : null;
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const httpsify = (u) => (u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`) : null);

// Undo letter-spacing artifacts in headings ("M O H I T  S H A R M A" -> "MOHIT SHARMA").
function fixSpacing(s) {
  const toks = s.trim().split(/\s+/);
  if (toks.length > 3 && toks.filter((t) => t.length === 1).length / toks.length >= 0.6) {
    return s.split(/\s{2,}/).map((w) => w.replace(/\s+/g, '')).filter(Boolean).join(' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

// Split a comma/semicolon list, ignoring separators inside parentheses.
function splitList(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const DATE = /([A-Za-z]{3,9})\.?\s+(\d{4})\s*[\u2013-]\s*(Present|([A-Za-z]{3,9})\.?\s+(\d{4}))/i;

const parser = new PDFParse({ data: readFileSync(pdfPath) });
const { text } = await parser.getText();
await parser.destroy();
const lines = text
  .split('\n')
  .map((l) => l.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const rawLines = text.split('\n').map((l) => l.replace(/\u00a0/g, ' ').replace(/^ +| +$/g, '')).filter((l) => l.trim());

const HEADERS = ['PROFESSIONAL SUMMARY', 'TECHNICAL SKILLS', 'PROFESSIONAL EXPERIENCE', 'PROJECTS', 'EDUCATION', 'CERTIFICATIONS', 'LANGUAGES'];
const idx = {};
lines.forEach((l, i) => {
  if (HEADERS.includes(l.toUpperCase())) idx[l.toUpperCase()] = i;
});
function section(name) {
  const start = idx[name];
  if (start == null) return [];
  const rest = HEADERS.map((h) => idx[h]).filter((n) => n != null && n > start);
  return lines.slice(start + 1, rest.length ? Math.min(...rest) : lines.length);
}

// --- basics ---
const contact = lines[1] || '';
const basics = {
  name: fixSpacing(rawLines[0] || lines[0] || ''),
  location: contact.split('\u00b7')[0].trim(),
  email: (contact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [null])[0],
  phone: (contact.match(/\+?\d[\d\s()-]{7,}\d/) || [null])[0]?.trim() ?? null,
  links: {
    linkedin: httpsify((contact.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/\S+/i) || [null])[0]),
    github: httpsify((contact.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/\S+/i) || [null])[0]),
  },
  summary: section('PROFESSIONAL SUMMARY').join(' ').trim(),
};

// --- skills: "Category: item, item; item (paren, ok)" possibly wrapped ---
const skills = [];
for (const l of section('TECHNICAL SKILLS')) {
  const m = l.match(/^([A-Z][A-Za-z0-9 &/]+?):\s+(.*)$/);
  if (m) skills.push({ category: m[1].trim(), _raw: m[2] });
  else if (skills.length) skills[skills.length - 1]._raw += ' ' + l;
}
for (const s of skills) {
  s.items = splitList(s._raw).map(cap);
  delete s._raw;
}

// --- work: "Org - Title" then "[team ·] location · Mon YYYY – Mon YYYY|Present" ---
const work = [];
const exp = section('PROFESSIONAL EXPERIENCE');
for (let i = 0; i < exp.length; i++) {
  const head = exp[i].match(/^(.+?)\s[-\u2013]\s(.+)$/);
  const meta = exp[i + 1] || '';
  const dm = meta.match(DATE);
  if (head && dm && meta.includes('\u00b7')) {
    const segs = meta.split('\u00b7').map((s) => s.trim());
    const dateSeg = segs.pop();
    const d = dateSeg.match(DATE);
    work.push({
      org: head[1].trim(),
      title: head[2].trim(),
      blurb: segs.length >= 2 ? segs[0] : null,
      location: segs.length ? segs[segs.length - 1] : null,
      start: toYM(d[1], d[2]),
      end: /present/i.test(d[3]) ? null : toYM(d[4], d[5]),
    });
    i++;
  }
}

// --- education (best-effort) ---
const education = [];
for (const l of section('EDUCATION')) {
  const dm = l.match(DATE);
  const parts = l.split(/\s[-\u2013]\s/);
  if (parts.length >= 2 && dm) {
    const tail = parts.slice(1).join(' - ');
    education.push({
      school: parts[0].trim(),
      degree: tail.slice(0, dm.index).trim(),
      start: toYM(dm[1], dm[2]),
      end: /present/i.test(dm[3]) ? null : toYM(dm[4], dm[5]),
      note: (l.split('\u00b7')[1] || '').trim(),
    });
  }
}

// --- certifications & languages ---
const certifications = section('CERTIFICATIONS').filter((l) => l.length > 2);
const languages = (section('LANGUAGES').join(' ').match(/[^\u00b7]+/g) || []).map((s) => s.trim()).filter(Boolean);

// --- projects (best-effort: "Name [- blurb] · Tech [· url]") ---
const projects = [];
for (const l of section('PROJECTS')) {
  if (!l.includes('\u00b7') || /\.$/.test(l)) continue; // skip description sentences
  const [headPart, ...tail] = l.split('\u00b7').map((s) => s.trim());
  const nb = headPart.match(/^(.+?)\s[-\u2013]\s(.+)$/);
  const url = tail.find((t) => /https?:\/\/|github\.com|\.\w{2,}\//i.test(t)) || null;
  projects.push({
    name: (nb ? nb[1] : headPart).trim(),
    blurb: nb ? nb[2].trim() : '',
    tech: tail.filter((t) => t !== url).join(', '),
    url: url ? (url.startsWith('http') ? url : `https://${url}`) : null,
  });
}

const parsed = { basics, work, skills, projects, education, certifications, languages };

// --- merge: keep curated presentation fields (role, blurb, tag) ---
let existing = {};
try {
  existing = JSON.parse(readFileSync(outPath, 'utf8'));
} catch {}

const merged = {
  basics: {
    ...parsed.basics,
    name: existing.basics?.name ?? parsed.basics.name,
    role: existing.basics?.role ?? parsed.basics.role ?? '',
  },
  work: parsed.work.map((r) => {
    const prev = (existing.work || []).find((e) => e.org === r.org && e.title === r.title);
    return { ...r, location: prev?.location ?? r.location, blurb: prev?.blurb ?? r.blurb ?? null, ...(prev?.tag ? { tag: prev.tag } : {}), ...(prev?.logo ? { logo: prev.logo } : {}), ...(prev?.volunteer ? { volunteer: prev.volunteer } : {}) };
  }),
  skills: parsed.skills,
  projects: parsed.projects.length ? parsed.projects : existing.projects || [],
  education: parsed.education.length ? parsed.education : existing.education || [],
  certifications: parsed.certifications,
  languages: parsed.languages,
};
// Preserve any curated roles the parser missed, so a hiccup never drops data.
for (const e of existing.work || []) {
  if (!merged.work.some((r) => r.org === e.org && r.title === e.title)) merged.work.push(e);
}

const summary = [
  `source   ${pdfPath}`,
  `name     ${merged.basics.name}`,
  `contact  ${merged.basics.email || '?'} · ${merged.basics.phone || '?'} · ${merged.basics.location || '?'}`,
  `work     ${merged.work.length} roles: ${merged.work.map((w) => `${w.org}/${w.title} (${w.start}\u2013${w.end || 'now'})`).join('; ')}`,
  `skills   ${merged.skills.length} groups, ${merged.skills.reduce((n, s) => n + s.items.length, 0)} items`,
  `projects ${merged.projects.length} · education ${merged.education.length} · certs ${merged.certifications.length} · languages ${merged.languages.length}`,
].join('\n');

console.log('\n' + summary + '\n');

if (doWrite) {
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`  wrote  src/data/resume.json  —  review with:  git diff src/data/resume.json\n`);
} else {
  console.log('  dry run. re-run with  --write  to update src/data/resume.json.\n');
}
