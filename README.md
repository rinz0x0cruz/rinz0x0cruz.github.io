# rinz0x0cruz.github.io

Personal portfolio of **Mohit Sharma** (`@rinz0x0cruz`) — Security Researcher.
Built with [Astro](https://astro.build), themed after a Tokyo Night terminal
aesthetic, and deployed to GitHub Pages.

Live: <https://rinz0x0cruz.github.io>

## Stack

- Astro 5 (static output) + TypeScript
- No client framework — a little vanilla JS powers the interactive `./terminal`
- Self-hosted fonts (JetBrains Mono, Inter)
- Sitemap, RSS, and JSON-LD `Person` structured data for SEO

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/
npm run preview
```

## Structure

- `src/pages/` — routes (`index`, `writeups/`, `rss.xml`, `404`)
- `src/components/` — Hero, Nav, project cards, the interactive `Terminal`, …
- `src/content/writeups/` — Markdown writeups (content collection)
- `src/data/` — site identity, projects, skills
- `public/` — `robots.txt`, `og.png`, favicon

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds with Astro and publishes `dist/` via GitHub Pages
(Pages **source = GitHub Actions**).

## Crawl policy

[`public/robots.txt`](public/robots.txt) opens the portfolio to search engines
while keeping the personal tool dashboards served under this domain
(exploitrank, jobscope, …) out of search engines and web archives, and blocking
AI/LLM scrapers. `robots.txt` only binds well-behaved crawlers — it is not a
security control.
