# Deployment and Operations

The portfolio is a static Astro site deployed to GitHub Pages. There is no
runtime server, database, secret, CMS, build-time content fetch, or AI
dependency. Optional self-owned analytics is a client-side enrichment and cannot
affect site behavior; its Worker/D1 service deploys separately.

## Release path

1. Create a branch and open a pull request to `main`.
2. Wait for **Validate and build** and **Dependency review**.
3. Merge after all required checks pass.
4. The workflow uploads the already-tested `dist/` directory and deploys it.
5. **Verify live deployment** waits for `build-meta.json` to report the merged
   commit, then checks the home page, writeup archive, RSS, sitemap, robots file,
  work/archive routes, generated social cards, privacy page, and résumé PDF.

The same deployment can be started manually from **Actions -> Portfolio CI and
Deploy -> Run workflow**. A scheduled deployment runs at 06:00 UTC on the first
day of each month to refresh current-role experience and enforce the 180-day
evidence-snapshot ceiling. Ordinary pull requests warn after 90 days without
blocking unrelated work.

## Local release check

```bash
npm ci
npx playwright install chromium
npm run validate
npm run build
npm run verify:build
npm run test:e2e
npm audit
```

`verify:build` parses the generated HTML, JSON-LD, RSS, and sitemaps; verifies
required work/privacy routes, social-card dimensions/uniqueness, image alt and
intrinsic dimensions, analytics event taxonomy, and route consistency; writes
`dist/build-meta.json`; and enforces JavaScript, CSS, source-image, generated
image, and social-card budgets.

Scheduled and manually dispatched runs also execute three Lighthouse audits for
the home page, one work detail, and one article. The Actions summary reports the
median performance score, LCP, CLS, and TBT. Threshold misses are advisory and
cannot block upload or deployment; field Core Web Vitals take precedence when
enough traffic exists.

## Visual baselines

Visual comparisons use reduced motion, fixed desktop/mobile viewports, local
fonts, a screenshot stylesheet, CSS-pixel scaling, and platform-specific
baselines. Generate candidates with **Actions -> Generate visual baselines ->
Run workflow**. Download the `visual-baselines-<sha>` artifact and inspect every
Ubuntu Chromium PNG before adding the Linux files under
`e2e/visual.spec.ts-snapshots/`.

Windows baseline files are ignored because rendering differs by OS. Never
promote a baseline only to make a failed comparison green; tie it to an
intentional reviewed UI change. The manual generator never writes back to the
repository. The required **Visual regression** job builds a fixed-date fixture
and compares the reviewed Linux set before Pages can deploy; production keeps
its real `BUILD_DATE` in the separate validated artifact.

## Optional analytics configuration

After deploying `portfolio-analytics`, add the repository Actions variable
`PUBLIC_ANALYTICS_ENDPOINT` with its HTTPS `/api/event` URL. Do not store it as
a secret and do not add a hardcoded fallback. A missing variable intentionally
produces no analytics client. DNT/GPC visitors produce no collector request.

Set `PUBLIC_ANALYTICS_ENGAGEMENT=true` only after the Worker version accepting
the engagement taxonomy is live. This independent flag enables coarse section,
manual evidence, article-progress, and broad landing-source aggregates. Set it
to `false` for an immediate rollback that preserves ordinary pageviews and
commands. Both variables are non-secret repository Actions variables.

The allowed custom events are `contact_click`, `resume_download`,
`project_live`, `project_source`, `work_detail_open`, and `blog_open`. Properties
are restricted to route, stable content ID, and placement. Verify activation in
the provider's live dashboard without sending test events from real visitor
sessions.

The engagement taxonomy is `section_engaged`, `content_interaction`,
`article_progress`, `campaign_visit`, `campaign_attention`, and
`campaign_action`. Campaign values come from the source allowlist in
`src/data/analytics.ts`; do not add company, vacancy, recipient, or application
identifiers. Deploy the backend first, validate its immutable Worker version,
then enable the portfolio flag.

## Repository settings

Configure these after the first pull request has produced the new check names:

- Protect `main` with a repository ruleset.
- Require pull requests and the **Validate and build** check.
- Require **Dependency review** when dependency manifests change, if GitHub
  exposes it as a required check for the repository plan.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Require zero independent approvals for this solo repository.
- Keep an owner bypass for emergency restoration.
- Restrict the `github-pages` environment deployment branch to `main`.

Do not configure a required check before that check has run once; GitHub cannot
resolve a status context that does not yet exist.

## Failure behavior

- A source, test, build, accessibility, or artifact failure prevents upload.
- A failed pre-deploy run leaves the last successful Pages artifact live.
- A failed smoke check means deployment completed but the expected commit or a
  public endpoint was not observable within the retry window. Inspect the job
  summary and Pages deployment before retrying.
- Scheduled workflow failures use the repository owner's normal GitHub Actions
  notification settings; enable email notifications for failed workflows.

## Rollback

Use a revert pull request so rollback receives the same validation as any other
release:

```bash
git revert <bad-commit>
git push -u origin <rollback-branch>
gh pr create --fill
```

Merge the green revert PR. For an urgent outage, use the owner ruleset bypass to
merge the revert, then restore normal protection immediately. Avoid maintaining
a separate rollback workflow that can deploy untested historical dependencies.

## Content recovery

Writeups live in `src/content/writeups/`; long-form project/case evidence lives
in `src/content/work/`; canonical work images live in `src/assets/work/`. Restore
deleted or damaged content from git history and use the normal pull-request
path. The old `rinz0x0cruz/writeups` repository is deprecated and must not be
reintroduced as a build-time source.