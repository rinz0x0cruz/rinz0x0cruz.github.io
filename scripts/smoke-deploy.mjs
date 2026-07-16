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
  { path: '', includes: ['ProfilePage', '/work/exploitrank/', 'data-analytics-event="work_detail_open"'] },
  { path: 'work/', includes: ['Systems and investigations', '/work/midnight-blizzard/'] },
  { path: 'work/exploitrank/', includes: ['SoftwareSourceCode', '/social/work/exploitrank.png', 'href="/#contact"'] },
  { path: 'work/midnight-blizzard/', includes: ['CreativeWork', 'Disclosure boundary', 'href="/#contact"'] },
  { path: 'writeups/', includes: ['Signals, decisions', 'data-analytics-event="blog_open"'] },
  { path: 'privacy/', includes: ['Measure the work, not the visitor', 'Global Privacy Control'] },
  { path: 'rss.xml' },
  { path: 'sitemap-index.xml' },
  { path: 'robots.txt' },
  { path: 'Mohit-Sharma-Resume.pdf' },
];
for (const endpoint of endpoints) {
  const response = await fetchFresh(endpoint.path);
  const url = new URL(endpoint.path, baseUrl).href;
  if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
  const body = await response.arrayBuffer();
  if (!body.byteLength) throw new Error(`${url} returned an empty body.`);
  if (endpoint.includes) {
    const text = new TextDecoder().decode(body);
    for (const expected of endpoint.includes) {
      if (!text.includes(expected)) throw new Error(`${url} is missing expected content: ${expected}`);
    }
  }
}

const socialCards = [
  'social/work/exploitrank.png',
  'social/work/midnight-blizzard.png',
  'social/writeups/patch-by-exploitability-not-cvss.png',
];
for (const path of socialCards) {
  const response = await fetchFresh(path);
  const url = new URL(path, baseUrl).href;
  if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
  if (response.headers.get('content-type') !== 'image/png') throw new Error(`${url} is not served as image/png.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || pngSignature.some((byte, index) => bytes[index] !== byte)) {
    throw new Error(`${url} is not a valid PNG.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width !== 1200 || height !== 630) throw new Error(`${url} is ${width}x${height}; expected 1200x630.`);
}

const summary = [
  '## Deployment verified',
  '',
  `- URL: ${baseUrl.href}`,
  `- Commit: \`${metadata.commit}\``,
  `- Build date: ${metadata.buildDate}`,
  `- Published writeups: ${metadata.writeupCount}`,
  `- Published work details: ${metadata.workCount}`,
  `- JavaScript: ${metadata.assets.js.gzipBytes} bytes gzip`,
  `- CSS: ${metadata.assets.css.gzipBytes} bytes gzip`,
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}
console.log(summary);