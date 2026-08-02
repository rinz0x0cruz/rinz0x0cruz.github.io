import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createStudioServer } from '../scripts/blog/studio.mjs'
import { renderIndex, validatePost } from '../scripts/blog/lib.mjs'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

let baseUrl
let server
let state

test.beforeEach(async () => {
  state = { drafts: new Map(), media: [], published: [] }
  const publisher = {
    async listPosts() {
      return { drafts: [...state.drafts.keys()], published: state.published }
    },
    async readPost(slug) {
      return state.drafts.get(slug)
    },
    async readMedia(_slug, name) {
      const entry = state.media.find((item) => item.name === name)
      if (!entry) throw new Error('Media not found.')
      return { buffer: Buffer.from(entry.data, 'base64'), contentType: 'image/png' }
    },
    async saveDraft(post, media) {
      const validated = validatePost(post, { draft: true })
      state.drafts.set(validated.slug, validated)
      state.media = media
      return { branch: `draft/blog/${validated.slug}`, sha: '0123456789abcdef', media: [] }
    },
    async publish(slug) {
      state.published.push(slug)
      return {
        branch: `draft/blog/${slug}`,
        sha: '0123456789abcdef',
        pullRequest: { number: 12, url: 'https://github.com/rinz0x0cruz/rinz0x0cruz.github.io/pull/12' },
        autoMergeQueued: true,
      }
    },
    async status(slug) {
      return {
        branch: `draft/blog/${slug}`,
        liveUrl: `https://rinz0x0cruz.github.io/blog/${slug}/`,
        pullRequest: {
          number: 12,
          url: 'https://github.com/rinz0x0cruz/rinz0x0cruz.github.io/pull/12',
          state: 'MERGED',
          statusCheckRollup: [],
        },
      }
    },
  }
  server = createStudioServer({
    publisher,
    csrf: 'browser-test-csrf',
    accessToken: 'browser-test-token',
    logger: { error() {} },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}/#token=browser-test-token`
})

test.afterEach(async () => {
  server.closeAllConnections()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

async function fillPost(page, title = 'Studio draft') {
  await page.locator('[name="title"]').fill(title)
  await page.locator('[name="summary"]').fill('A complete draft edited through the local owner studio.')
  await page.locator('[name="tags"]').fill('Security, Measurement')
  await page.locator('[name="body"]').fill('## Evidence\n\nThe preview uses the production renderer.')
}

test('owner previews selected media and saves a durable draft', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto(baseUrl)
  await expect(page).toHaveURL(new URL(baseUrl).origin + '/')
  await fillPost(page)
  await page.locator('[name="media"]').setInputFiles({
    name: 'Cover Image.PNG',
    mimeType: 'image/png',
    buffer: png,
  })
  await page.locator('[name="coverAlt"]').fill('A one pixel test cover.')

  await expect(page.locator('[name="slug"]')).toHaveValue('studio-draft')
  await expect(page.locator('[name="cover"]')).toHaveValue('/blog/media/studio-draft/cover-image.png')
  await page.getByRole('button', { name: 'Insert images' }).click()
  await expect(page.getByRole('status')).toHaveText('1 image inserted; unsaved.')
  await expect(page.locator('[name="body"]')).toHaveValue(
    /!\[cover image\]\(\/blog\/media\/studio-draft\/cover-image\.png\)/u,
  )
  await page.getByRole('button', { name: 'Preview' }).click()

  const preview = page.locator('.preview iframe').contentFrame()
  await expect(preview.getByRole('heading', { name: 'Studio draft' })).toBeVisible()
  await expect(preview.locator('.post-cover img')).toHaveAttribute('src', /^data:image\/png;base64,/u)
  await expect(preview.locator('.article-body img')).toHaveAttribute('src', /^data:image\/png;base64,/u)
  expect(await preview.locator('body').evaluate(() => ({
    body: getComputedStyle(document.querySelector('.article-body')).animationName,
    cover: getComputedStyle(document.querySelector('.post-cover')).animationName,
    heading: getComputedStyle(document.querySelector('.article-head h1')).animationName,
  }))).toEqual({ body: 'note-rise', cover: 'note-reveal', heading: 'note-rise' })
  const fonts = await preview.locator('body').evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].map((font) => [font.family, font.status])
  })
  expect(fonts).toEqual(expect.arrayContaining([
    ['Danviska', 'loaded'],
    ['Recursive Variable', 'loaded'],
  ]))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await preview.locator('body').evaluate(() => ({
    body: getComputedStyle(document.querySelector('.article-body')).animationName,
    cover: getComputedStyle(document.querySelector('.post-cover')).animationName,
    heading: getComputedStyle(document.querySelector('.article-head h1')).animationName,
  }))).toEqual({ body: 'none', cover: 'none', heading: 'none' })

  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')
  await expect(page.locator('[data-list="drafts"]')).toContainText('studio-draft')
  expect(state.media).toHaveLength(1)
  expect(state.media[0].name).toBe('cover-image.png')

  await page.getByRole('button', { name: 'New' }).click()
  await page.locator('[data-list="drafts"] button').click()
  await expect(page.getByRole('status')).toContainText('Loaded draft post.')
  await expect(preview.locator('.post-cover img')).toHaveAttribute(
    'src',
    '/blog/media/studio-draft/cover-image.png',
  )
  await expect.poll(() => preview.locator('.post-cover img').evaluate((image) => image.naturalWidth)).toBe(1)
  expect(errors).toEqual([])
})

test('publish reports the merged article without opening a popup', async ({ page }) => {
  await page.goto(baseUrl)
  await fillPost(page, 'Published through checks')
  page.once('dialog', (dialog) => dialog.accept())

  await page.getByRole('button', { name: 'Publish' }).click()

  await expect(page.getByRole('status')).toContainText('Published.')
  await expect(page.getByRole('status').getByRole('link', { name: 'Open article' })).toHaveAttribute(
    'href',
    'https://rinz0x0cruz.github.io/blog/published-through-checks/',
  )
  expect(state.published).toEqual(['published-through-checks'])
  expect(page.context().pages()).toHaveLength(1)
})

test('studio inserts allowlisted video and privacy-safe post embeds', async ({ page }) => {
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><title>Test player</title>',
  }))
  await page.goto(baseUrl)
  await fillPost(page, 'Embedded evidence')

  const answers = [
    'https://youtu.be/aqz-KE-bpKQ',
    'Threat model walkthrough',
    'https://example.com/posts/42',
    'Public release note',
  ]
  page.on('dialog', dialog => dialog.accept(answers.shift()))
  await page.getByRole('button', { name: 'Embed video' }).click()
  await expect(page.getByRole('status')).toHaveText('Video embedded; unsaved.')
  await page.getByRole('button', { name: 'Post card' }).click()
  await expect(page.getByRole('status')).toHaveText('Post card inserted; unsaved.')
  await expect(page.locator('[name="body"]')).toHaveValue(/!\[video: Threat model walkthrough\]/u)
  await expect(page.locator('[name="body"]')).toHaveValue(/!\[post: Public release note\]/u)

  await page.getByRole('button', { name: 'Preview' }).click()
  const preview = page.locator('.preview iframe')
  await expect(preview).toHaveAttribute('sandbox', 'allow-same-origin allow-scripts allow-presentation')
  const article = preview.contentFrame()
  await expect(article.locator('.media-embed iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
  )
  await expect(article.locator('.media-embed iframe')).toHaveAttribute('title', 'Threat model walkthrough')
  await expect(article.locator('.media-embed iframe')).toHaveAttribute(
    'allow',
    'encrypted-media; picture-in-picture',
  )
  await expect(article.locator('.external-post')).toContainText('External post · example.com')
  await expect(article.getByRole('link', { name: 'Public release note' })).toHaveAttribute('rel', 'noreferrer')
  await expect(article.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/u,
  )
})

test('studio reports missing authorization and invalid local actions', async ({ page }) => {
  await page.goto(new URL(baseUrl).origin)
  await expect(page.getByRole('status')).toHaveText('Studio token required.')
  await expect(page.getByRole('status')).toHaveClass(/is-error/u)

  await page.goto(baseUrl)
  await fillPost(page)
  await page.locator('[name="published"]').fill('')
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status')).toHaveText('Published date is required.')
  expect(state.published).toEqual([])

  const media = page.locator('[name="media"]')
  await media.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('status')).toHaveText('notes.txt is not a supported image.')

  await media.setInputFiles([
    { name: 'Cover Image.PNG', mimeType: 'image/png', buffer: png },
    { name: 'cover-image.png', mimeType: 'image/png', buffer: png },
  ])
  await expect(page.getByRole('status')).toHaveText('More than one image resolves to cover-image.png.')
  expect(state.media).toEqual([])

  await media.setInputFiles([])
  const answers = ['https://example.com/video/1', 'Unsupported player']
  page.on('dialog', dialog => dialog.accept(answers.shift()))
  await page.getByRole('button', { name: 'Embed video' }).click()
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Video embeds support HTTPS YouTube or Vimeo URLs only.',
  )
  expect(state.drafts.size).toBe(0)
})

test('studio blocks invalid forms before any preview or save request', async ({ page }) => {
  let previewRequests = 0
  let draftRequests = 0
  page.on('request', request => {
    if (request.method() !== 'POST') return
    if (request.url().endsWith('/api/preview')) previewRequests += 1
    if (request.url().endsWith('/api/draft')) draftRequests += 1
  })
  await page.goto(baseUrl)

  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('status')).toHaveText('Complete the highlighted required fields.')
  await expect(page.locator('[name="title"]')).toBeFocused()
  expect(previewRequests).toBe(0)

  await fillPost(page)
  await page.locator('[name="slug"]').fill('Invalid slug')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.locator('[name="slug"]')).toBeFocused()
  expect(draftRequests).toBe(0)

  await page.locator('[name="slug"]').fill('valid-slug')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.locator('.preview iframe').contentFrame().getByRole('heading', { name: 'Studio draft' })).toBeVisible()
  expect(previewRequests).toBe(1)

  const cover = page.locator('[name="cover"]')
  const coverAlt = page.locator('[name="coverAlt"]')
  await expect(cover).toHaveAttribute('maxlength', '240')
  await cover.fill('/blog/media/valid-slug/cover.png')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(coverAlt).toBeFocused()
  expect(previewRequests).toBe(1)

  await coverAlt.fill('A useful cover description.')
  await page.getByRole('button', { name: 'Preview' }).click()
  expect(previewRequests).toBe(2)

  await cover.fill('')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(cover).toBeFocused()
  expect(previewRequests).toBe(2)
})

test('studio protects unsaved work and saves with the keyboard', async ({ page }) => {
  await page.goto(baseUrl)
  await expect(page.locator('[name="body"]')).toHaveAttribute('maxlength', '100000')
  await expect(page.locator('[data-body-count]')).toHaveText('0 words · 0 / 100,000 chars')
  await fillPost(page)
  await expect(page.locator('[data-body-count]')).toHaveText('8 words · 54 / 100,000 chars')
  await expect(page.getByRole('status')).toHaveText('Unsaved changes.')
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })).toBe(true)

  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'New' }).click()
  await expect(page.locator('[name="title"]')).toHaveValue('Studio draft')

  await page.keyboard.press('Control+s')
  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')
  await expect(page.locator('[data-list="drafts"]')).toContainText('studio-draft')
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })).toBe(false)

  await page.locator('[name="body"]').fill('Unsaved replacement.')
  page.once('dialog', dialog => dialog.dismiss())
  await page.locator('[data-list="drafts"] button').click()
  await expect(page.locator('[name="body"]')).toHaveValue('Unsaved replacement.')

  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-list="drafts"] button').click()
  await expect(page.getByRole('status')).toHaveText('Loaded draft post.')
  await expect(page.locator('[name="body"]')).toHaveValue(/production renderer/u)
  await expect(page.locator('[name="slug"]')).toHaveAttribute('readonly', '')

  await page.getByRole('button', { name: 'New' }).click()
  await expect(page.locator('[name="slug"]')).not.toHaveAttribute('readonly', '')
  await expect(page.locator('[data-body-count]')).toHaveText('0 words · 0 / 100,000 chars')
})

test('loading a post discards media selected for the previous editor state', async ({ page }) => {
  await page.goto(baseUrl)
  await fillPost(page)
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')

  const media = page.locator('[name="media"]')
  await media.setInputFiles({ name: 'abandoned.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('status')).toHaveText('1 image ready; save to persist.')

  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-list="drafts"] button').click()
  await expect(page.getByRole('status')).toHaveText('Loaded draft post.')
  expect(await media.evaluate(input => input.files.length)).toBe(0)

  await page.getByRole('button', { name: 'Save draft' }).click()
  expect(state.media).toEqual([])
})

test('saving a new draft locks its branch slug', async ({ page }) => {
  await page.goto(baseUrl)
  await fillPost(page)

  await page.getByRole('button', { name: 'Save draft' }).click()

  await expect(page.locator('[name="slug"]')).toHaveAttribute('readonly', '')
})

test('article preview contains maximum unbroken content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(baseUrl)
  await page.locator('[name="title"]').fill('T'.repeat(120))
  await page.locator('[name="summary"]').fill('S'.repeat(220))
  await page.locator('[name="tags"]').fill('X'.repeat(32))
  await page.locator('[name="body"]').fill(`## Evidence

${'W'.repeat(500)}

\`${'I'.repeat(300)}\`

\`\`\`text
${'C'.repeat(1000)}
\`\`\``)
  await page.getByRole('button', { name: 'Preview' }).click()

  const preview = page.locator('.preview iframe').contentFrame()
  await expect(preview.getByRole('heading', { name: 'T'.repeat(120) })).toBeVisible()
  expect(await preview.locator('body').evaluate(() => {
    const pre = document.querySelector('pre')
    return {
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
      preIsScrollable: pre.scrollWidth > pre.clientWidth,
      preOverflow: getComputedStyle(pre).overflowX,
    }
  })).toEqual({ documentOverflow: 0, preIsScrollable: true, preOverflow: 'auto' })
  const codeBlock = preview.locator('pre')
  await expect(codeBlock).toHaveAttribute('tabindex', '0')
  await codeBlock.focus()
  await expect(codeBlock).toBeFocused()
})

test('populated archive keeps keyboard focus visible in forced colors', async ({ page }) => {
  const origin = new URL(baseUrl).origin
  const post = validatePost({
    slug: 'forced-colors-post',
    metadata: {
      title: 'ATT&CK field note',
      summary: 'A representative populated archive entry.',
      published: '2026-08-02',
      tags: ['ATT&CK'],
    },
    body: 'Evidence.',
  })
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  await page.route(`${origin}/forced-colors-archive`, route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: renderIndex([post]),
  }))
  await page.goto(`${origin}/forced-colors-archive`, { waitUntil: 'networkidle' })
  const link = page.getByRole('link', { name: post.title })
  await link.focus()
  await expect(link).toBeFocused()
  await expect(link).toHaveCSS('text-decoration-line', 'underline')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('studio remains contained and accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(baseUrl)

  const layout = await page.evaluate(() => ({
    controlsContained: [...document.querySelectorAll('input, textarea, button')].every((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= innerWidth
    }),
    overflowX: document.documentElement.scrollWidth - innerWidth,
  }))
  expect(layout).toEqual({ controlsContained: true, overflowX: 0 })

  const results = await new AxeBuilder({ page })
    .exclude('.preview')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})