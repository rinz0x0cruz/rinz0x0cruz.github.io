import { appendFile, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { publicProfiles } from '../src/data/portfolio.ts';
import { evaluateFreshness } from './lib/freshness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asOf = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const strict = process.env.STRICT_FRESHNESS === 'true';
const records = publicProfiles.map((profile) => ({
  label: `Public profile / ${profile.name}`,
  snapshotDate: profile.snapshotDate,
}));

for (const collection of ['work', 'writeups']) {
  const directory = join(root, 'src', 'content', collection);
  for (const entry of (await readdir(directory)).filter((name) => name.endsWith('.md')).sort()) {
    const { data } = matter(await readFile(join(directory, entry), 'utf8'));
    if (data.draft) continue;
    records.push({
      label: `${collection === 'work' ? 'Work evidence' : 'Writeup evidence'} / ${entry.replace(/\.md$/, '')}`,
      snapshotDate: data.snapshotDate,
    });
  }
}

let result;
try {
  result = evaluateFreshness(records, asOf);
} catch (error) {
  console.error(`Freshness validation failed: ${error.message}`);
  process.exit(1);
}

if (result.warnings.length) {
  console.warn(
    `Freshness warning (${asOf}):\n- ${result.warnings
      .map((record) => `${record.label}: ${record.ageDays} days old (${record.level})`)
      .join('\n- ')}`,
  );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Evidence freshness',
      '',
      `- Reference date: ${asOf}`,
      `- Snapshots checked: ${result.records.length}`,
      `- Older than 90 days: ${result.warnings.length}`,
      `- Older than 180 days: ${result.expired.length}`,
      '',
    ].join('\n'),
    'utf8',
  );
}

if (strict && result.expired.length) {
  console.error('Scheduled freshness gate failed: refresh records older than 180 days.');
  process.exit(1);
}

console.log(`Checked ${result.records.length} evidence snapshots as of ${asOf}.`);