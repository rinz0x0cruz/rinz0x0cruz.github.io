import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projects } from '../src/data/projects';

const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');

describe('domain crawl policy', () => {
  it('blocks every internal GitHub Pages dashboard linked from projects', () => {
    const internalPaths = projects
      .map((project) => project.links.live)
      .filter((url): url is string => Boolean(url?.startsWith('https://rinz0x0cruz.github.io/')))
      .map((url) => new URL(url).pathname);

    expect(internalPaths.length).toBeGreaterThan(0);
    for (const path of internalPaths) expect(robots).toContain(`Disallow: ${path}`);
  });

  it('publishes the canonical sitemap and blocks the configured AI crawlers', () => {
    expect(robots).toContain('Sitemap: https://rinz0x0cruz.github.io/sitemap-index.xml');
    for (const crawler of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'PerplexityBot']) {
      expect(robots).toMatch(new RegExp(`User-agent: ${crawler}\\r?\\nDisallow: /`));
    }
  });
});