import { expect, test } from '@playwright/test'

test('portfolio core experience remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Mohit Sharma' })).toBeVisible()
  await expect(page.locator('.album__name')).toBeAttached()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)

  // click() scrolls the stamp into view itself; asking first only bought a second
  // wait for the element to hold still, which is what timed out on a cold runner.
  const project = page.locator('.stamp', { hasText: 'jobscope' })
  await project.click()
  await expect(page.locator('.album__name')).toHaveText('jobscope')
  await expect(project).toHaveAttribute('aria-pressed', 'true')
})

test('evidence-backed article exposes its sources', async ({ page }) => {
  await page.goto('/blog/fixed-budget-vulnerability-triage/')

  await expect(page.getByRole('heading', { name: '8,218 CVEs, 411 seats' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible()
  await expect(page.locator('.article-evidence a')).toHaveCount(5)
  const citations = await page.locator('script[type="application/ld+json"]').evaluate((node) => (
    JSON.parse(node.textContent).citation
  ))
  expect(citations).toHaveLength(5)
})

test('no-JavaScript fallback keeps primary routes available', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    javaScriptEnabled: false,
  })
  const page = await context.newPage()
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Mohit Sharma' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Résumé' })).toHaveAttribute('href', '/Mohit-Sharma-Resume.pdf')
  await expect(page.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog/')
  await context.close()
})