import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { CommandTimeoutError } from '../scripts/blog/publisher.mjs'
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
  state = {
    deleteDraftOnPublish: false,
    drafts: new Map(),
    media: [],
    published: [],
    publishedPosts: new Map(),
    publishCalls: 0,
    publishOutcomeUnknown: false,
    pullRequestState: 'MERGED',
    rebaseOnPublish: false,
    revisions: new Map(),
    revisionCounter: 0,
    saveCalls: 0,
    saveOutcomeUnknown: false,
    statusVisibilityDelay: 0,
  }
  const nextRevision = () => {
    state.revisionCounter += 1
    return `01234567${state.revisionCounter.toString(16).padStart(32, '0')}`
  }
  const assertRevision = (slug, expectedRevision) => {
    if ((state.revisions.get(slug) ?? null) === expectedRevision) return
    const error = new Error('This draft changed after it was loaded. Reload it before saving again.')
    error.code = 'BLOG_REVISION_CONFLICT'
    throw error
  }
  const publisher = {
    async listPosts() {
      return { drafts: [...state.drafts.keys()], published: state.published }
    },
    async readPost(slug, source = 'published') {
      const records = source === 'draft' ? state.drafts : state.publishedPosts
      if (!records.has(slug)) {
        const error = new Error(`${source} post not found.`)
        if (source === 'draft') error.code = 'BLOG_DRAFT_NOT_FOUND'
        throw error
      }
      return {
        post: records.get(slug),
        revision: state.revisions.get(slug),
      }
    },
    async readMedia(_slug, name) {
      const entry = state.media.find((item) => item.name === name)
      if (!entry) throw new Error('Media not found.')
      return { buffer: Buffer.from(entry.data, 'base64'), contentType: 'image/png' }
    },
    async saveDraft(post, media, expectedRevision) {
      state.saveCalls += 1
      const validated = validatePost(post, { draft: true })
      assertRevision(validated.slug, expectedRevision)
      const revision = nextRevision()
      state.drafts.set(validated.slug, validated)
      state.revisions.set(validated.slug, revision)
      state.media = media
      const result = { branch: `draft/blog/${validated.slug}`, sha: revision, media: [] }
      if (state.saveOutcomeUnknown) {
        state.saveOutcomeUnknown = false
        const error = new CommandTimeoutError('git', 100)
        error.outcomeUnknown = true
        error.recovery = {
          draft: { branch: result.branch, sha: 'f'.repeat(40) },
        }
        throw error
      }
      return result
    },
    async saveAndPublish(post, media, expectedRevision) {
      state.publishCalls += 1
      const validated = validatePost(post)
      assertRevision(validated.slug, expectedRevision)
      const published = state.publishedPosts.get(validated.slug)
      if (
        !state.drafts.has(validated.slug)
        && JSON.stringify(published) === JSON.stringify(validated)
        && JSON.stringify(state.media) === JSON.stringify(media)
      ) {
        return {
          draft: {
            branch: `draft/blog/${validated.slug}`,
            media: [],
            sha: expectedRevision,
          },
          published: {
            alreadyPublished: true,
            autoMergeQueued: false,
            branch: `draft/blog/${validated.slug}`,
            liveUrl: `https://rinz0x0cruz.github.io/blog/${validated.slug}/`,
            pullRequest: null,
            sha: expectedRevision,
          },
        }
      }
      const draftRevision = nextRevision()
      const publishedRevision = state.rebaseOnPublish ? nextRevision() : draftRevision
      state.drafts.set(validated.slug, validated)
      state.publishedPosts.set(validated.slug, validated)
      state.revisions.set(validated.slug, publishedRevision)
      state.media = media
      state.published.push(validated.slug)
      if (state.deleteDraftOnPublish) state.drafts.delete(validated.slug)
      const result = {
        draft: { branch: `draft/blog/${validated.slug}`, sha: draftRevision, media: [] },
        published: {
          branch: `draft/blog/${validated.slug}`,
          sha: publishedRevision,
          pullRequest: { number: 12, url: 'https://github.com/rinz0x0cruz/rinz0x0cruz.github.io/pull/12' },
          autoMergeQueued: true,
        },
      }
      if (state.publishOutcomeUnknown) {
        state.publishOutcomeUnknown = false
        const error = new CommandTimeoutError('git', 100)
        error.outcomeUnknown = true
        error.recovery = {
          draft: {
            branch: result.draft.branch,
            sha: 'f'.repeat(40),
          },
          publicationPending: true,
        }
        throw error
      }
      return result
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
    async reconcile(post, media) {
      const validated = validatePost(post)
      const mediaMatches = JSON.stringify(media) === JSON.stringify(state.media)
      if (!mediaMatches) return null
      const draft = state.drafts.get(validated.slug)
      const published = state.publishedPosts.get(validated.slug)
      const matches = (candidate) => JSON.stringify(candidate) === JSON.stringify(validated)
      if (!matches(draft) && !matches(published)) return null
      const isPublished = !matches(draft) && matches(published)
      return {
        branch: `draft/blog/${validated.slug}`,
        liveUrl: `https://rinz0x0cruz.github.io/blog/${validated.slug}/`,
        published: isPublished,
        pullRequest: isPublished ? null : {
          number: 12,
          url: 'https://github.com/rinz0x0cruz/rinz0x0cruz.github.io/pull/12',
          state: state.pullRequestState,
          statusCheckRollup: [],
        },
        revision: state.revisions.get(validated.slug),
      }
    },
    async status(slug, expectedRevision) {
      const revisionMatches = state.revisions.get(slug) === expectedRevision
      if (state.statusVisibilityDelay > 0) {
        state.statusVisibilityDelay -= 1
        return {
          branch: `draft/blog/${slug}`,
          liveUrl: `https://rinz0x0cruz.github.io/blog/${slug}/`,
          pullRequest: null,
        }
      }
      return {
        branch: `draft/blog/${slug}`,
        liveUrl: `https://rinz0x0cruz.github.io/blog/${slug}/`,
        pullRequest: revisionMatches ? {
          number: 12,
          url: 'https://github.com/rinz0x0cruz/rinz0x0cruz.github.io/pull/12',
          state: state.pullRequestState,
          statusCheckRollup: [],
        } : null,
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
  expect(await page.evaluate(async () => {
    const response = await fetch('/blog/media/studio-draft/cover-image.png')
    return {
      contentType: response.headers.get('content-type'),
      status: response.status,
    }
  })).toEqual({ contentType: 'image/png', status: 200 })

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

test('a stale save preserves the local editor text', async ({ page }) => {
  await page.goto(baseUrl)
  await fillPost(page, 'Conflict draft')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')

  const body = page.locator('[name="body"]')
  await body.fill('An unsaved local correction that must survive.')
  state.revisions.set('conflict-draft', 'f'.repeat(40))
  await page.getByRole('button', { name: 'Save draft' }).click()

  await expect(page.getByRole('status')).toHaveText(
    'This draft changed after it was loaded. Reload it before saving again.',
  )
  await expect(body).toHaveValue('An unsaved local correction that must survive.')
  expect(state.drafts.get('conflict-draft').body).toContain('production renderer')
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })).toBe(true)
})

test('studio previews and preserves evidence metadata', async ({ page }) => {
  await page.goto(baseUrl)
  await fillPost(page, 'Evidence draft')
  await page.locator('[name="snapshotDate"]').fill('2026-08-02')
  await page.locator('[name="tlp"]').selectOption('TLP:CLEAR')
  await page.locator('[name="sources"]').fill([
    'https://www.first.org/tlp/',
    'https://attack.mitre.org/techniques/enterprise/',
  ].join('\n'))

  await page.getByRole('button', { name: 'Preview' }).click()
  const preview = page.locator('.preview iframe').contentFrame()
  await expect(preview.getByRole('heading', { name: 'Sources' })).toBeVisible()
  await expect(preview.locator('.article-evidence')).toContainText('TLP:CLEAR')
  await expect(preview.locator('.article-evidence a')).toHaveCount(2)

  await page.getByRole('button', { name: 'Save draft' }).click()
  expect(state.drafts.get('evidence-draft')).toMatchObject({
    snapshotDate: '2026-08-02',
    tlp: 'TLP:CLEAR',
    sources: [
      'https://www.first.org/tlp/',
      'https://attack.mitre.org/techniques/enterprise/',
    ],
  })

  await page.getByRole('button', { name: 'New' }).click()
  await page.locator('[data-list="drafts"] button').click()
  await expect(page.locator('[name="snapshotDate"]')).toHaveValue('2026-08-02')
  await expect(page.locator('[name="tlp"]')).toHaveValue('TLP:CLEAR')
  await expect(page.locator('[name="sources"]')).toHaveValue(/first\.org.*attack\.mitre\.org/su)
})

test('selected media paths follow an unsaved slug change', async ({ page }) => {
  await page.goto(baseUrl)
  await fillPost(page, 'Media draft')
  await page.locator('[name="media"]').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await page.locator('[name="coverAlt"]').fill('A one pixel test cover.')
  await page.getByRole('button', { name: 'Insert images' }).click()
  await expect(page.locator('[name="cover"]')).toHaveValue('/blog/media/media-draft/cover.png')
  await expect(page.locator('[name="body"]')).toHaveValue(/\/blog\/media\/media-draft\/cover\.png/u)

  const title = page.locator('[name="title"]')
  await title.fill('')
  await title.pressSequentially('Renamed draft')

  await expect(page.locator('[name="slug"]')).toHaveValue('renamed-draft')
  await expect(page.locator('[name="cover"]')).toHaveValue('/blog/media/renamed-draft/cover.png')
  await expect(page.locator('[name="body"]')).toHaveValue(/\/blog\/media\/renamed-draft\/cover\.png/u)

  const slug = page.locator('[name="slug"]')
  await slug.fill('')
  await slug.pressSequentially('manual-slug')
  await expect(page.locator('[name="cover"]')).toHaveValue('/blog/media/manual-slug/cover.png')
  await expect(page.locator('[name="body"]')).toHaveValue(/\/blog\/media\/manual-slug\/cover\.png/u)

  await page.getByRole('button', { name: 'Preview' }).click()
  const article = page.locator('.preview iframe').contentFrame()
  await expect(article.locator('.post-cover img')).toHaveAttribute('src', /^data:image\/png;base64,/u)
  await expect(article.locator('.article-body img')).toHaveAttribute('src', /^data:image\/png;base64,/u)
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

test('already-published response preserves a lingering draft branch lease', async ({ page }) => {
  const branchRevision = 'a'.repeat(40)
  const mainRevision = 'b'.repeat(40)
  const expectedRevisions = []
  await page.goto(baseUrl)
  await fillPost(page, 'Lingering publication')
  await page.route('**/api/publish', async (route) => {
    expectedRevisions.push(JSON.parse(route.request().postData()).expectedRevision)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        draft: {
          branch: 'draft/blog/lingering-publication',
          media: [],
          sha: branchRevision,
        },
        published: {
          alreadyPublished: true,
          autoMergeQueued: false,
          branch: 'draft/blog/lingering-publication',
          liveUrl: 'https://rinz0x0cruz.github.io/blog/lingering-publication/',
          pullRequest: null,
          sha: mainRevision,
        },
      }),
    })
  })
  const publishButton = page.getByRole('button', { name: 'Publish' })

  for (const expectedCount of [1, 2]) {
    await Promise.all([
      page.waitForEvent('dialog').then((dialog) => dialog.accept()),
      publishButton.click(),
    ])
    await expect.poll(() => expectedRevisions.length).toBe(expectedCount)
    await expect(page.getByRole('status')).toContainText('Published.')
  }

  expect(expectedRevisions).toEqual([null, branchRevision])
})

test('publish reconciles a lost response and retries with the durable revision', async ({ page }) => {
  state.deleteDraftOnPublish = true
  state.publishOutcomeUnknown = true
  await page.goto(baseUrl)
  await fillPost(page, 'Recovered publication')
  await page.locator('[name="media"]').setInputFiles({
    name: 'Recovery.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await page.locator('[name="coverAlt"]').fill('A recovery test image.')
  const publishButton = page.getByRole('button', { name: 'Publish' })
  const reconciliation = page.waitForResponse((response) => (
    response.url().endsWith('/api/reconcile')
    && response.request().method() === 'POST'
  ))
  await Promise.all([
    page.waitForEvent('dialog').then((dialog) => dialog.accept()),
    publishButton.click(),
  ])

  await expect.poll(() => state.published.length, { timeout: 10_000 }).toBe(1)
  expect((await reconciliation).ok()).toBe(true)
  await expect(page.getByRole('status')).toContainText('Published.')
  expect(state.published).toEqual(['recovered-publication'])
  expect(state.media).toHaveLength(1)
  expect(state.drafts.has('recovered-publication')).toBe(false)

  await Promise.all([
    page.waitForEvent('dialog').then((dialog) => dialog.accept()),
    publishButton.click(),
  ])
  await expect.poll(() => state.publishCalls).toBe(2)
  await expect(page.getByRole('status')).toContainText('Published.')
  expect(state.published).toEqual(['recovered-publication'])
  expect(state.drafts.has('recovered-publication')).toBe(false)
})

test('save reconciles a lost response and retries with the durable revision', async ({ page }) => {
  state.saveOutcomeUnknown = true
  await page.goto(baseUrl)
  await fillPost(page, 'Recovered draft')
  await page.locator('[name="media"]').setInputFiles({
    name: 'Draft.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await page.locator('[name="coverAlt"]').fill('A recovered draft image.')
  const reconciliation = page.waitForResponse((response) => (
    response.url().endsWith('/api/reconcile')
    && response.request().method() === 'POST'
  ))
  await page.getByRole('button', { name: 'Save draft' }).click()
  expect((await reconciliation).ok()).toBe(true)
  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')
  expect(state.drafts.has('recovered-draft')).toBe(true)
  expect(state.media).toHaveLength(1)

  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect.poll(() => state.saveCalls).toBe(2)
  expect(state.drafts.has('recovered-draft')).toBe(true)
})

test('publish polls when its PR is not immediately visible', async ({ page }) => {
  await page.clock.install()
  await page.goto(baseUrl)
  await fillPost(page, 'Lagged publication')
  const recoveredRevision = 'b'.repeat(40)
  state.revisions.set('lagged-publication', recoveredRevision)
  state.statusVisibilityDelay = 2
  state.pullRequestState = 'OPEN'
  await page.route('**/api/publish', (route) => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'GitHub has not returned the pull request yet.',
      code: 'BLOG_COMMAND_FAILED',
      recovery: {
        draft: {
          branch: 'draft/blog/lagged-publication',
          sha: recoveredRevision,
        },
        publicationPending: true,
      },
    }),
  }), { times: 1 })
  page.once('dialog', (dialog) => dialog.accept())

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status')).toContainText('Publish PR is not visible yet.')

  await page.clock.runFor(5_000)
  await expect(page.getByRole('status')).toContainText('Publish PR is awaiting merge.')
})

test('owner can keep editing after publish rebases the draft', async ({ page }) => {
  state.rebaseOnPublish = true
  await page.goto(baseUrl)
  await fillPost(page, 'Rebased publish')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status')).toContainText('Published.')

  await page.locator('[name="body"]').fill('A correction after the rebased publish.')
  await page.getByRole('button', { name: 'Save draft' }).click()

  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')
  expect(state.drafts.get('rebased-publish').body).toBe('A correction after the rebased publish.')
})

test('loading another post stops previous publish tracking', async ({ page }) => {
  await page.clock.install()
  let statusRequests = 0
  page.on('request', request => {
    if (request.url().includes('/api/status?')) statusRequests += 1
  })
  await page.goto(baseUrl)
  await fillPost(page, 'Saved draft')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')

  await page.getByRole('button', { name: 'New' }).click()
  await fillPost(page, 'Pending publish')
  state.pullRequestState = 'OPEN'
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status')).toContainText('Publish PR is awaiting merge.')
  expect(statusRequests).toBe(1)

  await page.locator('[data-list="drafts"] button', { hasText: 'saved-draft' }).click()
  await expect(page.getByRole('status')).toHaveText('Loaded draft post.')
  await page.clock.runFor(5_000)
  await page.evaluate(() => Promise.resolve())

  expect(statusRequests).toBe(1)
  await expect(page.getByRole('status')).toHaveText('Loaded draft post.')
})

test('editing stops publish tracking and preserves unsaved status', async ({ page }) => {
  await page.clock.install()
  let statusRequests = 0
  page.on('request', request => {
    if (request.url().includes('/api/status?')) statusRequests += 1
  })
  await page.goto(baseUrl)
  await fillPost(page, 'Pending edit')
  state.pullRequestState = 'OPEN'
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status')).toContainText('Publish PR is awaiting merge.')
  expect(statusRequests).toBe(1)

  await page.locator('[name="body"]').fill('Unsaved correction.')
  await expect(page.getByRole('status')).toHaveText('Unsaved changes.')
  await page.clock.runFor(5_000)
  await page.evaluate(() => Promise.resolve())

  expect(statusRequests).toBe(1)
  await expect(page.getByRole('status')).toHaveText('Unsaved changes.')
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

test('an automatically selected cover requires alt text before preview', async ({ page }) => {
  let previewRequests = 0
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/preview')) previewRequests += 1
  })
  await page.goto(baseUrl)
  await fillPost(page)

  await page.locator('[name="media"]').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await expect(page.locator('[name="cover"]')).toHaveValue('/blog/media/studio-draft/cover.png')
  await expect(page.locator('[name="coverAlt"]')).toHaveAttribute('required', '')

  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.locator('[name="coverAlt"]')).toBeFocused()
  expect(previewRequests).toBe(0)
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

test('studio locks the editor while a save is in flight', async ({ page }) => {
  let releaseDraft
  const draftGate = new Promise(resolve => { releaseDraft = resolve })
  await page.route('**/api/draft', async route => {
    await draftGate
    await route.continue()
  })
  await page.goto(baseUrl)
  await fillPost(page)

  await page.getByRole('button', { name: 'Save draft' }).click()
  try {
    await expect(page.locator('[data-editor]')).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('[name="title"]')).toBeDisabled()
    await expect(page.locator('[name="tlp"]')).toBeDisabled()
    await expect(page.locator('[name="body"]')).toBeDisabled()
    await expect(page.locator('[name="media"]')).toBeDisabled()
  } finally {
    releaseDraft()
  }

  await expect(page.getByRole('status')).toContainText('Draft saved at 01234567.')
  await expect(page.locator('[data-editor]')).not.toHaveAttribute('aria-busy')
  await expect(page.locator('[name="tlp"]')).toBeEnabled()
  await expect(page.locator('[name="body"]')).toBeEnabled()
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