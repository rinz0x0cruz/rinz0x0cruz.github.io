import MarkdownIt from 'markdown-it'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export const SITE_URL = 'https://rinz0x0cruz.github.io'
export const AUTHOR = {
  name: 'Mohit Sharma',
  url: `${SITE_URL}/`,
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const allowedKeys = new Set([
  'title',
  'summary',
  'published',
  'updated',
  'tags',
  'cover',
  'coverAlt',
])

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false })
const defaultValidateLink = markdown.validateLink.bind(markdown)
markdown.validateLink = (url) => {
  if (!defaultValidateLink(url)) return false
  return /^(?:https?:|mailto:|\/|#|\.\.?\/)/iu.test(url)
}

const defaultLinkOpen = markdown.renderer.rules.link_open
  ?? ((tokens, index, options, _environment, renderer) => renderer.renderToken(tokens, index, options))
markdown.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  const href = tokens[index].attrGet('href') ?? ''
  if (/^https?:/iu.test(href)) tokens[index].attrSet('rel', 'noreferrer')
  return defaultLinkOpen(tokens, index, options, environment, renderer)
}

function requireHttpsUrl(source, label) {
  let url
  try {
    url = new URL(source)
  } catch {
    throw new Error(`${label} must use a valid HTTPS URL.`)
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${label} must use a valid HTTPS URL.`)
  }
  return url
}

function videoEmbedUrl(source) {
  const url = requireHttpsUrl(source, 'Video embed')
  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)
  let identifier

  if (['youtu.be', 'www.youtu.be'].includes(host)) identifier = segments[0]
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    identifier = url.pathname === '/watch' ? url.searchParams.get('v') : segments[1]
  }
  if (/^[\w-]{11}$/u.test(identifier ?? '')) {
    return `https://www.youtube-nocookie.com/embed/${identifier}`
  }

  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    identifier = segments.at(-1)
  }
  if (/^\d+$/u.test(identifier ?? '')) {
    return `https://player.vimeo.com/video/${identifier}?dnt=1`
  }
  throw new Error('Video embeds support HTTPS YouTube or Vimeo URLs only.')
}

function renderDirective(kind, title, source) {
  if (!title || title.length > 180) throw new Error(`${kind} title must be between 1 and 180 characters.`)
  if (kind === 'video') {
    return `<span class="media-embed"><iframe src="${escapeHtml(videoEmbedUrl(source))}" title="${escapeHtml(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></span>`
  }
  const url = requireHttpsUrl(source, 'External post')
  const host = url.hostname.replace(/^www\./u, '')
  return `<span class="external-post" role="group" aria-label="External post from ${escapeHtml(host)}"><span class="external-post__meta">External post · ${escapeHtml(host)}</span><a href="${escapeHtml(url.href)}" rel="noreferrer">${escapeHtml(title)}</a></span>`
}

const defaultImage = markdown.renderer.rules.image
markdown.renderer.rules.image = (tokens, index, options, environment, renderer) => {
  const alt = renderer.renderInlineAsText(tokens[index].children, options, environment).trim()
  const directive = /^(video|post):/iu.exec(alt)
  if (directive) {
    return renderDirective(directive[1].toLowerCase(), alt.slice(directive[0].length).trim(), tokens[index].attrGet('src'))
  }
  tokens[index].attrSet('loading', 'lazy')
  tokens[index].attrSet('decoding', 'async')
  return defaultImage(tokens, index, options, environment, renderer)
}

for (const rule of ['fence', 'code_block']) {
  const renderCode = markdown.renderer.rules[rule]
  markdown.renderer.rules[rule] = (...args) => renderCode(...args).replace('<pre>', '<pre tabindex="0">')
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function escapeXml(value) {
  return escapeHtml(value)
}

function requireString(value, field, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`)
  const normalized = value.trim()
  if (normalized.length > maximum) throw new Error(`${field} must be at most ${maximum} characters.`)
  return normalized
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD.`)
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} is not a valid date.`)
  }
  return value
}

function validateTags(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 5) throw new Error('tags must contain at most five entries.')
  const tags = value.map((tag) => requireString(tag, 'tag', 32))
  if (tags.some((tag) => !/^[\p{L}\p{N}][\p{L}\p{N} &+#./-]*$/u.test(tag))) {
    throw new Error('tags contain unsupported characters.')
  }
  if (new Set(tags.map((tag) => tag.toLowerCase())).size !== tags.length) {
    throw new Error('tags must be unique.')
  }
  return tags
}

function validateCover(value, coverAlt, slug) {
  if (value === undefined || value === null || value === '') {
    if (coverAlt) throw new Error('coverAlt requires cover.')
    return { cover: undefined, coverAlt: undefined }
  }
  const cover = requireString(value, 'cover', 240)
  const prefix = `/blog/media/${slug}/`
  const filename = cover.slice(prefix.length)
  if (!cover.startsWith(prefix) || !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(filename)) {
    throw new Error(`cover must be inside /blog/media/${slug}/.`)
  }
  if (!/\.(?:avif|gif|jpe?g|png|webp)$/iu.test(cover)) throw new Error('cover uses an unsupported image format.')
  return { cover, coverAlt: requireString(coverAlt, 'coverAlt', 180) }
}

export function validateSlug(slug) {
  if (typeof slug !== 'string' || slug.length > 80 || !slugPattern.test(slug)) {
    throw new Error('slug must use lowercase letters, numbers, and single hyphens.')
  }
  return slug
}

export function referencedMediaNames(post) {
  const slug = validateSlug(post.slug)
  const source = `${post.metadata?.cover ?? post.cover ?? ''}\n${post.body ?? ''}`
  const pattern = new RegExp(`/blog/media/${slug}/([a-z0-9][a-z0-9._-]{0,79})`, 'gu')
  return new Set([...source.matchAll(pattern)].map((match) => match[1]))
}

export function validatePost(input, { draft = false } = {}) {
  const slug = validateSlug(input.slug)
  const metadata = input.metadata ?? {}
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('frontmatter must be a mapping.')
  }
  for (const key of Object.keys(metadata)) {
    if (!allowedKeys.has(key)) throw new Error(`Unknown frontmatter field: ${key}.`)
  }

  const title = requireString(metadata.title, 'title', 120)
  const summary = requireString(metadata.summary, 'summary', 220)
  const published = optionalDate(metadata.published, 'published')
  const updated = optionalDate(metadata.updated, 'updated')
  if (!draft && !published) throw new Error('published is required for a public post.')
  if (published && updated && updated < published) throw new Error('updated cannot precede published.')
  const body = requireString(input.body, 'body', 100_000)
  const tags = validateTags(metadata.tags)
  const { cover, coverAlt } = validateCover(metadata.cover, metadata.coverAlt, slug)

  return {
    slug,
    title,
    summary,
    published,
    updated,
    tags,
    cover,
    coverAlt,
    body,
    readingMinutes: Math.max(1, Math.ceil(body.split(/\s+/u).length / 220)),
  }
}

export function parsePostSource(source, slug, options) {
  const normalized = String(source).replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  if (!normalized.startsWith('---\n')) throw new Error('Post must begin with YAML frontmatter.')
  const end = normalized.indexOf('\n---\n', 4)
  if (end < 0) throw new Error('Post frontmatter is not closed.')
  const metadata = parseYaml(normalized.slice(4, end), { maxAliasCount: 20 })
  return validatePost({ slug, metadata, body: normalized.slice(end + 5) }, options)
}

export function serializePost(post, { draft = false } = {}) {
  const input = post.metadata
    ? post
    : {
        slug: post.slug,
        body: post.body,
        metadata: {
          title: post.title,
          summary: post.summary,
          published: post.published,
          updated: post.updated,
          tags: post.tags,
          cover: post.cover,
          coverAlt: post.coverAlt,
        },
      }
  const validated = validatePost(input, { draft })
  const metadata = {
    title: validated.title,
    summary: validated.summary,
    ...(validated.published ? { published: validated.published } : {}),
    ...(validated.updated ? { updated: validated.updated } : {}),
    ...(validated.tags.length ? { tags: validated.tags } : {}),
    ...(validated.cover ? { cover: validated.cover, coverAlt: validated.coverAlt } : {}),
  }
  return `---\n${stringifyYaml(metadata, { lineWidth: 0 }).trim()}\n---\n\n${validated.body.trim()}\n`
}

export function renderMarkdown(body) {
  return markdown.render(body)
}

function securityMeta() {
  return '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\'; img-src \'self\' https: data:; font-src \'self\'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; base-uri \'none\'; form-action \'none\'; upgrade-insecure-requests">'
}

function pageShell({ title, description, canonical, image, ogType = 'website', structuredData, body }) {
  const socialImage = image ?? `${SITE_URL}/social-card.jpg`
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#000000">
  ${securityMeta()}
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png">
  <link rel="stylesheet" href="/blog.css">
  <link rel="alternate" type="application/rss+xml" title="Mohit Sharma — Security field notes" href="/blog/feed.xml">
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(socialImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>
</head>
<body>
${body}
</body>
</html>
`
}

function postDate(post) {
  return post.published ? new Date(`${post.published}T00:00:00Z`) : new Date()
}

function dateText(value) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`))
}

export function renderArticle(post, { preview = false } = {}) {
  const published = post.published ?? new Date().toISOString().slice(0, 10)
  const canonical = `${SITE_URL}/blog/${post.slug}/`
  const image = post.cover ? `${SITE_URL}${post.cover}` : `${SITE_URL}/social-card.jpg`
  const tags = post.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')
  const cover = post.cover
    ? `<figure class="post-cover"><img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.coverAlt)}" width="1600" height="900" fetchpriority="high"></figure>`
    : ''
  const body = `<header class="site-head"><a class="site-name" href="/">Mohit Sharma</a><nav aria-label="Primary"><a href="/blog/">Blog</a><a href="/Mohit-Sharma-Resume.pdf">Résumé</a></nav></header>
<main class="article-shell">
  <article>
    <header class="article-head">
      ${preview ? '<p class="preview-label">Draft preview</p>' : ''}
      <p class="article-meta"><time datetime="${escapeHtml(published)}">${escapeHtml(dateText(published))}</time> · ${post.readingMinutes} min read</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="article-summary">${escapeHtml(post.summary)}</p>
      ${tags ? `<ul class="tag-list" aria-label="Tags">${tags}</ul>` : ''}
    </header>
    ${cover}
    <div class="article-body">${renderMarkdown(post.body)}</div>
  </article>
  <footer class="article-footer"><a href="/blog/">← All posts</a></footer>
</main>`
  return pageShell({
    title: `${post.title} — Mohit Sharma`,
    description: post.summary,
    canonical,
    image,
    ogType: 'article',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.summary,
      datePublished: published,
      ...(post.updated ? { dateModified: post.updated } : {}),
      mainEntityOfPage: canonical,
      image,
      author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url },
    },
    body,
  })
}

export function renderIndex(posts) {
  const items = posts.map((post) => `<li class="post-item">
    <p><time datetime="${escapeHtml(post.published)}">${escapeHtml(dateText(post.published))}</time> · ${post.readingMinutes} min</p>
    <h2><a href="/blog/${escapeHtml(post.slug)}/">${escapeHtml(post.title)}</a></h2>
    <p>${escapeHtml(post.summary)}</p>
    ${post.tags.length ? `<ul class="tag-list" aria-label="Tags">${post.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>` : ''}
  </li>`).join('')
  const body = `<header class="site-head"><a class="site-name" href="/">Mohit Sharma</a><nav aria-label="Primary"><a aria-current="page" href="/blog/">Blog</a><a href="/Mohit-Sharma-Resume.pdf">Résumé</a></nav></header>
<main class="blog-shell">
  <header class="blog-head"><p>Research notes</p><h1>Security field notes</h1><p>Methods, tooling, and evidence from applied security research.</p></header>
  ${items ? `<ol class="post-list">${items}</ol>` : '<p class="empty-blog">No field notes published yet.</p>'}
</main>`
  return pageShell({
    title: 'Security field notes — Mohit Sharma',
    description: "Methods, tooling, and evidence from Mohit Sharma's applied security research.",
    canonical: `${SITE_URL}/blog/`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Mohit Sharma — Security field notes',
      url: `${SITE_URL}/blog/`,
      hasPart: posts.map((post) => ({
        '@type': 'BlogPosting',
        headline: post.title,
        url: `${SITE_URL}/blog/${post.slug}/`,
        datePublished: post.published,
      })),
    },
    body,
  })
}

export function renderFeed(posts) {
  const items = posts.map((post) => `<item>
    <title>${escapeXml(post.title)}</title>
    <link>${SITE_URL}/blog/${post.slug}/</link>
    <guid isPermaLink="true">${SITE_URL}/blog/${post.slug}/</guid>
    <pubDate>${postDate(post).toUTCString()}</pubDate>
    <description>${escapeXml(post.summary)}</description>
  </item>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Mohit Sharma — Security field notes</title>
  <link>${SITE_URL}/blog/</link>
  <description>Methods, tooling, and evidence from Mohit Sharma's applied security research.</description>
  <language>en</language>
  ${items}
</channel></rss>
`
}

export function renderSitemap(posts) {
  const urls = [
    { location: `${SITE_URL}/` },
    { location: `${SITE_URL}/blog/` },
    ...posts.map((post) => ({
      location: `${SITE_URL}/blog/${post.slug}/`,
      modified: post.updated ?? post.published,
    })),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(url.location)}</loc>${url.modified ? `<lastmod>${url.modified}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
}

export function renderManifest(posts) {
  return `${JSON.stringify({
    posts: posts.map(({ slug, title, published, updated }) => ({ slug, title, published, updated })),
  }, null, 2)}\n`
}