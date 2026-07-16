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
- Shareable project/case details with responsive AVIF/WebP media and generated social cards
- Sitemap, RSS, and JSON-LD `ProfilePage`, `BlogPosting`, `SoftwareSourceCode`, and `CreativeWork` metadata
- Optional self-owned aggregate analytics that remains disabled and fail-open until configured

## Develop

```bash
npm ci
npm run dev      # http://localhost:4321
npm run validate
npm run build    # -> dist/
npm run verify:build
npm run preview
npm run test:e2e
npm run check:freshness
npm run parse:resume -- --write   # refresh résumé data from the PDF
```

Use Node 24.18.0 (see [`.node-version`](.node-version)). Install the Playwright
browser once with `npx playwright install chromium` before running E2E tests.

## Structure

- `src/pages/` — routes (`index`, `work/`, `writeups/`, `privacy`, `rss.xml`, `404`)
- `src/components/` — standalone homepage sections, shared navigation, project cinema, writing/contact, and optional `Terminal`
- `src/content/writeups/` — authoritative Markdown writeups content collection
- `src/content/work/` — long-form project and professional case evidence
- `src/assets/work/<source-id>/` — canonical screenshots and redacted evidence visuals
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
API dependencies. Update their values, `verifiedAt`, and `snapshotDate` in
`portfolio.ts`.
The deterministic site still builds and works without network access.

### Adding homepage content

Repeated content is data-driven and layouts auto-fit new entries. Append data;
do not duplicate or edit a component:

| Homepage area | Add or edit here |
| --- | --- |
| Identity focus rotation | `intro.currentFocus` in `src/data/portfolio.ts` |
| Identity social links | Add a `site.socials` entry in `src/data/site.ts`; set `featured: true` to show it in the name card |
| Operational outcomes | `achievements` in `src/data/portfolio.ts` |
| Interactive project reel | `projectDemos` in `src/data/portfolio.ts`; set `projectSourceId` to the matching `projects.ts` ID and add `src/assets/work/<source-id>/hero.*` |
| Other systems | `projects` in `src/data/projects.ts`; projects referenced by a demo are excluded automatically |
| Casework carousel | `caseStudies` in `src/data/portfolio.ts`; any number of evidence steps is supported |
| About capabilities | `about.capabilities` in `src/data/portfolio.ts` |
| Experience, education, credentials, languages | `src/data/resume.json` or the deterministic résumé parser |
| Public practice profiles and metrics | `publicProfiles` in `src/data/portfolio.ts` |
| Project/case deep dives | Add a validated Markdown file under `src/content/work/` linked by `sourceId` |
| Blogs | Add a validated Markdown file under `src/content/writeups/` with snapshot/source provenance |
| Entire homepage sections | Add the component import and one entry to `homepageSections` in `src/pages/index.astro` |

The unit and Playwright suites derive expected counts from these same data
sources, so a new item automatically joins validation and carousel traversal.

## Publishing work details

Short card/demo facts remain in `src/data/projects.ts` and
`src/data/portfolio.ts`. A Markdown file owns only the long-form evidence:

```markdown
---
kind: project
sourceId: exploitrank
published: 2026-07-16
snapshotDate: 2026-07-16
heroImage: ../../assets/work/exploitrank/hero.png
heroAlt: ExploitRank dashboard showing a bounded review queue
evidence:
  - label: Decision model
    detail: Public signals resolve into an inspectable review decision.
  - label: Offline path
    detail: The generated board remains useful without runtime services.
draft: false
---

Long-form Markdown.
```

`kind: case-study` also requires a `confidentialityNote`. One published file
automatically creates `/work/<slug>/`, its sitemap entry, a 1200×630 social
card, homepage deep link when the source is shown there, semantic JSON-LD, and
data-derived browser coverage. Missing registry IDs, duplicate IDs, missing
assets, raw HTML, unsafe links, contradictory dates, and oversized media fail
before deployment.

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
snapshotDate: 2026-07-13
summary: "One-line teaser shown in the reader, /writeups, and RSS."
tags: ["Threat Hunting", "Detection Engineering"]
sources:
  - { label: "Primary snapshot", url: "https://example.com/evidence.json", accessed: 2026-07-13 }
draft: false
---

Your post in Markdown…
```

- **Filename &rarr; URL**: `my-post.md` publishes at `/writeups/my-post/` (the internal route name is retained for compatibility).
- **`date`** orders posts; optional **`updated`** records meaningful edits;
  **`snapshotDate`** dates the evidence, and **`draft: true`** hides one.
- Published posts require at least one HTTPS evidence source with an access date.
- Raw HTML and unsafe URL schemes are rejected before Astro renders a post.
- Run `npm run check:content` before opening a pull request. A merged post
  publishes with the portfolio; use the Actions **Run workflow** button for a
  manual rebuild.

## Freshness and analytics

`npm run check:freshness` evaluates public-profile, work, and article snapshots.
Records older than 90 days are reported; only the monthly scheduled workflow
fails records older than 180 days. The reference date is deterministic in CI
through `BUILD_DATE`.

Analytics is off by default. To activate the separately deployed owner-controlled
collector, create a repository Actions variable named `PUBLIC_ANALYTICS_ENDPOINT`
containing its HTTPS `/api/event` URL. It is not a secret. Production then tracks
pageviews and only the six documented aggregate command events with route, stable
content ID, and placement. DNT/GPC prevents collection; no feature depends on it.
See `/privacy/` and
[`ACCESSIBILITY.md`](ACCESSIBILITY.md).

## Crawl policy

[`public/robots.txt`](public/robots.txt) opens the portfolio to search engines
while keeping the personal tool dashboards served under this domain
(exploitrank, jobscope, …) out of search engines and web archives, and blocking
AI/LLM scrapers. `robots.txt` only binds well-behaved crawlers — it is not a
security control.
