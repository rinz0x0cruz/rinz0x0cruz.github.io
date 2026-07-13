// Scaffold a new writeup post. Usage:  npm run new:writeup -- "My Post Title"
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'writeups');

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: npm run new:writeup -- "My Post Title"');
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

if (!slug) {
  console.error('Could not derive a URL slug from that title. Try a title with letters/numbers.');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
mkdirSync(DIR, { recursive: true });
const file = join(DIR, `${slug}.md`);

if (existsSync(file)) {
  console.error(`Refusing to overwrite an existing post: src/content/writeups/${slug}.md`);
  process.exit(1);
}

const body = `---
title: ${JSON.stringify(title)}
date: ${date}
summary: ''
tags: []
draft: true
---

Write your writeup here in Markdown.

When it is ready: add a one-line \`summary\`, a few \`tags\`, flip \`draft: false\`,
then commit and push. GitHub Actions rebuilds and publishes it automatically.
`;

writeFileSync(file, body, 'utf8');
console.log(`\n  created  src/content/writeups/${slug}.md`);
console.log(`  preview  npm run dev   (drafts stay hidden until draft: false)\n`);
