import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BlogPublisher,
  CommandError,
  CommandLaunchError,
  CommandOutputError,
  CommandTimeoutError,
} from './publisher.mjs'
import { renderArticle, validatePost, validateSlug } from './lib.mjs'

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
    'cross-origin-resource-policy': 'same-origin',
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
  const body = JSON.stringify(value)
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
  send(response, status, `${body}\n`, 'application/json; charset=utf-8')
}

function expectedRevision(payload) {
  if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'expectedRevision')) {
    const error = new Error('A draft revision is required. Reload the post before saving.')
    error.code = 'BLOG_REVISION_REQUIRED'
    throw error
  }
  const value = payload.expectedRevision
  if (value !== null && (typeof value !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value))) {
    throw new StudioRequestError('expectedRevision must be null or a Git revision.')
  }
  return value
}

function requiredRevision(value) {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)) {
    throw new StudioRequestError('revision must be a Git revision.')
  }
  return value
}

class StudioRequestError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'StudioRequestError'
    this.code = 'BLOG_INVALID_REQUEST'
  }
}

function requestInput(callback) {
  try {
    return callback()
  } catch (error) {
    if (typeof error.code === 'string' && error.code.startsWith('BLOG_')) throw error
    throw new StudioRequestError(error.message, { cause: error })
  }
}

const clientErrors = Object.freeze({
  BLOG_DRAFT_NOT_FOUND: {
    status: 404,
    error: 'The requested blog draft was not found.',
    code: 'BLOG_DRAFT_NOT_FOUND',
  },
  BLOG_INVALID_INPUT: {
    status: 400,
    error: 'The blog request is invalid. Review the studio terminal for details.',
    code: 'BLOG_INVALID_INPUT',
  },
  BLOG_INVALID_REQUEST: {
    status: 400,
    error: 'The blog request is invalid. Review the studio terminal for details.',
    code: 'BLOG_INVALID_REQUEST',
  },
  BLOG_PUBLISH_SCOPE: {
    status: 409,
    error: 'The draft contains changes outside the allowed post and media scope.',
    code: 'BLOG_PUBLISH_SCOPE',
  },
  BLOG_REVISION_CONFLICT: {
    status: 412,
    error: 'This draft changed after it was loaded. Reload it before saving again.',
    code: 'BLOG_REVISION_CONFLICT',
  },
  BLOG_REVISION_REQUIRED: {
    status: 428,
    error: 'A draft revision is required. Reload the post before saving.',
    code: 'BLOG_REVISION_REQUIRED',
  },
})

function invalidInputResponse(error) {
  const failure = clientErrors[error.code]
  if (error.message === 'Video embeds support HTTPS YouTube or Vimeo URLs only.') {
    return {
      ...failure,
      error: 'Video embeds support HTTPS YouTube or Vimeo URLs only.',
    }
  }
  return failure
}

function errorResponse(error) {
  if (['BLOG_INVALID_INPUT', 'BLOG_INVALID_REQUEST'].includes(error.code)) {
    return invalidInputResponse(error)
  }
  if (typeof error.code === 'string' && Object.hasOwn(clientErrors, error.code)) {
    return clientErrors[error.code]
  }
  if (error instanceof CommandTimeoutError) {
    return {
      status: 504,
      error: 'A required command timed out. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_TIMEOUT',
    }
  }
  if (error instanceof CommandError) {
    return {
      status: 502,
      error: 'A required Git, GitHub, or npm command failed. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_FAILED',
    }
  }
  if (error instanceof CommandLaunchError) {
    return {
      status: 502,
      error: 'A required Git, GitHub, or npm command failed. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_LAUNCH',
    }
  }
  if (error instanceof CommandOutputError) {
    return {
      status: 502,
      error: 'A required Git, GitHub, or npm command failed. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_OUTPUT_LIMIT',
    }
  }
  return {
    status: 500,
    error: 'The blog studio encountered an internal error. Review the studio terminal.',
    code: 'BLOG_INTERNAL_ERROR',
  }
}

function matchesToken(value, expected) {
  if (typeof value !== 'string') return false
  const actual = Buffer.from(value)
  const target = Buffer.from(expected)
  return actual.length === target.length && timingSafeEqual(actual, target)
}

function allowsPrivateResource(request, origin, accessToken) {
  if (matchesToken(request.headers['x-blog-studio-token'], accessToken)) return true
  if (request.headers.origin && request.headers.origin !== origin) return false
  return ['none', 'same-origin'].includes(request.headers['sec-fetch-site'])
}

async function readJson(request) {
  const declared = Number(request.headers['content-length'] ?? 0)
  if (declared > maximumRequestBytes) throw new StudioRequestError('Request body exceeds 12 MiB.')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maximumRequestBytes) throw new StudioRequestError('Request body exceeds 12 MiB.')
    chunks.push(chunk)
  }
  if (!size) throw new StudioRequestError('Request body is required.')
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new StudioRequestError('Request body must be a JSON object.')
    }
    return value
  } catch (error) {
    if (error instanceof StudioRequestError) throw error
    throw new StudioRequestError('Request body must be valid JSON.', { cause: error })
  }
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
        if (!allowsPrivateResource(request, origin, accessToken)) {
          send(response, 403, 'Invalid studio resource request.')
          return
        }
        const [, section, mediaSection, slug, name, ...extra] = url.pathname.split('/')
        if (section !== 'blog' || mediaSection !== 'media' || !slug || !name || extra.length) {
          throw new StudioRequestError('Invalid media path.')
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
        const slug = requestInput(() => validateSlug(url.searchParams.get('slug')))
        const source = url.searchParams.get('source') ?? 'published'
        if (!['draft', 'published'].includes(source)) {
          throw new StudioRequestError('source must be draft or published.')
        }
        json(response, 200, await publisher.readPost(slug, source))
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/status') {
        const slug = requestInput(() => validateSlug(url.searchParams.get('slug')))
        const revision = requiredRevision(url.searchParams.get('revision'))
        json(response, 200, await publisher.status(slug, revision))
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
        const html = requestInput(() => {
          const post = validatePost(payload.post, { draft: true })
          return renderArticle(post, { preview: true })
        })
        json(response, 200, { html })
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
      if (url.pathname === '/api/reconcile') {
        json(response, 200, await publisher.reconcile(
          payload.post,
          payload.media ?? [],
          expectedRevision(payload),
        ))
        return
      }
      if (url.pathname === '/api/publish') {
        requestInput(() => validatePost(payload.post))
        const result = await publisher.saveAndPublish(
          payload.post,
          payload.media ?? [],
          expectedRevision(payload),
        )
        if (result.published.diagnostic) logger.error(result.published.diagnostic)
        json(response, 200, result)
        return
      }
      send(response, 404, 'Not found.')
    } catch (error) {
      logger.error(error)
      const failure = errorResponse(error)
      json(response, failure.status, {
        error: failure.error,
        code: failure.code,
        ...(error.outcomeUnknown ? { outcomeUnknown: true } : {}),
        ...(error.recovery?.draft ? {
          recovery: {
            draft: {
              branch: error.recovery.draft.branch,
              sha: error.recovery.draft.sha,
            },
            publicationPending: error.recovery.publicationPending === true,
          },
        } : {}),
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