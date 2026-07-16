import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { caseStudies, projectDemos } from '../src/data/portfolio';

const stylePath = resolve(import.meta.dirname, 'screenshot.css');
const screenshotOptions = { stylePath };

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'doNotTrack', {
      configurable: true,
      get: () => '1',
    });
  });
});

test('homepage identity and contact remain stable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#top')).toHaveScreenshot('home-identity.png', screenshotOptions);
  await expect(page.locator('#contact')).toHaveScreenshot('home-contact.png', screenshotOptions);
});

test('every Project Cinema frame remains stable', async ({ page }) => {
  await page.goto('/');
  for (let index = 0; index < projectDemos.length; index += 1) {
    await page.locator(`[data-cinema-jump="${index}"]`).click();
    const slug = projectDemos[index].projectSourceId;
    await expect(page.locator('#work .stage')).toHaveScreenshot(`project-${slug}.png`, screenshotOptions);
  }
});

test('casework and detail evidence remain stable', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-case-jump="0"]').click();
  await expect(page.locator('#casework .case-carousel')).toHaveScreenshot('casework-active.png', screenshotOptions);

  await page.goto('/work/exploitrank/');
  await expect(page.locator('.detail-head')).toHaveScreenshot('work-project-header.png', screenshotOptions);
  await expect(page.locator('.evidence-band')).toHaveScreenshot('work-project-evidence.png', screenshotOptions);

  await page.goto('/work/midnight-blizzard/');
  await expect(page.locator('.detail-head')).toHaveScreenshot('work-case-header.png', screenshotOptions);
  await expect(page.locator('.visual-band')).toHaveScreenshot('work-case-visual.png', screenshotOptions);
  await expect(page.locator('.evidence-band li')).toHaveCount(caseStudies[0].approach.length);
});

test('article presentation remains stable', async ({ page }) => {
  await page.goto('/writeups/patch-by-exploitability-not-cvss/');
  await expect(page.locator('.article > .wh')).toHaveScreenshot('article-header.png', screenshotOptions);
  await expect(page.locator('.source-ledger')).toHaveScreenshot('article-sources.png', screenshotOptions);
});