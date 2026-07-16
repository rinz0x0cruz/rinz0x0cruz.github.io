import { appendFile } from 'node:fs/promises';

const deployUrl = process.env.DEPLOY_URL;
const expectedSha = process.env.EXPECTED_SHA;
const attempts = 18;
const delayMs = 5_000;

if (!deployUrl || !expectedSha) {
  throw new Error('DEPLOY_URL and EXPECTED_SHA are required.');
}

const baseUrl = new URL(deployUrl.endsWith('/') ? deployUrl : `${deployUrl}/`);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchFresh(path) {
  const url = new URL(path, baseUrl);
  url.searchParams.set('deploy-check', `${expectedSha}-${Date.now()}`);
  return fetch(url, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  });
}

let metadata;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetchFresh('build-meta.json');
    if (response.ok) {
      const candidate = await response.json();
      if (candidate.commit === expectedSha) {
        metadata = candidate;
        break;
      }
      console.log(`Attempt ${attempt}/${attempts}: live commit is ${candidate.commit}, waiting for ${expectedSha}.`);
    } else {
      console.log(`Attempt ${attempt}/${attempts}: build-meta.json returned ${response.status}.`);
    }
  } catch (error) {
    console.log(`Attempt ${attempt}/${attempts}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (attempt < attempts) await wait(delayMs);
}

if (!metadata) throw new Error(`Deployment did not expose commit ${expectedSha} within ${(attempts * delayMs) / 1000}s.`);

const endpoints = [
  '',
  'writeups/',
  'rss.xml',
  'sitemap-index.xml',
  'robots.txt',
  'Mohit-Sharma-Resume.pdf',
];
for (const path of endpoints) {
  const response = await fetchFresh(path);
  if (!response.ok) throw new Error(`${new URL(path, baseUrl).href} returned ${response.status}.`);
  const body = await response.arrayBuffer();
  if (!body.byteLength) throw new Error(`${new URL(path, baseUrl).href} returned an empty body.`);
}

const summary = [
  '## Deployment verified',
  '',
  `- URL: ${baseUrl.href}`,
  `- Commit: \`${metadata.commit}\``,
  `- Build date: ${metadata.buildDate}`,
  `- Published writeups: ${metadata.writeupCount}`,
  `- JavaScript: ${metadata.assets.js.gzipBytes} bytes gzip`,
  `- CSS: ${metadata.assets.css.gzipBytes} bytes gzip`,
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}
console.log(summary);