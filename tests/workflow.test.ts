import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const deploy = parse(readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'));
const dependencyReview = parse(
  readFileSync(new URL('../.github/workflows/dependency-review.yml', import.meta.url), 'utf8')
);
const dependabot = parse(readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8'));

describe('delivery infrastructure', () => {
  it('keeps pull requests read-only and deployment jobs guarded', () => {
    expect(deploy.permissions).toEqual({ contents: 'read' });
    expect(deploy.jobs.validate.permissions).toBeUndefined();
    expect(deploy.jobs.deploy.if).toContain("github.event_name != 'pull_request'");
    expect(deploy.jobs.smoke.if).toContain("github.event_name != 'pull_request'");
    expect(deploy.jobs.deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  });

  it('uses monthly refreshes, clean installs, source validation, browser tests, and live smoke checks', () => {
    expect(deploy.on.schedule).toEqual([{ cron: '0 6 1 * *' }]);
    const validateCommands = deploy.jobs.validate.steps.map((step: { run?: string }) => step.run).filter(Boolean);
    expect(validateCommands).toEqual(
      expect.arrayContaining([
        'npm ci',
        'npm audit --omit=dev --audit-level=high',
        'npm run validate',
        'npm run build',
        'npm run verify:build',
        'npm run test:e2e',
      ])
    );
    expect(deploy.jobs.smoke.steps.at(-1).run).toBe('node scripts/smoke-deploy.mjs');
  });

  it('pins every third-party action to a full commit SHA', () => {
    const actionPattern = /^[^@]+@[0-9a-f]{40}$/;
    const actions = Object.values(deploy.jobs)
      .flatMap((job: any) => job.steps)
      .concat(...Object.values(dependencyReview.jobs).map((job: any) => job.steps))
      .map((step: { uses?: string }) => step.uses)
      .filter(Boolean);
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(action).toMatch(actionPattern);
  });

  it('enables weekly grouped npm and GitHub Actions updates', () => {
    expect(dependabot.version).toBe(2);
    expect(dependabot.updates.map((update: any) => update['package-ecosystem'])).toEqual([
      'npm',
      'github-actions',
    ]);
    for (const update of dependabot.updates) expect(update.schedule.interval).toBe('weekly');
  });
});