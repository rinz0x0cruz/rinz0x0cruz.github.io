import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { buildBlog } from '../scripts/blog/build.mjs'
import {
  parsePostSource,
  referencedMediaNames,
  renderArticle,
  renderMarkdown,
  serializePost,
  validatePost,
} from '../scripts/blog/lib.mjs'

const source = `---
title: Earliest public PoC signals
summary: Measuring what the source can actually support.
published: 2026-08-02
tags: [Threat intelligence, Measurement]
---

## Scope

This is **public evidence**, not exploit authorship.
`

const sourceWithCover = source.replace(
  'tags: [Threat intelligence, Measurement]',
  `tags: [Threat intelligence, Measurement]
cover: /blog/media/earliest-public-poc-signals/cover.png
coverAlt: A measured signal.`,
)

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test('parse and serialize are idempotent across line endings', () => {
  const post = parsePostSource(source, 'earliest-public-poc-signals')
  const serialized = serializePost(post)
  assert.equal(post.readingMinutes, 1)
  assert.deepEqual(post.tags, ['Threat intelligence', 'Measurement'])
  assert.deepEqual(parsePostSource(serialized, post.slug), post)
  assert.deepEqual(parsePostSource(source.replaceAll('\n', '\r\n'), post.slug), post)
  assert.equal(serializePost(parsePostSource(serialized, post.slug)), serialized)
})

test('rejects unknown fields, unsafe slugs, and missing public dates', () => {
  assert.throws(
    () => parsePostSource(source.replace('tags:', 'unknown:'), 'valid-slug'),
    /Unknown frontmatter field/u,
  )
  assert.throws(() => parsePostSource(source, '../escape'), /slug must/u)
  assert.throws(
    () => parsePostSource(source.replace('published: 2026-08-02\n', ''), 'missing-date'),
    /published is required/u,
  )
  assert.throws(
    () => parsePostSource(source.replace(
      'tags: [Threat intelligence, Measurement]',
      'cover: /blog/media/valid-slug/../other/cover.png\ncoverAlt: Escaped cover',
    ), 'valid-slug'),
    /cover must be inside/u,
  )
})

test('escapes raw HTML and rejects dangerous link protocols', () => {
  const html = renderMarkdown(`<script>alert(1)</script>

[javascript](javascript:alert(1)) [data](data:text/html,unsafe) [file](file:///tmp/unsafe)

[web](https://example.com) [mail](mailto:test@example.com) [local](/blog/)`)
  assert.doesNotMatch(html, /<script>/u)
  for (const protocol of ['javascript:', 'data:', 'file:']) {
    assert.doesNotMatch(html, new RegExp(`href="${protocol}`, 'u'))
  }
  assert.match(html, /href="https:\/\/example\.com" rel="noreferrer"/u)
  assert.match(html, /href="mailto:test@example\.com"/u)
  assert.match(html, /href="\/blog\/"/u)
  assert.match(html, /&lt;script&gt;/u)
  assert.match(renderMarkdown('```text\nscrollable\n```'), /<pre tabindex="0"><code/u)
  assert.match(renderMarkdown('    indented\n'), /<pre tabindex="0"><code/u)
})

test('renders allowlisted videos and privacy-safe external post cards', () => {
  const html = renderMarkdown(`![video: Threat model walkthrough](https://youtu.be/aqz-KE-bpKQ)

![video: Research briefing](https://vimeo.com/76979871)

![post: Public release note](https://example.com/posts/42)

![Diagram](/blog/media/embed-post/diagram.png)`)

  assert.match(html, /https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/u)
  assert.match(html, /https:\/\/player\.vimeo\.com\/video\/76979871\?dnt=1/u)
  assert.doesNotMatch(html, /web-share/u)
  assert.match(html, /class="external-post"/u)
  assert.match(html, /href="https:\/\/example\.com\/posts\/42" rel="noreferrer"/u)
  assert.match(html, /<img src="\/blog\/media\/embed-post\/diagram\.png" alt="Diagram" loading="lazy" decoding="async">/u)
  assert.throws(
    () => renderMarkdown('![video: Untrusted](https://example.com/video/1)'),
    /YouTube or Vimeo/u,
  )
  assert.throws(
    () => renderMarkdown('![post: Insecure](http://example.com/posts/42)'),
    /HTTPS/u,
  )
  for (const source of [
    'https://youtube.com.example.org/watch?v=aqz-KE-bpKQ',
    'https://user:password@youtube.com/watch?v=aqz-KE-bpKQ',
    'https://youtube.com/watch?v=too-short',
    'https://example.org/?video=https://youtu.be/aqz-KE-bpKQ',
  ]) {
    assert.throws(
      () => renderMarkdown(`![video: Untrusted](<${source}>)`),
      /HTTPS|YouTube or Vimeo/u,
      source,
    )
  }
  const escaped = renderMarkdown(
    '![post: <script>alert("title")</script>](<https://example.com/posts/42?value=%22%3E%3Cscript%3E>)',
  )
  assert.doesNotMatch(escaped, /<script>alert/u)
  assert.match(escaped, /&lt;script&gt;alert/u)
  assert.match(escaped, /value=%22%3E%3Cscript%3E/u)
})

test('media dependencies include rendered images but ignore code examples', () => {
  const names = referencedMediaNames({
    slug: 'path-note',
    metadata: { cover: '/blog/media/path-note/cover.png' },
    body: `A prose example: /blog/media/path-note/prose.png

\`/blog/media/path-note/inline.png\`

\`\`\`text
/blog/media/path-note/fenced.png
\`\`\`

![Rendered](/blog/media/path-note/rendered.png)`,
  })

  assert.deepEqual([...names], ['cover.png', 'rendered.png'])
})

test('enforces metadata and content boundaries', () => {
  const valid = {
    slug: 'edge-post',
    metadata: {
      title: 'Edge post',
      summary: 'Boundary behavior.',
      published: '2024-02-29',
      tags: ['C++', 'ATT&CK', 'Threat intelligence'],
    },
    body: 'Evidence.',
  }
  const cases = [
    ['invalid calendar date', (post) => { post.metadata.published = '2026-02-29' }, /not a valid date/u],
    ['update before publish', (post) => { post.metadata.updated = '2024-02-28' }, /cannot precede/u],
    ['case-insensitive duplicate tags', (post) => { post.metadata.tags = ['Security', ' security '] }, /must be unique/u],
    ['too many tags', (post) => { post.metadata.tags = ['a', 'b', 'c', 'd', 'e', 'f'] }, /at most five/u],
    ['cover without alt text', (post) => { post.metadata.cover = '/blog/media/edge-post/cover.png' }, /coverAlt is required/u],
    ['alt text without cover', (post) => { post.metadata.coverAlt = 'Missing cover.' }, /coverAlt requires cover/u],
    ['overlong title', (post) => { post.metadata.title = 'x'.repeat(121) }, /at most 120/u],
    ['overlong body', (post) => { post.body = 'x'.repeat(100_001) }, /at most 100000/u],
  ]

  assert.equal(validatePost({ ...valid, body: 'x'.repeat(100_000) }).body.length, 100_000)
  for (const [label, mutate, expected] of cases) {
    const post = structuredClone(valid)
    mutate(post)
    assert.throws(() => validatePost(post), expected, label)
  }
})

test('validates, serializes, and renders evidence metadata', () => {
  const sources = [
    'https://www.first.org/tlp/',
    'https://attack.mitre.org/techniques/enterprise/',
  ]
  const post = validatePost({
    slug: 'evidence-note',
    metadata: {
      title: 'Evidence note',
      summary: 'A bounded set of inspectable primary sources.',
      published: '2026-08-03',
      snapshotDate: '2026-08-02',
      tlp: 'TLP:CLEAR',
      sources,
    },
    body: 'Evidence remains separate from inference.',
  })

  assert.deepEqual(post.sources, sources)
  assert.equal(post.snapshotDate, '2026-08-02')
  assert.equal(post.tlp, 'TLP:CLEAR')
  assert.deepEqual(parsePostSource(serializePost(post), post.slug), post)

  const article = renderArticle(post)
  assert.match(article, /class="article-evidence"/u)
  assert.match(article, /Evidence snapshot/u)
  assert.match(article, /TLP:CLEAR/u)
  const structuredData = JSON.parse(article.match(
    /<script type="application\/ld\+json">([^<]+)<\/script>/u,
  )[1])
  assert.deepEqual(structuredData.citation, sources)

  const valid = {
    slug: 'evidence-boundary',
    metadata: {
      title: 'Evidence boundary',
      summary: 'Validation cases for public evidence metadata.',
      published: '2026-08-03',
      snapshotDate: '2026-08-02',
      tlp: 'TLP:CLEAR',
      sources: ['https://example.com/source'],
    },
    body: 'Evidence.',
  }
  const cases = [
    ['non-array sources', (value) => { value.metadata.sources = 'https://example.com' }, /at most 12/u],
    ['too many sources', (value) => { value.metadata.sources = Array.from({ length: 13 }, (_, index) => `https://example.com/${index}`) }, /at most 12/u],
    ['insecure source', (value) => { value.metadata.sources = ['http://example.com'] }, /HTTPS/u],
    ['credentialed source', (value) => { value.metadata.sources = ['https://user:secret@example.com'] }, /HTTPS/u],
    ['duplicate source', (value) => { value.metadata.sources.push('https://example.com/source') }, /must be unique/u],
    ['missing snapshot', (value) => { delete value.metadata.snapshotDate }, /snapshotDate is required/u],
    ['snapshot without sources', (value) => { delete value.metadata.sources; delete value.metadata.tlp }, /requires at least one source/u],
    ['snapshot after post', (value) => { value.metadata.snapshotDate = '2026-08-04' }, /cannot follow/u],
    ['non-public TLP', (value) => { value.metadata.tlp = 'TLP:AMBER' }, /only use TLP:CLEAR/u],
  ]
  for (const [label, mutate, expected] of cases) {
    const value = structuredClone(valid)
    mutate(value)
    assert.throws(() => validatePost(value), expected, label)
  }
})

test('builds physical articles, index, RSS, sitemap, and robots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-blog-'))
  const posts = join(root, 'posts')
  const output = join(root, 'dist')
  await mkdir(posts, { recursive: true })
  await mkdir(join(output, 'blog', 'media', 'earliest-public-poc-signals'), { recursive: true })
  await writeFile(join(posts, 'earliest-public-poc-signals.md'), sourceWithCover, 'utf8')
  await writeFile(join(output, 'blog', 'media', 'earliest-public-poc-signals', 'cover.png'), png)

  const revision = 'a'.repeat(40)
  const built = await buildBlog({ postsDir: posts, outDir: output, revision })
  assert.equal(built.length, 1)
  const index = await readFile(join(output, 'blog', 'index.html'), 'utf8')
  assert.match(index, /<title>Security field notes — Mohit Sharma<\/title>/u)
  assert.match(index, /<meta property="og:type" content="website">/u)
  assert.match(index, /Security field notes/u)
  assert.match(index, /Methods, tooling, and evidence from applied security research/u)
  assert.match(index, /Earliest public PoC signals/u)
  const article = await readFile(join(output, 'blog', 'earliest-public-poc-signals', 'index.html'), 'utf8')
  assert.match(article, /<meta property="og:type" content="article">/u)
  assert.match(article, /BlogPosting/u)
  const feed = await readFile(join(output, 'blog', 'feed.xml'), 'utf8')
  assert.match(feed, /Mohit Sharma — Security field notes/u)
  assert.match(feed, /<item>/u)
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8')
  assert.match(sitemap, /earliest-public-poc-signals/u)
  assert.match(sitemap, /\/exploitrank\//u)
  assert.match(sitemap, /\/malscope-dashboard\//u)
  assert.match(await readFile(join(output, 'robots.txt'), 'utf8'), /Sitemap:/u)
  assert.deepEqual(
    JSON.parse(await readFile(join(output, 'build-meta.json'), 'utf8')),
    { revision },
  )
  assert.deepEqual(
    await readFile(join(output, 'blog', 'media', 'earliest-public-poc-signals', 'cover.png')),
    png,
  )
})

test('rejects a published post whose media is missing from the build artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-blog-missing-media-'))
  const posts = join(root, 'posts')
  const output = join(root, 'dist')
  await mkdir(posts, { recursive: true })
  await writeFile(join(posts, 'earliest-public-poc-signals.md'), sourceWithCover, 'utf8')

  await assert.rejects(
    buildBlog({ postsDir: posts, outDir: output }),
    /references missing media.*cover\.png/u,
  )
})

test('draft preview renders without a public date', () => {
  const draft = parsePostSource(source.replace('published: 2026-08-02\n', ''), 'draft-post', { draft: true })
  assert.match(renderArticle(draft, { preview: true }), /Draft preview/u)
})