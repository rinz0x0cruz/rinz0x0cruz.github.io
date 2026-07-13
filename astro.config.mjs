// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Canonical origin. This is a GitHub *user* Pages site, so it is served from
// the domain root — base stays '/'.
export default defineConfig({
  site: 'https://rinz0x0cruz.github.io',
  base: '/',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      // Keep drafts, the 404, and machine endpoints out of the sitemap.
      filter: (page) => !page.includes('/404') && !page.includes('/writeups/draft'),
    }),
  ],
  build: {
    format: 'directory',
  },
  compressHTML: true,
});
