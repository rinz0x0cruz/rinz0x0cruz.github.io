import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BlogPublisher } from './publisher.mjs'
import { renderArticle, validatePost } from './lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const studioDirectory = join(root, 'studio')
const publicDirectory = join(root, 'public')
const maximumRequestBytes = 12 * 1024 * 1024
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
}

function headers(contentType = 'text/plain; charset=utf-8') {
  return {
    'cache-control': 'no-store',
    'content-type': contentType,
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; frame-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  }
}

function send(response, status, body, contentType) {
  response.writeHead(status, headers(contentType))
  response.end(body)
}

function json(response, status, value) {
  send(response, status, `${JSON.stringify(value)}\n`, 'application/json; charset=utf-8')
}

function expectedRevision(payload) {
  if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'expectedRevision')) {
    const error = new Error('A draft revision is required. Reload the post before saving.')
    error.code = 'BLOG_REVISION_REQUIRED'
    throw error
  }
  const value = payload.expectedRevision
  if (value !== null && (typeof value !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value))) {
    throw new Error('expectedRevision must be null or a Git revision.')
  }
  return value
}

function errorStatus(error) {
  if (error.code === 'BLOG_REVISION_REQUIRED') return 428
  if (error.code === 'BLOG_REVISION_CONFLICT') return 412
  return 400
}

function matchesToken(value, expected) {
  if (typeof value !== 'string') return false
  const actual = Buffer.from(value)
  const target = Buffer.from(expected)
  return actual.length === target.length && timingSafeEqual(actual, target)
}

async function readJson(request) {
  const declared = Number(request.headers['content-length'] ?? 0)
  if (declared > maximumRequestBytes) throw new Error('Request body exceeds 12 MiB.')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maximumRequestBytes) throw new Error('Request body exceeds 12 MiB.')
    chunks.push(chunk)
  }
  if (!size) throw new Error('Request body is required.')
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function safePath(base, requestPath) {
  const relative = normalize(requestPath).replace(/^[/\\]+/u, '')
  const path = resolve(base, relative)
  if (path !== base && !path.startsWith(`${base}\\`) && !path.startsWith(`${base}/`)) {
    throw new Error('Invalid path.')
  }
  return path
}

async function serveFile(response, path) {
  const info = await stat(path)
  if (!info.isFile()) throw new Error('Not a file.')
  response.writeHead(200, {
    ...headers(contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream'),
    'content-length': info.size,
  })
  createReadStream(path).pipe(response)
}

export function createStudioServer({
  publisher = new BlogPublisher({ repoRoot: root }),
  csrf = randomBytes(32).toString('base64url'),
  accessToken = randomBytes(32).toString('base64url'),
  logger = console,
} = {}) {
  return createServer(async (request, response) => {
    const host = request.headers.host ?? ''
    if (!/^(?:127\.0\.0\.1|localhost):\d+$/u.test(host)) {
      send(response, 403, 'Forbidden host.')
      return
    }
    const origin = `http://${host}`
    const url = new URL(request.url ?? '/', origin)

    if (url.pathname.startsWith('/api/') && !matchesToken(request.headers['x-blog-studio-token'], accessToken)) {
      json(response, 401, { error: 'Studio token required.' })
      return
    }

    try {
      if (request.method === 'GET' && url.pathname === '/') {
        const page = (await readFile(join(studioDirectory, 'index.html'), 'utf8')).replace('__CSRF__', csrf)
        send(response, 200, page, 'text/html; charset=utf-8')
        return
      }
      if (request.method === 'GET' && ['/studio.js', '/studio.css'].includes(url.pathname)) {
        await serveFile(response, safePath(studioDirectory, url.pathname))
        return
      }
      if (request.method === 'GET' && url.pathname === '/blog.css') {
        await serveFile(response, join(publicDirectory, 'blog.css'))
        return
      }
      if (request.method === 'GET' && url.pathname.startsWith('/blog/media/')) {
        const [, section, mediaSection, slug, name, ...extra] = url.pathname.split('/')
        if (section !== 'blog' || mediaSection !== 'media' || !slug || !name || extra.length) {
          throw new Error('Invalid media path.')
        }
        let media
        try {
          media = await publisher.readMedia(slug, name, 'draft')
        } catch (error) {
          if (error.code !== 'BLOG_DRAFT_NOT_FOUND') throw error
          media = await publisher.readMedia(slug, name, 'published')
        }
        send(response, 200, media.buffer, media.contentType)
        return
      }
      if (request.method === 'GET' && url.pathname.startsWith('/fonts/')) {
        await serveFile(response, safePath(publicDirectory, url.pathname))
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/health') {
        json(response, 200, { service: 'portfolio-blog-studio', status: 'ok' })
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/posts') {
        json(response, 200, await publisher.listPosts())
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/post') {
        json(response, 200, await publisher.readPost(url.searchParams.get('slug'), url.searchParams.get('source') ?? 'published'))
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/status') {
        json(response, 200, await publisher.status(url.searchParams.get('slug')))
        return
      }

      if (request.method !== 'POST') {
        send(response, 404, 'Not found.')
        return
      }
      if (request.headers.origin !== origin || request.headers['x-blog-studio-csrf'] !== csrf) {
        send(response, 403, 'Invalid studio request.')
        return
      }
      if (request.headers['content-type']?.split(';', 1)[0] !== 'application/json') {
        send(response, 415, 'JSON required.')
        return
      }

      const payload = await readJson(request)
      if (url.pathname === '/api/preview') {
        const post = validatePost(payload.post, { draft: true })
        json(response, 200, { html: renderArticle(post, { preview: true }) })
        return
      }
      if (url.pathname === '/api/draft') {
        json(response, 200, await publisher.saveDraft(
          payload.post,
          payload.media ?? [],
          expectedRevision(payload),
        ))
        return
      }
      if (url.pathname === '/api/publish') {
        validatePost(payload.post)
        json(response, 200, await publisher.saveAndPublish(
          payload.post,
          payload.media ?? [],
          expectedRevision(payload),
        ))
        return
      }
      send(response, 404, 'Not found.')
    } catch (error) {
      logger.error(error)
      json(response, errorStatus(error), {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      })
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.BLOG_STUDIO_PORT ?? 4422)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('BLOG_STUDIO_PORT is invalid.')
  const accessToken = randomBytes(32).toString('base64url')
  const server = createStudioServer({ accessToken })
  server.listen(port, '127.0.0.1', () => {
    console.log(`Blog studio: http://127.0.0.1:${port}/#token=${accessToken}`)
  })
}