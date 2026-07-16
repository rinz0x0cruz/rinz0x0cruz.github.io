import { appendFile, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const origin = 'https://rinz0x0cruz.github.io';
const budgets = {
  jsGzipBytes: 60 * 1024,
  cssGzipBytes: 32 * 1024,
  largestJsGzipBytes: 52 * 1024,
};

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    })
  );
  return nested.flat().sort();
}

async function gzipSize(path) {
  let bytes = 0;
  await pipeline(
    createReadStream(path),
    createGzip({ level: 9 }),
    new Writable({
      write(chunk, _encoding, callback) {
        bytes += chunk.length;
        callback();
      },
    })
  );
  return bytes;
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function routeFor(path) {
  const relativePath = relative(dist, path).split(sep).join('/');
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) return `/${relativePath.slice(0, -'index.html'.length)}`;
  return `/${relativePath}`;
}

const files = await filesUnder(dist);
const htmlFiles = files.filter((path) => extname(path) === '.html');
const articleFiles = htmlFiles.filter((path) => {
  const relativePath = relative(dist, path).split(sep).join('/');
  return relativePath.startsWith('writeups/') && relativePath !== 'writeups/index.html';
});
const required = [
  'index.html',
  '404.html',
  'writeups/index.html',
  'rss.xml',
  'sitemap-index.xml',
  'sitemap-0.xml',
  'robots.txt',
  'Mohit-Sharma-Resume.pdf',
];
const relativeFiles = new Set(files.map((path) => relative(dist, path).split(sep).join('/')));
for (const path of required) {
  if (!relativeFiles.has(path)) throw new Error(`Required build artifact is missing: dist/${path}`);
}

const articleRoutes = new Set(articleFiles.map(routeFor));
if (!articleRoutes.size) throw new Error('Build produced no published writeup routes.');

for (const path of htmlFiles) {
  const html = await readFile(path, 'utf8');
  const route = routeFor(path);
  const $ = cheerio.load(html);
  const canonical = $('link[rel="canonical"]').attr('href');
  if (route !== '/404.html') {
    const expectedCanonical = new URL(route, origin).href;
    if (canonical !== expectedCanonical) {
      throw new Error(`${route}: canonical ${canonical || '(missing)'} does not match ${expectedCanonical}`);
    }
  }
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    JSON.parse($(script).text());
  }
  if (route.startsWith('/writeups/') && route !== '/writeups/') {
    const structuredData = JSON.parse($('script[type="application/ld+json"]').first().text());
    const graph = asArray(structuredData['@graph']);
    const article = graph.find((entry) => entry['@type'] === 'BlogPosting');
    if (!article || article.mainEntityOfPage !== canonical) {
      throw new Error(`${route}: BlogPosting JSON-LD is missing or has the wrong canonical URL.`);
    }
  }
}

const xml = new XMLParser({ ignoreAttributes: false });
const sitemapIndex = xml.parse(await readFile(join(dist, 'sitemap-index.xml'), 'utf8'));
const sitemapLocations = asArray(sitemapIndex.sitemapindex?.sitemap).map((entry) => entry.loc);
if (!sitemapLocations.includes(`${origin}/sitemap-0.xml`)) throw new Error('Sitemap index does not reference sitemap-0.xml.');

const sitemap = xml.parse(await readFile(join(dist, 'sitemap-0.xml'), 'utf8'));
const sitemapRoutes = new Set(
  asArray(sitemap.urlset?.url).map((entry) => new URL(entry.loc).pathname)
);
for (const route of ['/', '/writeups/', ...articleRoutes]) {
  if (!sitemapRoutes.has(route)) throw new Error(`Sitemap is missing ${route}`);
}
if (sitemapRoutes.has('/404.html')) throw new Error('Sitemap must not include the 404 page.');

const rss = xml.parse(await readFile(join(dist, 'rss.xml'), 'utf8'));
const rssRoutes = new Set(asArray(rss.rss?.channel?.item).map((item) => new URL(item.link).pathname));
if (rssRoutes.size !== articleRoutes.size || [...articleRoutes].some((route) => !rssRoutes.has(route))) {
  throw new Error('RSS items and published article routes do not match.');
}

const assets = [];
for (const path of files.filter((file) => ['.js', '.css'].includes(extname(file)))) {
  const rawBytes = (await stat(path)).size;
  assets.push({
    path: relative(dist, path).split(sep).join('/'),
    type: extname(path).slice(1),
    rawBytes,
    gzipBytes: await gzipSize(path),
  });
}
const totals = (type) => ({
  rawBytes: assets.filter((asset) => asset.type === type).reduce((sum, asset) => sum + asset.rawBytes, 0),
  gzipBytes: assets.filter((asset) => asset.type === type).reduce((sum, asset) => sum + asset.gzipBytes, 0),
});
const js = totals('js');
const css = totals('css');
const largestJsGzipBytes = Math.max(0, ...assets.filter((asset) => asset.type === 'js').map((asset) => asset.gzipBytes));
if (js.gzipBytes > budgets.jsGzipBytes) throw new Error(`JavaScript gzip total ${js.gzipBytes} exceeds ${budgets.jsGzipBytes}.`);
if (css.gzipBytes > budgets.cssGzipBytes) throw new Error(`CSS gzip total ${css.gzipBytes} exceeds ${budgets.cssGzipBytes}.`);
if (largestJsGzipBytes > budgets.largestJsGzipBytes) {
  throw new Error(`Largest JavaScript gzip asset ${largestJsGzipBytes} exceeds ${budgets.largestJsGzipBytes}.`);
}

const metadata = {
  schemaVersion: 1,
  commit: process.env.GITHUB_SHA || process.env.BUILD_SHA || 'local',
  buildDate: process.env.BUILD_DATE || new Date().toISOString().slice(0, 10),
  writeupCount: articleRoutes.size,
  htmlPageCount: htmlFiles.length,
  assets: { js, css, largestJsGzipBytes, files: assets },
};
await writeFile(join(dist, 'build-meta.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Build verified',
      '',
      `- Commit: \`${metadata.commit}\``,
      `- Build date: ${metadata.buildDate}`,
      `- HTML pages: ${metadata.htmlPageCount}`,
      `- Published writeups: ${metadata.writeupCount}`,
      `- JavaScript: ${js.gzipBytes} bytes gzip`,
      `- CSS: ${css.gzipBytes} bytes gzip`,
      '',
    ].join('\n'),
    'utf8'
  );
}

console.log(
  `Verified ${metadata.htmlPageCount} HTML pages and ${metadata.writeupCount} writeups. ` +
    `JS ${js.gzipBytes} B gzip; CSS ${css.gzipBytes} B gzip.`
);