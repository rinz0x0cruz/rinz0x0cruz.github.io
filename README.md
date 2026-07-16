# rinz0x0cruz.github.io

Personal portfolio of **Mohit Sharma** (`@rinz0x0cruz`) — Security Researcher.
Built with [Astro](https://astro.build), organized as an identity-first research
portfolio with live project demos, and deployed to GitHub Pages.

Live: <https://rinz0x0cruz.github.io>

## Stack

- Astro 7 (static output) + TypeScript
- No client framework — vanilla JS powers the project reel, theme control, and optional terminal
- Self-hosted IBM Plex Sans, Barlow Semi Condensed, and IBM Plex Mono typography
- Responsive light/dark interface with real, interactive dashboard previews
- Identity, operational outcomes, systems, carousel casework, concise experience, public practice profiles, credentials, data-backed blogs, and contact
- Keyboard-accessible project frames with contained telemetry, hotspots, and reduced-motion support
- Sitemap, RSS, and JSON-LD `Person` / `BlogPosting` structured data for SEO

## Develop

```bash
npm ci
npm run dev      # http://localhost:4321
npm run validate
npm run build    # -> dist/
npm run verify:build
npm run preview
npm run test:e2e
npm run parse:resume -- --write   # refresh résumé data from the PDF
```

Use Node 24.18.0 (see [`.node-version`](.node-version)). Install the Playwright
browser once with `npx playwright install chromium` before running E2E tests.

## Structure

- `src/pages/` — routes (`index`, `writeups/`, `rss.xml`, `404`)
- `src/components/` — standalone homepage sections, shared navigation, project cinema, writing/contact, and optional `Terminal`
- `src/content/writeups/` — authoritative Markdown writeups content collection
- `src/data/portfolio.ts` — authored homepage content (outcomes, demos, casework, and public profiles)
- `src/data/projects.ts` — broader project/system inventory
- `src/data/resume.json` — validated résumé-derived roles, skills, credentials, education, and languages
- `public/` — `robots.txt`, `og.png`, favicon, résumé PDF

## Homepage composition

The homepage is a section registry in [`src/pages/index.astro`](src/pages/index.astro).
Reorder, add, or remove a section by changing the `homepageSections` array. The
sections themselves are independent Astro components and consume one of three
content sources:

- Authored portfolio claims and snapshots: [`src/data/portfolio.ts`](src/data/portfolio.ts)
- Project catalog: [`src/data/projects.ts`](src/data/projects.ts)
- Résumé facts: [`src/data/resume.json`](src/data/resume.json)

TryHackMe and LeetCode metrics are dated public-profile snapshots, not runtime
API dependencies. Update their values and `verifiedAt` labels in `portfolio.ts`.
The deterministic site still builds and works without network access.

### Adding homepage content

Repeated content is data-driven and layouts auto-fit new entries. Append data;
do not duplicate or edit a component:

| Homepage area | Add or edit here |
| --- | --- |
| Identity focus rotation | `intro.currentFocus` in `src/data/portfolio.ts` |
| Identity social links | Add a `site.socials` entry in `src/data/site.ts`; set `featured: true` to show it in the name card |
| Operational outcomes | `achievements` in `src/data/portfolio.ts` |
| Interactive project reel | `projectDemos` in `src/data/portfolio.ts`; set `catalogProject` to the matching `projects.ts` name and provide its image/theme data |
| Other systems | `projects` in `src/data/projects.ts`; projects referenced by a demo are excluded automatically |
| Casework carousel | `caseStudies` in `src/data/portfolio.ts`; any number of evidence steps is supported |
| About capabilities | `about.capabilities` in `src/data/portfolio.ts` |
| Experience, education, credentials, languages | `src/data/resume.json` or the deterministic résumé parser |
| Public practice profiles and metrics | `publicProfiles` in `src/data/portfolio.ts` |
| Blogs | Add a validated Markdown file under `src/content/writeups/` |
| Entire homepage sections | Add the component import and one entry to `homepageSections` in `src/pages/index.astro` |

The unit and Playwright suites derive expected counts from these same data
sources, so a new item automatically joins validation and carousel traversal.

## Résumé-driven data

The service-record section (roles, dates, and the computed "time in field"
figure) is generated from [`src/data/resume.json`](src/data/resume.json), the
single source of truth for résumé content. Edit that file directly, or
regenerate it from the résumé PDF (`public/Mohit-Sharma-Resume.pdf`):

```bash
npm run parse:resume                              # dry run with semantic diff
npm run check:resume                              # fail when PDF and JSON drift
npm run parse:resume -- --write                   # validated, non-destructive merge
npm run parse:resume -- --write --accept-removals # intentionally remove absent records
```

The parser is deterministic (no AI, no network), validates output against the
runtime résumé schema, preserves curated presentation fields and historical
records by default, and writes atomically. Always review its semantic diff and
`git diff src/data/resume.json` before committing.

## Deployment

Pull requests run source validation, résumé drift checks, type checking, unit
tests, a production build, structured artifact verification, and desktop/mobile
Playwright + axe checks. A merge to `main` publishes the verified artifact via
GitHub Pages and waits for the live `build-meta.json` commit before smoke-testing
public endpoints. The workflow also runs on the first day of each month because
the computed "time in field" figure has month-level precision.

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for branch protection, release, incident,
and rollback procedures.

## Writing blogs

The site publishes current ExploitRank analyses from
[`src/content/writeups/`](src/content/writeups). Each post is one Markdown file
with frontmatter:

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

- **Filename &rarr; URL**: `my-post.md` publishes at `/writeups/my-post/` (the internal route name is retained for compatibility).
- **`date`** orders posts (newest first); **`draft: true`** hides one.
- Raw HTML and unsafe URL schemes are rejected before Astro renders a post.
- Run `npm run check:content` before opening a pull request. A merged post
  publishes with the portfolio; use the Actions **Run workflow** button for a
  manual rebuild.

## Crawl policy

[`public/robots.txt`](public/robots.txt) opens the portfolio to search engines
while keeping the personal tool dashboards served under this domain
(exploitrank, jobscope, …) out of search engines and web archives, and blocking
AI/LLM scrapers. `robots.txt` only binds well-behaved crawlers — it is not a
security control.
