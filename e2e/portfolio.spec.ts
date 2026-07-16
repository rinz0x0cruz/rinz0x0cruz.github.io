import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import matter from 'gray-matter';
import { achievements, caseStudies, projectDemos, publicProfiles } from '../src/data/portfolio';
import { projects } from '../src/data/projects';

const writeupDirectory = new URL('../src/content/writeups/', import.meta.url);
const publishedWriteupCount = readdirSync(writeupDirectory)
  .filter((file) => file.endsWith('.md'))
  .filter((file) => !matter(readFileSync(new URL(file, writeupDirectory), 'utf8')).data.draft)
  .length;
const demoProjectNames = new Set(projectDemos.map((demo) => demo.catalogProject));
const systemProjectCount = projects.filter((project) => !demoProjectNames.has(project.name)).length;
const progressText = (index: number, total: number) =>
  `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function expectAccessible(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
}

test('home, archive, article, and 404 routes stay healthy', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Mohit Sharma');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://rinz0x0cruz.github.io/');

  await page.goto('/writeups/');
  await expect(page.locator('h1')).toContainText('Signals, decisions');
  await expect(page.locator('.wlist > li')).toHaveCount(publishedWriteupCount);
  const articleLink = page.locator('main a[href^="/writeups/"]').first();
  const articlePath = await articleLink.getAttribute('href');
  expect(articlePath).toBeTruthy();
  await articleLink.click();
  await expect(page.locator('article h1')).toBeVisible();
  const structuredDataText = await page.locator('script[type="application/ld+json"]').textContent();
  if (!structuredDataText) throw new Error('Article JSON-LD is empty.');
  const structuredData = JSON.parse(structuredDataText);
  expect(structuredData['@graph']).toEqual(expect.arrayContaining([expect.objectContaining({ '@type': 'BlogPosting' })]));

  expect(errors).toEqual([]);
  await page.goto('/does-not-exist/');
  await expect(page.locator('h1')).toContainText('404');
  await expect(page.getByRole('link', { name: /back home/i })).toHaveAttribute('href', '/');
});

test('all home surfaces render on the initial load without motion overrides', async ({ page }) => {
  await page.goto('/');
  for (const id of ['top', 'achievements', 'work', 'systems', 'casework', 'about', 'trajectory', 'writing']) {
    const surface = page.locator(`#${id}`);
    await expect(surface).toBeVisible();
    await expect(surface).toHaveCSS('opacity', '1');
  }
});

test('repeated homepage layouts absorb an additional item without overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const repeatedLayouts = [
    ['#achievements .outcome-grid', 'article'],
    ['#work .project-tabs', 'button'],
    ['#systems .project-grid', 'article'],
    ['#casework .case-tabs', 'button'],
    ['#casework .case-slide.is-active .evidence-path', 'li'],
    ['#about .capability-matrix > div', 'section'],
    ['#trajectory .profile-grid', '.profile-card'],
    ['#trajectory .profile-card:first-child dl', 'div'],
    ['#writing .writing-grid', '.writing-card'],
  ] as const;

  for (const [containerSelector, itemSelector] of repeatedLayouts) {
    const container = page.locator(containerSelector);
    await container.evaluate((element, selector) => {
      const item = element.querySelector(selector);
      if (!item) throw new Error(`Missing plug-in fixture: ${selector}`);
      element.append(item.cloneNode(true));
    }, itemSelector);
    const escapedPixels = await container.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return Math.max(
        0,
        ...Array.from(element.children, (child) => {
          const childBounds = child.getBoundingClientRect();
          return Math.max(bounds.left - childBounds.left, childBounds.right - bounds.right);
        })
      );
    });
    expect(escapedPixels, containerSelector).toBeLessThanOrEqual(1);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('motion stays progressive, informative, and reduced-motion safe', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await expect(page.locator('[data-motion-ambient]')).toHaveCount(0);
  await expect(page.locator('.page-progress span')).toHaveCSS('box-shadow', 'none');
  const outcomes = page.locator('#achievements');
  await outcomes.scrollIntoViewIfNeeded();
  await expect(outcomes).toHaveAttribute('data-motion-active', 'true');
  await expect.poll(() => outcomes.locator('[data-outcome-value]').allTextContents()).toEqual(
    achievements.map((achievement) => achievement.value)
  );

  const persistentMotion = [
    { id: 'systems', selector: 'article', pseudo: '::before', name: 'system-scan' },
    { id: 'casework', selector: '.case-stage', pseudo: '::after', name: 'case-scan' },
    { id: 'about', selector: '.timeline', pseudo: '::after', name: 'timeline-signal' },
    { id: 'trajectory', selector: '.profile-card', pseudo: '::before', name: 'profile-scan' },
    { id: 'writing', selector: '.writing-card', pseudo: '::before', name: 'writing-scan' },
  ];
  for (const check of persistentMotion) {
    const section = page.locator(`#${check.id}`);
    await section.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(section).toHaveAttribute('data-motion-inview', '');
    await expect.poll(() => section.evaluate((element, motion) => {
      const target = element.querySelector(motion.selector);
      return target ? getComputedStyle(target, motion.pseudo).animationName : 'missing';
    }, check)).toContain(check.name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await page.locator('#casework').evaluate((section) => section.scrollIntoView({ block: 'center' }));
  await expect(page.locator('.nav-links a', { hasText: 'Casework' })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#casework')).toHaveAttribute('data-case-autoplay', 'true');
  const progress = await page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-progress'))
  );
  expect(progress).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('#top h1')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('[data-outcome-value]')).toHaveText(achievements.map((achievement) => achievement.value));
  await page.locator('#trajectory').evaluate((section) => section.scrollIntoView({ block: 'center' }));
  await expect.poll(() => page.locator('.profile-card').first().evaluate((card) =>
    getComputedStyle(card, '::before').animationName
  )).toBe('none');
  await expect(page.locator('#casework')).toHaveAttribute('data-case-autoplay', 'false');
  const reducedOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(reducedOverflow).toBeLessThanOrEqual(1);
});

test('project cinema fits one viewport and navigates every frame', async ({ page }) => {
  await page.goto('/');
  const cinema = page.locator('[data-cinema]');
  const stage = cinema.locator('.stage');
  await expect(cinema.locator('[data-cinema-slide="0"]')).toBeVisible();
  await expect(cinema.locator('[data-cinema-slide="0"] h2')).toHaveText(projectDemos[0].name);
  await expect(cinema.locator('[data-cinema-slide="0"] img')).toHaveJSProperty('complete', true);

  await cinema.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box!.y).toBeLessThan(viewportHeight);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight + 1);

  for (let index = 0; index < projectDemos.length; index += 1) {
    if (index > 0) await cinema.getByRole('button', { name: 'Next project' }).click();
    await expect(cinema.locator(`[data-cinema-slide="${index}"] h2`)).toHaveText(projectDemos[index].name);
    await expect(cinema.locator('[data-cinema-progress]')).toHaveText(progressText(index, projectDemos.length));
  }
  await cinema.getByRole('button', { name: 'Next project' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cinema.locator('[data-cinema-slide="0"] h2')).toHaveText(projectDemos[0].name);
  await expect(cinema.locator('[data-cinema-progress]')).toHaveText(progressText(0, projectDemos.length));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('project previews are interactive but remain contained and non-navigable', async ({ page, isMobile }) => {
  await page.goto('/');
  const cinema = page.locator('[data-cinema]');
  const exploitIndex = projectDemos.findIndex((demo) => demo.catalogProject === 'exploitrank');
  const malscopeIndex = projectDemos.findIndex((demo) => demo.catalogProject === 'malscope-dashboard');
  expect(exploitIndex).toBeGreaterThanOrEqual(0);
  expect(malscopeIndex).toBeGreaterThanOrEqual(0);
  await cinema.getByRole('button', { name: projectDemos[exploitIndex].name, exact: true }).click();
  const exploitDemo = cinema.locator(`[data-cinema-slide="${exploitIndex}"] .screen`);

  await expect(exploitDemo.getByRole('button', { name: /inspect/i })).toHaveCount(projectDemos[exploitIndex].hotspots.length);
  await expect(exploitDemo.locator('a')).toHaveCount(0);
  await expect(exploitDemo.locator('.demo-surface')).toHaveCSS('overflow', 'clip');
  await expect(exploitDemo.locator('.demo-telemetry > span')).toHaveCount(projectDemos[exploitIndex].telemetry.length);
  await expect(exploitDemo.locator('.demo-activity em')).toHaveCount(projectDemos[exploitIndex].activity.length * 2);
  await expect(exploitDemo.locator('[data-demo-hotspot][data-showcase="true"]')).toHaveCount(1);
  await expect(exploitDemo.locator('.demo-surface')).toHaveAttribute('data-feature-active', 'true');
  const initialActiveX = await exploitDemo.locator('.demo-surface').evaluate((surface) =>
    surface.style.getPropertyValue('--active-x')
  );
  await expect.poll(
    () => exploitDemo.locator('.demo-surface').evaluate((surface) => surface.style.getPropertyValue('--active-x')),
    { timeout: 5_000 }
  ).not.toBe(initialActiveX);

  const firstHotspot = exploitDemo.getByRole('button', { name: /EPSS review queue/i });
  await firstHotspot.focus();
  const featurePanel = isMobile
    ? exploitDemo.locator('[data-mobile-readout]')
    : firstHotspot.locator('xpath=following-sibling::*[1]');
  await expect(featurePanel).toBeVisible();
  await firstHotspot.click();
  await expect(firstHotspot).toHaveAttribute('aria-expanded', 'true');
  await expect(featurePanel.locator('.feature-reading')).toContainText('0.91');
  await expect(featurePanel.locator('.feature-event')).toContainText('Verdict promoted to ACT');
  await expect(exploitDemo.locator('.demo-surface')).toHaveCSS('--active-x', '55%');
  await expect(exploitDemo.locator('.demo-surface')).toHaveCSS('--active-y', '53%');

  await expect.poll(async () => {
    const surfaceBox = await exploitDemo.locator('.demo-surface').boundingBox();
    const panelBox = await featurePanel.boundingBox();
    if (!surfaceBox || !panelBox) return Number.POSITIVE_INFINITY;
    return Math.max(
      surfaceBox.x - panelBox.x,
      panelBox.x + panelBox.width - (surfaceBox.x + surfaceBox.width),
      surfaceBox.y - panelBox.y,
      panelBox.y + panelBox.height - (surfaceBox.y + surfaceBox.height)
    );
  }).toBeLessThanOrEqual(1);

  await cinema.getByRole('button', { name: projectDemos[malscopeIndex].name, exact: true }).click();
  const malscopeDemo = cinema.locator(`[data-cinema-slide="${malscopeIndex}"] .screen`);
  await expect(malscopeDemo.getByRole('button', { name: /inspect/i })).toHaveCount(projectDemos[malscopeIndex].hotspots.length);
  await expect(malscopeDemo.locator('a')).toHaveCount(0);
  await expect(malscopeDemo.locator('.demo-telemetry')).toContainText(/Rules ready\s+31/);

  const coverageHotspot = malscopeDemo.getByRole('button', { name: /ATT&CK coverage/i });
  await coverageHotspot.click();
  await expect(coverageHotspot).toHaveAttribute('aria-expanded', 'true');
  await expect(coverageHotspot.locator('xpath=following-sibling::*[1]')).toContainText('YARA and Sigma');
});

test('casework carousel keeps one bounded investigation active', async ({ page }) => {
  await page.goto('/');
  const casework = page.locator('[data-casework]');
  await casework.scrollIntoViewIfNeeded();
  await expect(casework.locator('[data-case-slide="0"]')).toBeVisible();
  await expect(casework.locator('[data-case-slide="1"]')).toBeHidden();
  await expect(casework.locator('[data-case-progress]')).toHaveText(progressText(0, caseStudies.length));

  const expectActiveCaseContained = async (index: number) => {
    await expect.poll(async () => {
      const stageBox = await casework.locator('.case-stage').boundingBox();
      const layoutBox = await casework.locator(`[data-case-slide="${index}"] .case-layout`).boundingBox();
      if (!stageBox || !layoutBox) return Number.POSITIVE_INFINITY;
      return layoutBox.y + layoutBox.height - (stageBox.y + stageBox.height);
    }).toBeLessThanOrEqual(1);
  };
  for (let index = 0; index < caseStudies.length; index += 1) {
    if (index === 1) await casework.getByRole('button', { name: 'Next case' }).click();
    if (index > 1) {
      await casework.getByRole('button', { name: 'Next case' }).focus();
      await page.keyboard.press('ArrowRight');
    }
    await expect(casework.locator(`[data-case-slide="${index}"]`)).toBeVisible();
    await expect(casework.locator('[data-case-progress]')).toHaveText(progressText(index, caseStudies.length));
    await expectActiveCaseContained(index);
  }

  const stage = await casework.locator('.case-stage').boundingBox();
  expect(stage).not.toBeNull();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('shared navigation returns nested pages to home sections', async ({ page, isMobile }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/writeups/');
  if (isMobile) await page.locator('.nav-mobile summary').click();
  const navigation = isMobile ? page.locator('.nav-mobile-panel') : page.locator('.nav-links');
  await expect(navigation.getByRole('link', { name: 'Work', exact: true })).toHaveAttribute('href', '/#work');
  await navigation.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/#work$/);
  await expect(page.locator('#work')).toBeVisible();
  expect(errors).toEqual([]);
});

test('header contact action reaches the contact section from primary routes', async ({ page }) => {
  for (const path of ['/', '/writeups/']) {
    await page.goto(path);
    const contactAction = page.locator('.header-actions > .contact-link');
    await expect(contactAction).toBeVisible();
    await expect(contactAction).toHaveAttribute('href', '/#contact');
    await contactAction.click();
    await expect(page).toHaveURL(/\/#contact$/);
    await expect(page.locator('#contact')).toBeVisible();
  }
});

test('writing previews open full article pages', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/');
  const preview = page.locator('.writing-card').first();
  await expect(preview).toHaveAttribute('href', /\/writeups\/.+\/$/);
  await preview.click();
  await expect(page.locator('article h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('terminal traps focus, escapes input, and closes cleanly', async ({ page, isMobile }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/');
  const opener = isMobile
    ? page.locator('.nav-mobile').locator('[data-open-terminal]')
    : page.locator('.terminal-button');
  if (isMobile) await page.locator('.nav-mobile summary').click();
  await opener.click();

  const dialog = page.getByRole('dialog', { name: 'Interactive terminal' });
  const input = dialog.getByRole('textbox');
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill('<script>alert(1)</script>');
  await input.press('Enter');
  await expect(dialog.locator('.term-output')).toContainText('<script>alert(1)</script>');
  await expect(dialog.locator('.term-output script')).toHaveCount(0);
  await input.fill('blogs');
  await input.press('Enter');
  await expect(dialog.locator('.term-output')).toContainText('How 1,929 CVEs became one review decision');
  await expect(dialog.locator('.term-output')).toContainText('One CVE, 301 ransomware signals');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const restoredOpener = isMobile
    ? page.locator('.nav-mobile summary')
    : page.locator('.terminal-button');
  await expect(restoredOpener).toBeFocused();
  expect(errors).toEqual([]);
});

test('machine endpoints and resume are available', async ({ request }) => {
  for (const path of ['/rss.xml', '/sitemap-index.xml', '/sitemap-0.xml', '/robots.txt', '/Mohit-Sharma-Resume.pdf']) {
    const response = await request.get(path);
    expect(response.ok(), `${path} returned ${response.status()}`).toBe(true);
  }
  expect(await (await request.get('/rss.xml')).text()).toContain('<rss');
  expect(await (await request.get('/sitemap-0.xml')).text()).toContain('/writeups/');
});

test('explicit theme selection overrides storage and updates browser chrome', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('portfolio-theme', 'dark'));
  await page.goto('/?scoutTheme=light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f7f4ef');

  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#20201f');
});

test('primary routes have no WCAG A/AA violations', async ({ page }) => {
  for (const path of ['/', '/writeups/', '/writeups/patch-by-exploitability-not-cvss/']) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await expectAccessible(page);
  }
});

test('homepage leads with identity and orders proof before projects and casework', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#top h1')).toHaveText('Mohit Sharma');
  await expect(page.locator('#achievements article')).toHaveCount(achievements.length);
  await expect(page.locator('#systems article')).toHaveCount(systemProjectCount);
  await expect(page.locator('#trajectory .profile-card')).toHaveCount(publicProfiles.length);
  await expect(page.locator('#trajectory')).toContainText('TryHackMe');
  await expect(page.locator('#trajectory')).toContainText('LeetCode');
  await expect(page.locator('#trajectory')).not.toContainText('Next horizon');
  await expect(page.locator('#writing .writing-card')).toHaveCount(publishedWriteupCount);

  const order = await page.locator('main > section').evaluateAll((sections) =>
    sections.map((section) => section.id)
  );
  expect(order).toEqual(['top', 'achievements', 'work', 'systems', 'casework', 'about', 'trajectory', 'writing']);
});

test('mobile composition keeps dense UI aligned and unobstructed', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only visual geometry contract.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const stageBox = await page.locator('#work .stage').boundingBox();
  expect(stageBox).not.toBeNull();
  expect(stageBox!.height).toBeLessThanOrEqual(501);

  const statBoxes = await page.locator('#about .about-stats > div').evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().toJSON())
  );
  expect(statBoxes).toHaveLength(3);
  expect(Math.max(...statBoxes.map((box) => box.top)) - Math.min(...statBoxes.map((box) => box.top))).toBeLessThanOrEqual(1);
  expect(statBoxes.at(-1)!.right).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));

  await page.locator('.nav-mobile summary').click();
  const menuBackground = await page.locator('.nav-mobile-panel').evaluate((menu) => getComputedStyle(menu).backgroundColor);
  expect(menuBackground).toMatch(/^rgb\(/);
  await page.locator('.nav-mobile summary').click();

  await page.locator('.nav-mobile summary').click();
  await page.locator('.nav-mobile [data-open-terminal]').click();
  const titleBox = await page.locator('.term-title').boundingBox();
  const lastDotBox = await page.locator('.term-bar .tl.c').boundingBox();
  const closeBox = await page.locator('.term-close').boundingBox();
  expect(titleBox).not.toBeNull();
  expect(lastDotBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(titleBox!.x).toBeGreaterThanOrEqual(lastDotBox!.x + lastDotBox!.width);
  expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(closeBox!.x + 1);
});