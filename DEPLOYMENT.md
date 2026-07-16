# Deployment and Operations

The portfolio is a static Astro site deployed to GitHub Pages. There is no
runtime server, database, secret, CMS, external content fetch, or AI dependency.

## Release path

1. Create a branch and open a pull request to `main`.
2. Wait for **Validate and build** and **Dependency review**.
3. Merge after all required checks pass.
4. The workflow uploads the already-tested `dist/` directory and deploys it.
5. **Verify live deployment** waits for `build-meta.json` to report the merged
   commit, then checks the home page, writeup archive, RSS, sitemap, robots file,
   and résumé PDF.

The same deployment can be started manually from **Actions -> Portfolio CI and
Deploy -> Run workflow**. A scheduled deployment runs at 06:00 UTC on the first
day of each month to refresh current-role experience.

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
required assets and route consistency; writes `dist/build-meta.json`; and
enforces first-party JavaScript/CSS gzip budgets.

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

Writeups live only in `src/content/writeups/` and are versioned with the site.
Restore a deleted or damaged post from git history and use the normal pull
request path. The old `rinz0x0cruz/writeups` repository is deprecated and must
not be reintroduced as a build-time source.