# Rinzler Portfolio

[Live portfolio](https://rinz0x0cruz.github.io/) |
[Security field notes](https://rinz0x0cruz.github.io/blog/) |
[RSS](https://rinz0x0cruz.github.io/blog/feed.xml)

Evidence-first security portfolio built with Vue and Vite. Public claims route to
inspectable projects, authoritative sources, or reproducible case studies.

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
- Hanging Sun and Moon tarot cards rendered in one lazy Three.js canvas, with pointer-driven depth and exact static artwork fallbacks.
- Keyboard-, wheel-, and drag-accessible career rail with reversible evidence cards.
- Sortable and shuffleable project stamp album with project details and public links.
- Independent, data-driven language and certification sections.
- Responsive layouts with reduced-motion, reduced-data, forced-colors, and no-JavaScript support.
- Search and social metadata with a branded preview card.
- Static Markdown blog with crawlable article routes, RSS, sitemap, and a loopback-only publishing studio.
- Tested GitHub Pages deployment with a post-deploy live smoke check.

Portfolio content is maintained as plug-in modules under `src/content/`; see
`src/content/README.md` for feature-specific fields and examples.

## Development

Requires Node.js 22.

```sh
npm ci
npm run dev
```

### Blog publishing

Install the test browser once, confirm the GitHub CLI is authenticated, then run
the local studio:

```sh
npx playwright install chromium
gh auth status
npm run studio
```

Open the exact tokenized URL printed by the command. The per-run token is kept
in the browser tab and is not served in the studio HTML. Drafts are committed
and pushed to isolated `draft/blog/<slug>` branches. Publishing validates the
post, runs the complete test suite, and opens an owner-controlled pull request.
This repository currently requires that PR to be merged manually after its
checks pass. No GitHub token is exposed to the browser; the studio uses the
authenticated local `gh` CLI.

The repository is public, so remote draft branches are durable but not private.
Do not put secrets or embargoed material in a saved draft.

The studio can insert uploaded PNG, JPG, WebP, AVIF, and GIF files directly
into Markdown. Each file is limited to 2 MiB; a post can upload at most eight
files and 8 MiB total. `Embed video` accepts HTTPS YouTube and Vimeo URLs.
`Post card` creates a static, script-free card for any HTTPS post URL rather
than loading a provider tracking widget. Ctrl+S (or Cmd+S) saves the current
draft; the studio warns before replacing or closing an unsaved edit.

Published Markdown lives in `content/blog/`. Post media lives in
`public/blog/media/<slug>/`. Generated HTML, RSS, sitemap, and robots files are
build artifacts and are not committed.

Create a production build with `npm run build`.

Run the production browser checks with:

```sh
npx playwright install chromium
npm test
```

## Delivery and rollback

Pushes to `main` build and test `dist`, deploy that exact GitHub Pages artifact,
then verify the live portfolio, blog, RSS, sitemap, robots file, and social card.
Pages artifacts are retained for seven days for short-window recovery; source
reverts remain the durable path:

1. Identify the last known-good commit in the GitHub Actions deployment history.
2. Revert the faulty commit with `git revert <commit>`.
3. Run `npm test`.
4. Push the revert through the same CI and Pages workflow, then confirm the
	`verify` job succeeds.
