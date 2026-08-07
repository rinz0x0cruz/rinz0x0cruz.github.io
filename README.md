# Rinzler Portfolio

[Live portfolio](https://rinz0x0cruz.github.io/) |
[Security field notes](https://rinz0x0cruz.github.io/blog/) |
[RSS](https://rinz0x0cruz.github.io/blog/feed.xml)

Evidence-first security portfolio built with Vue and Vite. Public claims route to
inspectable projects, authoritative sources, or reproducible case studies.

The portfolio, static blog, local publishing studio, build, and tests are fully
deterministic. They do not require an AI model, API key, hosted database, or
third-party runtime service.

## Review path

1. Start with the [portfolio](https://rinz0x0cruz.github.io/) for verified outcomes,
   project boundaries, certifications, and work history.
2. Read [8,218 CVEs, 411 seats](https://rinz0x0cruz.github.io/blog/fixed-budget-vulnerability-triage/)
   for a source-linked example of technical reasoning and explicit non-claims.
3. Read [The TLP label that stopped this post](https://rinz0x0cruz.github.io/blog/publishing-malware-analysis-evidence/)
   for a data-protection and detection-engineering example.
4. Inspect this repository for the content model, static blog generator, accessibility
   coverage, and build-once GitHub Pages delivery path.

## Features

- Identity-first hero with an interactive portrait, availability state, rotating field notes, and security-discipline band.
- Expandable profile links for the résumé preview, GitHub, LinkedIn, and Gmail compose.
- Verified outcome cards with lazy-loaded Three.js instruments and static fallbacks.
- Independently lazy Helios, Sun, and Moon reliefs with pointer-driven depth and exact static artwork fallbacks.
- Keyboard-, wheel-, and drag-accessible career rail with reversible evidence cards.
- Sortable and shuffleable project stamp album with project details and public links.
- Independent, data-driven language and certification sections.
- Responsive layouts with reduced-motion, reduced-data, forced-colors, and no-JavaScript support.
- Search and social metadata with a branded preview card.
- Static Markdown blog with crawlable article routes, RSS, sitemap, and a loopback-only publishing studio.
- Tested GitHub Pages deployment with a post-deploy live smoke check.

Portfolio content is maintained as plug-in modules under `src/content/`; see
`src/content/README.md` for feature-specific fields and examples.

## Requirements

- Git.
- Node.js 22.12 or newer within the Node 22 release line, matching
   `.node-version`.
- npm 10 or newer.
- Chromium, Firefox, and WebKit binaries installed through the repository
   setup command below.
- GitHub CLI (`gh`) only when using the owner publishing studio.

## Quick start

From a new machine:

```sh
git clone https://github.com/rinz0x0cruz/rinz0x0cruz.github.io.git
cd rinz0x0cruz.github.io
npm ci
npm run setup:browsers
npm run dev
```

On Linux or in a Linux CI environment, replace the
`npm run setup:browsers` line with the command below so Playwright installs the
required system packages at the same time:

```sh
npm run setup:browsers:with-deps
```

Vite prints the local development URL. Stop the server with `Ctrl+C`.

To exercise the production artifact instead of the development server:

```sh
npm run build
npm run preview
```

`npm run build` recreates the ignored `dist/` directory. Do not edit files in
`dist/`; change the source and rebuild.

## Command reference

| Command | Purpose |
| --- | --- |
| `npm ci` | Install exactly the dependency graph in `package-lock.json`. |
| `npm run audit` | Fail on known moderate-or-higher npm dependency advisories. |
| `npm run setup:browsers` | Install the three Playwright browser engines on Windows or macOS. |
| `npm run setup:browsers:with-deps` | Install all browser engines plus supported Linux system packages. |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Build the portfolio and all static blog artifacts into `dist/`. |
| `npm run preview` | Serve the current `dist/` production artifact locally. |
| `npm run studio` | Start the token-protected owner blog studio on loopback. |
| `npm run test:blog` | Run blog parser, renderer, studio-server, and publisher tests. |
| `npm run test:profile` | Validate portfolio content collections and public evidence links. |
| `npm run test:unit` | Run both deterministic Node test groups. |
| `npm run test:smoke` | Build current source, then run the bounded portfolio/blog/no-JavaScript smoke suite across browser projects. |
| `npm run test:browser` | Build current source, then run the complete Playwright matrix. |
| `npm test` | Build once, then run every Node and browser check; this is the release gate. |

Playwright starts its own production preview on `127.0.0.1:4383` for browser
tests. Stop any manually started server on that port before running a browser
test command.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/App.vue` | Main portfolio composition and interaction state. |
| `src/components/` | Focused visual and interactive components. |
| `src/content/` | Data-only identity, experience, project, outcome, language, and certification records. |
| `content/blog/` | Published Markdown field notes. |
| `scripts/blog/` | Static renderer, validation, Git draft publisher, and local studio server. |
| `studio/` | Browser UI for owner-only drafting and publishing. |
| `public/` | Static media, fonts, model fallbacks, notices, and `security.txt`. |
| `test/` | Deterministic Node tests. |
| `e2e/` | Playwright portfolio and studio acceptance tests. |
| `.github/workflows/ci.yml` | Build-once GitHub Pages test, deployment, and live verification pipeline. |

## Updating portfolio content

Edit records in `src/content/`, not `src/profile.js` or the rendering
components. IDs are stable public keys, so do not rename an existing ID only to
change its display text. Follow the field table, asset rules, and validation
workflow in `src/content/README.md`.

The minimum check after a content-only edit is:

```sh
npm run test:profile
```

Run `npm test` before opening or merging a pull request.

## Writing blog posts without the studio

Published posts are ordinary Markdown files at `content/blog/<slug>.md`. A
minimal evidence-backed post looks like this:

```md
---
title: Example field note
summary: What the reader will learn and what the note does not claim.
published: 2026-08-05
tags:
   - Security research
snapshotDate: 2026-08-04
tlp: TLP:CLEAR
sources:
   - https://example.com/public-source
---

## Finding

Write the evidence separately from the inference.
```

Rules enforced by the renderer:

- Slugs use lowercase letters, numbers, and single hyphens.
- Public posts require `published`; `updated` cannot precede it.
- Tags are unique and limited to five.
- Sources are unique, credential-free HTTPS URLs and limited to twelve.
- `snapshotDate` is required when sources are present and cannot follow the
  effective post date.
- Public sharing metadata supports `TLP:CLEAR` only. Omit `snapshotDate`,
  `tlp`, and `sources` together when a post has no evidence record.
- Raw HTML and unsafe link protocols are not rendered.

Put post images in `public/blog/media/<slug>/`. A cover must remain inside that
directory and requires descriptive `coverAlt` text. Validate manual changes
with:

```sh
npm run test:blog
npm run build
```

## Owner blog studio

The studio is optional. It is a local UI around the same Markdown validation
and Git workflow; no AI or hosted editor is involved.

### First-time publishing setup

Use a real Git clone whose `origin` points at this repository, and ensure your
GitHub account has write access. Configure a Git commit identity if this clone
does not already have one:

```sh
git remote get-url origin
git config user.name "Your Name"
git config user.email "you@example.com"
gh auth login
gh auth setup-git
gh auth status
npm run studio
```

Open the exact tokenized loopback URL printed by `npm run studio`. Do not remove
the URL fragment. The random access token stays in that browser tab and is not
served in the studio HTML.

The default address is `127.0.0.1:4422`. To use another port:

```powershell
$env:BLOG_STUDIO_PORT = "4423"
npm run studio
```

```sh
BLOG_STUDIO_PORT=4423 npm run studio
```

### Draft and publish behavior

1. Saving creates or updates `draft/blog/<slug>` with an atomic Git commit and
   push lease.
2. Remote changes are protected by revision checks. If the studio reports that
   a draft changed, first preserve the unsaved correction outside the editor.
   Then reload the draft if it still exists, or reload the published post if an
   auto-merge deleted the draft branch, and reapply the correction instead of
   forcing over the remote revision.
3. Publishing uses a temporary Git worktree, installs from the lockfile, runs
   the complete release gate, rebases on `origin/main`, and pushes only if the
   draft revision is still current. Before running npm, it rejects any branch
   change outside that post and its media directory.
4. If publishing fails after the draft was saved, the editor adopts the durable
   revision. If the HTTP response is lost, it verifies the canonical post and
   selected media against the remote draft or published `main`, then resumes
   revision-bound PR tracking instead of retrying with stale state.
5. The studio opens a pull request. It queues squash auto-merge when repository
   settings allow it; otherwise it links the pull request for manual merge after
   checks pass.

Draft branches are durable but public because this repository is public. Never
save secrets, credentials, private customer data, malware, or embargoed
material in a draft.

The studio accepts PNG, JPEG, WebP, AVIF, and GIF uploads. Each file is limited
to 2 MiB; one post can upload at most eight files and 8 MiB total. `Embed video`
accepts HTTPS YouTube and Vimeo URLs. `Post card` creates a script-free link
card for any credential-free HTTPS URL. `Ctrl+S` or `Cmd+S` saves the current
draft.

## Testing

Use the narrowest relevant command while editing, then run the release gate:

```sh
npm run test:unit
npm run test:smoke
npm run audit
npm test
```

`npm run audit` contacts the npm advisory service, so it is a supply-chain gate
rather than part of the deterministic offline test command.

The full Chromium suite covers the portfolio and studio. Firefox and WebKit run
the bounded cross-browser smoke workflows. Tests also cover reduced motion,
reduced data, forced colors, no JavaScript, model/media fallbacks, responsive
containment, accessibility, stale Git revisions, and atomic publishing.

## Delivery

Pull requests run the complete test job but do not deploy. A push to `main`:

1. installs from `package-lock.json` on Node 22;
2. fails on moderate-or-higher npm dependency advisories;
3. installs the same three browser engines documented above;
4. runs `npm test`, which produces the only `dist/` artifact;
5. uploads that exact tested artifact with seven-day retention;
6. deploys it through GitHub Pages using OIDC and least-privilege job
   permissions; and
7. verifies the live portfolio, blog, feed, sitemap, robots file, social card,
   and `build-meta.json` revision against the deployed commit SHA.

GitHub Pages must use **GitHub Actions** as its source. There is no separate
manual deployment command and no environment-specific rebuild.

Local builds write `{ "revision": "local" }` to `dist/build-meta.json`.
GitHub Actions writes the exact commit SHA.

## Rollback

Source revert is the durable recovery path:

1. In the GitHub Actions deployment history, identify the failing deployment
   and the last known-good commit.
2. Create a short-lived revert branch if `main` is protected.
3. Run `git revert <bad-commit>`; do not rewrite shared history.
4. Run `npm ci`, install browsers if needed, and run `npm test`.
5. Push the revert through the same pull-request and `main` workflow.
6. Confirm the `verify` job succeeds and that
   `https://rinz0x0cruz.github.io/build-meta.json` reports the revert commit.

The retained Pages artifact helps diagnose recent releases, but recovery still
goes through a source revert so the repository and live site remain aligned.

## Troubleshooting

- **Wrong Node version:** use Node 22.12 or newer within the Node 22 release
   line and rerun `npm ci`.
- **Browser executable missing:** run `npm run setup:browsers`, or
  `npm run setup:browsers:with-deps` on Linux.
- **Port 4383 is already used during tests:** stop the existing preview process;
  Playwright owns that port while the suite runs.
- **Preview shows stale content:** run `npm run build` before `npm run preview`.
- **Studio says “token required”:** open the complete URL printed by the studio,
  including its `#token=...` fragment.
- **GitHub publishing fails:** rerun `gh auth status`, verify write permission,
  and run `gh auth setup-git`.
- **Draft revision conflict:** the editor leaves the unsaved correction visible.
   Preserve that text before confirming any reload, then open the current draft
   or published post and manually reapply it.
- **Video or 3D appears later:** this is intentional. Static artwork renders
  first; decorative video and WebGL initialize during browser idle time and are
  skipped for reduced-data or nonvisual preferences.

See `SECURITY.md` for vulnerability reporting and scope.
