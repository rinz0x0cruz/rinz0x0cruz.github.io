import { readFile, readdir, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parsePostSource,
  referencedMediaNames,
  renderArticle,
  renderFeed,
  renderIndex,
  renderManifest,
  renderSitemap,
  SITE_URL,
} from './lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const postsDirectory = join(root, 'content', 'blog')
const outputDirectory = join(root, 'dist')

async function writeAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, content, 'utf8')
  await rename(temporary, path)
}

function normalizeRevision(value) {
  if (value === 'local') return value
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu.test(value)) {
    throw new Error('Build revision must be a Git SHA or "local".')
  }
  return value.toLowerCase()
}

export async function loadPublishedPosts(directory = postsDirectory) {
  await mkdir(directory, { recursive: true })
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .sort((left, right) => left.name.localeCompare(right.name))
  const posts = []
  for (const entry of entries) {
    const slug = basename(entry.name, '.md')
    posts.push(parsePostSource(await readFile(join(directory, entry.name), 'utf8'), slug))
  }
  return posts.sort((left, right) => (
    right.published.localeCompare(left.published) || left.slug.localeCompare(right.slug)
  ))
}

export async function buildBlog({
  postsDir = postsDirectory,
  outDir = outputDirectory,
  revision = process.env.GITHUB_SHA ?? 'local',
} = {}) {
  const buildRevision = normalizeRevision(revision)
  const posts = await loadPublishedPosts(postsDir)
  const blogDirectory = join(outDir, 'blog')
  await mkdir(blogDirectory, { recursive: true })
  for (const entry of await readdir(blogDirectory)) {
    if (entry !== 'media') await rm(join(blogDirectory, entry), { recursive: true, force: true })
  }
  for (const post of posts) {
    for (const name of referencedMediaNames(post)) {
      const mediaPath = join(blogDirectory, 'media', post.slug, name)
      try {
        if (!(await stat(mediaPath)).isFile()) throw new Error('Not a file.')
      } catch {
        throw new Error(`Post ${post.slug} references missing media: ${name}.`)
      }
    }
  }
  await writeAtomic(join(blogDirectory, 'index.html'), renderIndex(posts))
  await writeAtomic(join(blogDirectory, 'feed.xml'), renderFeed(posts))
  await writeAtomic(join(blogDirectory, 'manifest.json'), renderManifest(posts))
  for (const post of posts) {
    await writeAtomic(join(blogDirectory, post.slug, 'index.html'), renderArticle(post))
  }
  await writeAtomic(join(outDir, 'sitemap.xml'), renderSitemap(posts))
  await writeAtomic(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`)
  await writeAtomic(join(outDir, 'build-meta.json'), `${JSON.stringify({ revision: buildRevision })}\n`)
  return posts
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const posts = await buildBlog()
  console.log(`Built ${posts.length} blog post${posts.length === 1 ? '' : 's'}.`)
}