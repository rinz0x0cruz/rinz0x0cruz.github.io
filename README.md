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
npm run parse:resume -- --write   # refresh résumé data from the PDF
```

## Structure

- `src/pages/` — routes (`index`, `writeups/`, `rss.xml`, `404`)
- `src/components/` — Hero, Nav, project cards, the interactive `Terminal`, …
- `src/content/writeups/` — Markdown writeups (content collection); posts are synced in from the public [`rinz0x0cruz/writeups`](https://github.com/rinz0x0cruz/writeups) repo at build time
- `src/data/` — site identity, projects, skills, and `resume.json` (résumé-derived data)
- `public/` — `robots.txt`, `og.png`, favicon, résumé PDF

## Résumé-driven data

The service-record section (roles, dates, and the computed "time in field"
figure) is generated from [`src/data/resume.json`](src/data/resume.json), the
single source of truth for résumé content. Edit that file directly, or
regenerate it from the résumé PDF (`public/Mohit-Sharma-Resume.pdf`):

```bash
npm run parse:resume            # dry run — prints what it parsed
npm run parse:resume -- --write # merge into src/data/resume.json
```

The parser is deterministic (no AI, no network). It reliably extracts contact
details, roles + dates, skills, education, certifications, and languages, and
preserves curated presentation fields (role title, blurbs, badges) on merge.
Always review `git diff src/data/resume.json` before committing — PDF text
extraction is never perfect. Rebuild to see the changes on the site.

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds with Astro and publishes `dist/` via GitHub Pages
(Pages **source = GitHub Actions**). The workflow also runs on a daily schedule
(and on manual dispatch) so new writeups and the computed "time in field" figure
stay current without a code change.

## Writing writeups

Posts live in a separate public repo, **[`rinz0x0cruz/writeups`](https://github.com/rinz0x0cruz/writeups)**,
and are pulled in at build time. Each post is one Markdown file with frontmatter:

```markdown
---
title: "Your post title"
date: 2026-07-13
summary: "One-line teaser shown in the reader, /writeups, and RSS."
tags: ["Threat Hunting", "Detection Engineering"]
draft: false
---

Your post in Markdown…
```

- **Filename &rarr; URL**: `my-post.md` publishes at `/writeups/my-post/`.
- **`date`** orders posts (newest first); **`draft: true`** hides one.
- Write locally, `git push` to `rinz0x0cruz/writeups`. The portfolio picks it up
  on its next build — within a day automatically, or immediately via the Actions
  **Run workflow** button (or `gh workflow run "Deploy to GitHub Pages"`).

## Crawl policy

[`public/robots.txt`](public/robots.txt) opens the portfolio to search engines
while keeping the personal tool dashboards served under this domain
(exploitrank, jobscope, …) out of search engines and web archives, and blocking
AI/LLM scrapers. `robots.txt` only binds well-behaved crawlers — it is not a
security control.
