import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const dist = resolve('dist');
const configuredEndpoint = process.env.PUBLIC_ANALYTICS_ENDPOINT?.trim();
const connectOrigins = new Set(["'self'"]);

if (configuredEndpoint) {
  const endpoint = new URL(configuredEndpoint);
  if (endpoint.protocol !== 'https:' || !endpoint.pathname.endsWith('/api/event')) {
    throw new Error('PUBLIC_ANALYTICS_ENDPOINT must be an HTTPS /api/event URL before applying CSP.');
  }
  connectOrigins.add(endpoint.origin);
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }))).flat().sort();
}

function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)) {
    if (/\bsrc\s*=/iu.test(match[1])) continue;
    const digest = createHash('sha256').update(match[2], 'utf8').digest('base64');
    hashes.add(`'sha256-${digest}'`);
  }
  return [...hashes].sort();
}

function policyFor(html) {
  const scripts = ["'self'", ...inlineScriptHashes(html)].join(' ');
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    `script-src ${scripts}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${[...connectOrigins].join(' ')}`,
    "frame-src 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const htmlFiles = (await filesUnder(dist)).filter((path) => extname(path) === '.html');
for (const path of htmlFiles) {
  let html = await readFile(path, 'utf8');
  html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/giu, '');
  html = html.replace(/<meta\s+name="referrer"[^>]*>/giu, '');
  const policy = policyFor(html);
  const securityMeta = `<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">`;
  const viewport = /<meta\s+name="viewport"[^>]*>/iu;
  if (!viewport.test(html)) throw new Error(`${path} is missing its viewport meta tag.`);
  html = html.replace(viewport, (tag) => `${tag}${securityMeta}`);
  await writeFile(path, html, 'utf8');
}

console.log(`Applied hash-based CSP and no-referrer policy to ${htmlFiles.length} HTML files.`);