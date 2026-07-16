import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const reportDirectory = join(root, '.lighthouseci');
const routes = ['/', '/work/exploitrank/', '/writeups/patch-by-exploitability-not-cvss/'];
const thresholds = { performance: 90, lcp: 2500, cls: 0.1, tbt: 200 };
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
};

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function fileForRequest(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relativePath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const path = normalize(join(dist, relativePath));
  if (!path.startsWith(`${dist}${sep}`) && path !== dist) return undefined;
  try {
    if ((await stat(path)).isFile()) return path;
  } catch {}
  return undefined;
}

const server = createServer(async (request, response) => {
  const path = await fileForRequest(request.url || '/');
  if (!path) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': contentTypes[extname(path)] || 'application/octet-stream',
  });
  response.end(await readFile(path));
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Could not start the Lighthouse audit server.');
const origin = `http://127.0.0.1:${address.port}`;
const chrome = await launch({
  chromePath: process.env.CHROME_PATH || chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

const reports = [];
try {
  for (const route of routes) {
    const runs = [];
    for (let run = 0; run < 3; run += 1) {
      const result = await lighthouse(`${origin}${route}`, {
        port: chrome.port,
        logLevel: 'error',
        onlyCategories: ['performance'],
        output: 'json',
      });
      if (!result) throw new Error(`Lighthouse returned no result for ${route}.`);
      runs.push({
        performance: Math.round((result.lhr.categories.performance.score || 0) * 100),
        lcp: Math.round(result.lhr.audits['largest-contentful-paint'].numericValue || 0),
        cls: Number((result.lhr.audits['cumulative-layout-shift'].numericValue || 0).toFixed(4)),
        tbt: Math.round(result.lhr.audits['total-blocking-time'].numericValue || 0),
      });
    }
    const metrics = Object.fromEntries(
      Object.keys(runs[0]).map((metric) => [metric, median(runs.map((run) => run[metric]))]),
    );
    const warnings = [
      ...(metrics.performance < thresholds.performance ? [`performance ${metrics.performance} < ${thresholds.performance}`] : []),
      ...(metrics.lcp > thresholds.lcp ? [`LCP ${metrics.lcp}ms > ${thresholds.lcp}ms`] : []),
      ...(metrics.cls > thresholds.cls ? [`CLS ${metrics.cls} > ${thresholds.cls}`] : []),
      ...(metrics.tbt > thresholds.tbt ? [`TBT ${metrics.tbt}ms > ${thresholds.tbt}ms`] : []),
    ];
    reports.push({ route, runs, median: metrics, warnings });
  }
} finally {
  try {
    chrome.kill();
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
    console.warn(`Chrome profile cleanup skipped on Windows: ${error.path}`);
  }
  await new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
}

await mkdir(reportDirectory, { recursive: true });
await writeFile(
  join(reportDirectory, 'summary.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), thresholds, reports }, null, 2)}\n`,
  'utf8',
);

const summary = [
  '## Advisory Lighthouse medians',
  '',
  '| Route | Performance | LCP | CLS | TBT | Result |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
  ...reports.map(({ route, median: metrics, warnings }) =>
    `| ${route} | ${metrics.performance} | ${metrics.lcp} ms | ${metrics.cls} | ${metrics.tbt} ms | ${warnings.length ? warnings.join('; ') : 'within advisory targets'} |`,
  ),
  '',
  'Lab measurements are diagnostic and do not replace field Core Web Vitals.',
  '',
].join('\n');

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');