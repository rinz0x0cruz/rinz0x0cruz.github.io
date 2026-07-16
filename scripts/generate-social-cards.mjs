import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import sharp from 'sharp';
import { caseStudies } from '../src/data/portfolio.ts';
import { projects } from '../src/data/projects.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = join(root, 'public', 'social');
const titleFont = join(
  root,
  'node_modules',
  '@fontsource',
  'barlow-semi-condensed',
  'files',
  'barlow-semi-condensed-latin-700-normal.woff2',
);
const bodyFont = join(
  root,
  'node_modules',
  '@fontsource',
  'barlow-semi-condensed',
  'files',
  'barlow-semi-condensed-latin-600-normal.woff2',
);
const monoFont = join(
  root,
  'node_modules',
  '@fontsource',
  'ibm-plex-mono',
  'files',
  'ibm-plex-mono-latin-700-normal.woff2',
);
const projectById = new Map(projects.map((project) => [project.sourceId, project]));
const caseById = new Map(caseStudies.map((study) => [study.sourceId, study]));

function escapeMarkup(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function textOverlay({ text, font, fontfile, width, maxHeight, color, size, weight = 400, spacing = 0 }) {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}" size="${size * 1024}" weight="${weight}">${escapeMarkup(text)}</span>`,
      font,
      fontfile,
      width,
      align: 'left',
      spacing,
      rgba: true,
    },
  }).png().toBuffer({ resolveWithObject: true });
  if (info.height > maxHeight) {
    if (size <= 32) throw new Error(`Social-card text exceeds ${maxHeight}px: ${text}`);
    return textOverlay({ text, font, fontfile, width, maxHeight, color, size: size - 4, weight, spacing });
  }
  return data;
}

async function cardMedia(path) {
  return sharp(path)
    .resize(430, 338, { fit: 'contain', position: 'centre', background: '#111315' })
    .flatten({ background: '#111315' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function createCard({ output, eyebrow, title, summary, mediaPath, accent }) {
  const [media, eyebrowText, titleText, summaryText, identityText] = await Promise.all([
    cardMedia(mediaPath),
    textOverlay({
      text: eyebrow.toUpperCase(),
      font: 'IBM Plex Mono',
      fontfile: monoFont,
      width: 560,
      maxHeight: 32,
      color: accent,
      size: 18,
      weight: 700,
    }),
    textOverlay({
      text: title,
      font: 'Barlow Semi Condensed',
      fontfile: titleFont,
      width: 560,
      maxHeight: 226,
      color: '#f4f1eb',
      size: 62,
      weight: 700,
      spacing: 2,
    }),
    textOverlay({
      text: summary,
      font: 'Barlow Semi Condensed',
      fontfile: bodyFont,
      width: 560,
      maxHeight: 116,
      color: '#b8b5ae',
      size: 28,
      weight: 600,
    }),
    textOverlay({
      text: 'MOHIT SHARMA  /  SECURITY RESEARCHER',
      font: 'IBM Plex Mono',
      fontfile: monoFont,
      width: 560,
      maxHeight: 30,
      color: '#8b8881',
      size: 15,
      weight: 700,
    }),
  ]);

  const frame = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#171918"/>
      <path d="M0 0H1200V630H0Z" fill="none" stroke="#3e413f" stroke-width="2"/>
      <path d="M650 72H1128V454H650Z" fill="#111315" stroke="#5a5d59" stroke-width="2"/>
      <path d="M650 484H1128" stroke="${accent}" stroke-width="5"/>
      <path d="M72 72H112" stroke="${accent}" stroke-width="6"/>
      <path d="M72 540H602" stroke="#353835" stroke-width="2"/>
      <circle cx="1104" cy="521" r="7" fill="${accent}"/>
      <text x="650" y="533" fill="#8b8881" font-family="monospace" font-size="16">rinz0x0cruz.github.io</text>
    </svg>
  `);

  await mkdir(dirname(output), { recursive: true });
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#171918' } })
    .composite([
      { input: frame, top: 0, left: 0 },
      { input: media, top: 94, left: 674 },
      { input: eyebrowText, top: 80, left: 72 },
      { input: titleText, top: 132, left: 72 },
      { input: summaryText, top: 370, left: 72 },
      { input: identityText, top: 552, left: 72 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 90 })
    .toFile(output);
}

async function markdownFiles(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(directory, entry.name))
    .sort();
}

await rm(outputRoot, { recursive: true, force: true });
const cards = [];

for (const path of await markdownFiles(join(root, 'src', 'content', 'work'))) {
  const slug = path.split(/[\\/]/).at(-1).replace(/\.md$/, '');
  const { data } = matter(await readFile(path, 'utf8'));
  if (data.draft) continue;
  const record = data.kind === 'project' ? projectById.get(data.sourceId) : caseById.get(data.sourceId);
  if (!record) throw new Error(`${slug}: unknown ${data.kind} sourceId "${data.sourceId}"`);
  const title = data.kind === 'project' ? record.name : record.title;
  const summary = data.kind === 'project' ? record.tagline : record.summary;
  const mediaPath = resolve(dirname(path), data.heroImage);
  const output = join(outputRoot, 'work', `${slug}.png`);
  await createCard({
    output,
    eyebrow: data.kind === 'project' ? 'Built system / Deep dive' : 'Investigation / Case detail',
    title,
    summary,
    mediaPath,
    accent: data.kind === 'project' ? '#ff805f' : '#f6c945',
  });
  cards.push(output);
}

const writeupMedia = join(root, 'src', 'assets', 'work', 'exploitrank', 'hero.png');
for (const path of await markdownFiles(join(root, 'src', 'content', 'writeups'))) {
  const slug = path.split(/[\\/]/).at(-1).replace(/\.md$/, '');
  const { data } = matter(await readFile(path, 'utf8'));
  if (data.draft) continue;
  const output = join(outputRoot, 'writeups', `${slug}.png`);
  await createCard({
    output,
    eyebrow: 'Research note / ExploitRank',
    title: data.title,
    summary: data.summary,
    mediaPath: writeupMedia,
    accent: '#ff805f',
  });
  cards.push(output);
}

console.log(`Generated ${cards.length} social card${cards.length === 1 ? '' : 's'}.`);