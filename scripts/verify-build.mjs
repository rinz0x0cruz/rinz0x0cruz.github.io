import { appendFile, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import sharp from 'sharp';
import { inlineScriptHashes } from './lib/html-security.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const origin = 'https://rinz0x0cruz.github.io';
const budgets = {
  jsGzipBytes: 60 * 1024,
  cssGzipBytes: 32 * 1024,
  largestJsGzipBytes: 52 * 1024,
  sourceWorkImagesBytes: 1024 * 1024,
  largestSourceWorkImageBytes: 350 * 1024,
  generatedWorkImagesBytes: 1536 * 1024,
  largestGeneratedWorkImageBytes: 300 * 1024,
  socialCardsBytes: 750 * 1024,
  largestSocialCardBytes: 180 * 1024,
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
const workFiles = htmlFiles.filter((path) => {
  const relativePath = relative(dist, path).split(sep).join('/');
  return relativePath.startsWith('work/') && relativePath !== 'work/index.html';
});
const required = [
  'index.html',
  '404.html',
  'privacy/index.html',
  'writeups/index.html',
  'work/index.html',
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
const workRoutes = new Set(workFiles.map(routeFor));
if (!workRoutes.size) throw new Error('Build produced no published work routes.');
const allowedAnalyticsEvents = new Set([
  'contact_click',
  'resume_download',
  'project_live',
  'project_source',
  'work_detail_open',
  'blog_open',
]);
const allowedAnalyticsSections = new Set([
  'top',
  'achievements',
  'work',
  'systems',
  'casework',
  'about',
  'trajectory',
  'writing',
  'contact',
  'summary',
  'visual_evidence',
  'evidence',
  'narrative',
  'article_intro',
  'article_body',
]);
const expectedSections = {
  '/': ['top', 'achievements', 'work', 'systems', 'casework', 'about', 'trajectory', 'writing', 'contact'],
  work: ['summary', 'visual_evidence', 'evidence', 'narrative'],
  writeup: ['article_intro', 'article_body'],
};

function socialImageForRoute(route) {
  if (route.startsWith('/work/') && route !== '/work/') {
    return `${origin}/social/work/${route.split('/').filter(Boolean).at(-1)}.png`;
  }
  if (route.startsWith('/writeups/') && route !== '/writeups/') {
    return `${origin}/social/writeups/${route.split('/').filter(Boolean).at(-1)}.png`;
  }
  return undefined;
}

for (const path of htmlFiles) {
  const html = await readFile(path, 'utf8');
  const route = routeFor(path);
  const $ = cheerio.load(html);
  const contentSecurityPolicy = $('meta[http-equiv="Content-Security-Policy"]').attr('content');
  if (!contentSecurityPolicy) throw new Error(`${route}: Content Security Policy meta is missing.`);
  for (const directive of ["default-src 'self'", "base-uri 'none'", "object-src 'none'", "script-src-attr 'none'", "frame-src 'none'", "upgrade-insecure-requests"]) {
    if (!contentSecurityPolicy.includes(directive)) throw new Error(`${route}: CSP is missing ${directive}.`);
  }
  if (contentSecurityPolicy.includes("script-src 'self' 'unsafe-inline'")) {
    throw new Error(`${route}: CSP allows unsafe inline scripts.`);
  }
  for (const hash of inlineScriptHashes(html)) {
    if (!contentSecurityPolicy.includes(hash)) throw new Error(`${route}: CSP is missing inline script hash ${hash}.`);
  }
  if ($('meta[name="referrer"]').attr('content') !== 'no-referrer') {
    throw new Error(`${route}: no-referrer meta policy is missing.`);
  }
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
  const structuredData = JSON.parse($('script[type="application/ld+json"]').first().text());
  const graph = asArray(structuredData['@graph']);
  for (const image of $('main img').toArray()) {
    const width = Number($(image).attr('width'));
    const height = Number($(image).attr('height'));
    const alt = $(image).attr('alt');
    if (!(width > 0) || !(height > 0)) throw new Error(`${route}: image is missing intrinsic dimensions.`);
    if (!alt?.trim()) throw new Error(`${route}: image is missing alternative text.`);
  }
  for (const element of $('[data-analytics-event]').toArray()) {
    const event = $(element).attr('data-analytics-event');
    const contentId = $(element).attr('data-analytics-id');
    const placement = $(element).attr('data-analytics-placement');
    if (!allowedAnalyticsEvents.has(event)) throw new Error(`${route}: unapproved analytics event "${event}".`);
    if (!/^[a-z0-9_-]+$/.test(contentId || '')) throw new Error(`${route}: analytics content ID is missing or unbounded.`);
    if (!/^[a-z0-9_-]+$/.test(placement || '')) throw new Error(`${route}: analytics placement is missing or unbounded.`);
    const analyticsAttributes = Object.keys(element.attribs).filter((name) => name.startsWith('data-analytics-'));
    if (analyticsAttributes.some((name) => !['data-analytics-event', 'data-analytics-id', 'data-analytics-placement'].includes(name))) {
      throw new Error(`${route}: analytics command includes an unapproved property.`);
    }
  }
  const sections = $('[data-analytics-section]').toArray().map((element) => $(element).attr('data-analytics-section'));
  if (sections.some((section) => !allowedAnalyticsSections.has(section))) {
    throw new Error(`${route}: engagement analytics includes an unapproved section marker.`);
  }
  if (new Set(sections).size !== sections.length) {
    throw new Error(`${route}: engagement analytics section markers must be unique per page.`);
  }
  const requiredSections = route === '/'
    ? expectedSections['/']
    : route.startsWith('/work/') && route !== '/work/'
      ? expectedSections.work
      : route.startsWith('/writeups/') && route !== '/writeups/'
        ? expectedSections.writeup
        : [];
  if (requiredSections.some((section) => !sections.includes(section))) {
    throw new Error(`${route}: engagement analytics section coverage is incomplete.`);
  }
  for (const hotspot of $('[data-analytics-hotspot]').toArray()) {
    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test($(hotspot).attr('data-analytics-hotspot') || '')) {
      throw new Error(`${route}: analytics hotspot ID is missing or unbounded.`);
    }
  }
  if (route === '/') {
    const profilePage = graph.find((entry) => entry['@type'] === 'ProfilePage');
    if (!profilePage || profilePage.mainEntity?.['@id'] !== `${origin}/#person`) {
      throw new Error('/: ProfilePage JSON-LD is missing its Person mainEntity.');
    }
    if (asArray(profilePage.hasPart).length !== articleRoutes.size + workRoutes.size) {
      throw new Error('/: ProfilePage hasPart does not match published work and writeups.');
    }
  }
  if (route.startsWith('/writeups/') && route !== '/writeups/') {
    const article = graph.find((entry) => entry['@type'] === 'BlogPosting');
    if (!article || article.mainEntityOfPage !== canonical) {
      throw new Error(`${route}: BlogPosting JSON-LD is missing or has the wrong canonical URL.`);
    }
    if (article.author?.url !== origin || !article.datePublished) {
      throw new Error(`${route}: BlogPosting author URL or publication date is missing.`);
    }
  }
  if (route.startsWith('/work/') && route !== '/work/') {
    if (!$('meta[property="og:image:alt"]').attr('content')?.trim()) {
      throw new Error(`${route}: work detail is missing og:image:alt.`);
    }
    if (!$('a[href="/#contact"]').length) throw new Error(`${route}: work detail is missing its contact path.`);
    const work = graph.find((entry) => ['SoftwareSourceCode', 'CreativeWork'].includes(entry['@type']));
    if (!work || work.mainEntityOfPage !== canonical || work.image?.url !== socialImageForRoute(route)) {
      throw new Error(`${route}: work JSON-LD is missing its canonical page or social image.`);
    }
    if (work['@type'] === 'SoftwareSourceCode' && (!work.codeRepository || !asArray(work.programmingLanguage).length)) {
      throw new Error(`${route}: SoftwareSourceCode repository or language metadata is missing.`);
    }
    if (work['@type'] === 'CreativeWork' && (!work.contentReferenceTime || work.isAccessibleForFree !== true)) {
      throw new Error(`${route}: CreativeWork reference time or access metadata is missing.`);
    }
  }
  const expectedSocialImage = socialImageForRoute(route);
  if (expectedSocialImage) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    const ogAlt = $('meta[property="og:image:alt"]').attr('content');
    const twitterAlt = $('meta[name="twitter:image:alt"]').attr('content');
    if (ogImage !== expectedSocialImage || twitterImage !== expectedSocialImage) {
      throw new Error(`${route}: social image URL does not match its generated route card.`);
    }
    if (ogAlt !== twitterAlt || !ogAlt?.trim()) throw new Error(`${route}: social image alt text is missing or inconsistent.`);
    if (
      $('meta[property="og:image:type"]').attr('content') !== 'image/png' ||
      $('meta[property="og:image:width"]').attr('content') !== '1200' ||
      $('meta[property="og:image:height"]').attr('content') !== '630'
    ) {
      throw new Error(`${route}: social image type or dimensions are incorrect.`);
    }
    if (!relativeFiles.has(new URL(expectedSocialImage).pathname.slice(1))) {
      throw new Error(`${route}: generated social image is missing from the artifact.`);
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
for (const route of ['/', '/privacy/', '/writeups/', '/work/', ...articleRoutes, ...workRoutes]) {
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

const imageExtensions = new Set(['.avif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
async function imageInventory(paths) {
  const images = [];
  for (const path of paths.filter((file) => imageExtensions.has(extname(file)))) {
    images.push({ path: relative(root, path).split(sep).join('/'), bytes: (await stat(path)).size });
  }
  return {
    files: images,
    totalBytes: images.reduce((sum, image) => sum + image.bytes, 0),
    largestBytes: Math.max(0, ...images.map((image) => image.bytes)),
  };
}

const sourceWorkImages = await imageInventory(await filesUnder(join(root, 'src', 'assets', 'work')));
const generatedWorkImages = await imageInventory(
  files.filter((path) => relative(dist, path).split(sep).join('/').startsWith('_astro/')),
);
const socialCardPaths = files.filter((path) => {
  const artifactPath = relative(dist, path).split(sep).join('/');
  return artifactPath.startsWith('social/') && extname(path) === '.png';
});
const socialCards = await imageInventory(socialCardPaths);
if (sourceWorkImages.totalBytes > budgets.sourceWorkImagesBytes) {
  throw new Error(`Source work images total ${sourceWorkImages.totalBytes} exceeds ${budgets.sourceWorkImagesBytes}.`);
}
if (sourceWorkImages.largestBytes > budgets.largestSourceWorkImageBytes) {
  throw new Error(`Largest source work image ${sourceWorkImages.largestBytes} exceeds ${budgets.largestSourceWorkImageBytes}.`);
}
if (generatedWorkImages.totalBytes > budgets.generatedWorkImagesBytes) {
  throw new Error(`Generated work images total ${generatedWorkImages.totalBytes} exceeds ${budgets.generatedWorkImagesBytes}.`);
}
if (generatedWorkImages.largestBytes > budgets.largestGeneratedWorkImageBytes) {
  throw new Error(`Largest generated work image ${generatedWorkImages.largestBytes} exceeds ${budgets.largestGeneratedWorkImageBytes}.`);
}
if (socialCards.files.length !== articleRoutes.size + workRoutes.size) {
  throw new Error('Generated social card count does not match published work and writeup routes.');
}
if (socialCards.totalBytes > budgets.socialCardsBytes) {
  throw new Error(`Social cards total ${socialCards.totalBytes} exceeds ${budgets.socialCardsBytes}.`);
}
if (socialCards.largestBytes > budgets.largestSocialCardBytes) {
  throw new Error(`Largest social card ${socialCards.largestBytes} exceeds ${budgets.largestSocialCardBytes}.`);
}
const socialCardHashes = new Set();
for (const path of socialCardPaths) {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== 1200 || metadata.height !== 630 || metadata.format !== 'png') {
    throw new Error(`${relative(dist, path)}: social card must be a 1200x630 PNG.`);
  }
  socialCardHashes.add(createHash('sha256').update(await readFile(path)).digest('hex'));
}
if (socialCardHashes.size !== socialCardPaths.length) throw new Error('Every published route needs a unique social card.');

const metadata = {
  schemaVersion: 1,
  commit: process.env.GITHUB_SHA || process.env.BUILD_SHA || 'local',
  buildDate: process.env.BUILD_DATE || new Date().toISOString().slice(0, 10),
  writeupCount: articleRoutes.size,
  workCount: workRoutes.size,
  htmlPageCount: htmlFiles.length,
  assets: { js, css, largestJsGzipBytes, sourceWorkImages, generatedWorkImages, socialCards, files: assets },
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
      `- Published work details: ${metadata.workCount}`,
      `- JavaScript: ${js.gzipBytes} bytes gzip`,
      `- CSS: ${css.gzipBytes} bytes gzip`,
      '',
    ].join('\n'),
    'utf8'
  );
}

console.log(
  `Verified ${metadata.htmlPageCount} HTML pages, ${metadata.writeupCount} writeups, and ${metadata.workCount} work details. ` +
    `JS ${js.gzipBytes} B gzip; CSS ${css.gzipBytes} B gzip.`
);