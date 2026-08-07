import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, open, readFile, readdir, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import {
  parsePostSource,
  referencedMediaNames,
  serializePost,
  SITE_URL,
  validateSlug,
} from './lib.mjs'

const maximumMediaBytes = 2 * 1024 * 1024
const maximumMediaTotalBytes = 8 * 1024 * 1024
const maximumMediaFiles = 8
const maximumCommandOutputBytes = 4 * 1024 * 1024
const repositoryName = 'rinz0x0cruz/rinz0x0cruz.github.io'
const pullRequestFields = [
  'baseRefName',
  'headRefName',
  'headRefOid',
  'headRepositoryOwner',
  'isCrossRepository',
  'mergeStateStatus',
  'number',
  'state',
  'statusCheckRollup',
  'url',
].join(',')

export class CommandError extends Error {
  constructor(command, args, code, stdout, stderr) {
    super(`${command} ${args.join(' ')} exited with code ${code}: ${stderr.trim()}`)
    this.name = 'CommandError'
    this.command = command
    this.args = args
    this.code = code
    this.stdout = stdout
    this.stderr = stderr
  }
}

export class CommandTimeoutError extends Error {
  constructor(command, timeout) {
    super(`${command} timed out after ${timeout} ms.`)
    this.name = 'CommandTimeoutError'
    this.code = 'BLOG_COMMAND_TIMEOUT'
  }
}

export class CommandOutputError extends Error {
  constructor(command, maximumBytes) {
    super(`${command} output exceeded ${maximumBytes} bytes.`)
    this.name = 'CommandOutputError'
    this.code = 'BLOG_COMMAND_OUTPUT_LIMIT'
  }
}

export class CommandLaunchError extends Error {
  constructor(command, options) {
    super(`${command} could not be started.`, options)
    this.name = 'CommandLaunchError'
    this.code = 'BLOG_COMMAND_LAUNCH'
  }
}

export class BlogInputError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'BlogInputError'
    this.code = 'BLOG_INVALID_INPUT'
  }
}

function terminateProcessTree(child) {
  if (!child.pid) return
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      timeout: 5_000,
      windowsHide: true,
    })
    if (result.status !== 0) child.kill('SIGKILL')
    return
  }
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

export function runCommand(command, args, {
  cwd,
  encoding = 'utf8',
  env = process.env,
  maxOutputBytes = maximumCommandOutputBytes,
  timeout = 10 * 60_000,
} = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child
    try {
      child = spawn(command, args, {
        cwd,
        detached: process.platform !== 'win32',
        env,
        shell: false,
        windowsHide: true,
      })
    } catch (error) {
      rejectPromise(new CommandLaunchError(command, { cause: error }))
      return
    }
    let stdout = encoding ? '' : []
    let stderr = ''
    let outputBytes = 0
    let settled = false
    let terminationError
    const terminate = (error) => {
      if (terminationError) return
      terminationError = error
      terminateProcessTree(child)
    }
    const timer = setTimeout(() => {
      terminate(new CommandTimeoutError(command, timeout))
    }, timeout)
    if (encoding) child.stdout.setEncoding(encoding)
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      outputBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      if (outputBytes > maxOutputBytes) {
        terminate(new CommandOutputError(command, maxOutputBytes))
        return
      }
      if (encoding) stdout += chunk
      else stdout.push(chunk)
    })
    child.stderr.on('data', (chunk) => {
      outputBytes += Buffer.byteLength(chunk)
      if (outputBytes > maxOutputBytes) {
        terminate(new CommandOutputError(command, maxOutputBytes))
        return
      }
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      rejectPromise(new CommandLaunchError(command, { cause: error }))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      if (terminationError) {
        rejectPromise(terminationError)
        return
      }
      const output = encoding ? stdout : Buffer.concat(stdout)
      if (code === 0) resolvePromise({ stdout: output, stderr })
      else rejectPromise(new CommandError(command, args, code, output, stderr))
    })
  })
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function writeAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const expected = sha256(value)
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`
  const handle = await open(temporary, 'wx')
  try {
    await handle.writeFile(value)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, path)
  if (sha256(await readFile(path)) !== expected) throw new Error(`Atomic write verification failed for ${path}.`)
}

function mediaKind(buffer) {
  if (
    buffer.length >= 20
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    && buffer.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]))
  ) return 'png'
  if (
    buffer.length >= 16
    && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    && buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
  ) return 'jpg'
  if (
    buffer.length >= 20
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    && buffer.readUInt32LE(4) + 8 === buffer.length
  ) return 'webp'
  if (
    buffer.length >= 7
    && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
    && buffer.at(-1) === 0x3b
  ) return 'gif'
  if (
    buffer.length >= 16
    && buffer.subarray(4, 12).toString('ascii') === 'ftypavif'
    && buffer.readUInt32BE(0) >= 16
    && buffer.readUInt32BE(0) <= buffer.length
  ) return 'avif'
  return undefined
}

const mediaContentTypes = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function validateMediaName(value) {
  const name = basename(String(value ?? ''))
  if (name !== value || !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(name)) {
    throw new Error('Media filenames must use lowercase letters, numbers, dots, underscores, and hyphens.')
  }
  return name
}

function decodeMedia(media, slug) {
  if (!Array.isArray(media)) throw new Error('media must be an array.')
  if (media.length > maximumMediaFiles) throw new Error(`A post can upload at most ${maximumMediaFiles} files.`)
  const names = new Set()
  let total = 0
  return media.map((entry) => {
    const name = validateMediaName(entry.name)
    if (names.has(name)) throw new Error('Media filenames must be unique.')
    names.add(name)
    const buffer = Buffer.from(String(entry.data ?? ''), 'base64')
    if (!buffer.length || buffer.length > maximumMediaBytes) {
      throw new Error(`${name} must be between 1 byte and ${maximumMediaBytes} bytes.`)
    }
    total += buffer.length
    if (total > maximumMediaTotalBytes) throw new Error('Total media exceeds 8 MiB.')
    const kind = mediaKind(buffer)
    const extension = name.split('.').at(-1).toLowerCase().replace('jpeg', 'jpg')
    if (!kind || kind !== extension) throw new Error(`${name} content does not match its extension.`)
    return {
      buffer,
      relativePath: `public/blog/media/${slug}/${name}`,
      publicPath: `/blog/media/${slug}/${name}`,
    }
  })
}

function draftBranch(slug) {
  return `draft/blog/${validateSlug(slug)}`
}

function parseJson(value, fallback) {
  if (!value.trim()) return fallback
  return JSON.parse(value)
}

function validateExpectedRevision(value) {
  if (value === null) return null
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)) {
    const error = new Error('A valid draft revision is required. Reload the post before saving.')
    error.code = 'BLOG_REVISION_REQUIRED'
    throw error
  }
  return value
}

function revisionConflict(currentRevision) {
  const error = new Error('This draft changed after it was loaded. Reload it before saving again.')
  error.code = 'BLOG_REVISION_CONFLICT'
  if (currentRevision) error.currentRevision = currentRevision
  return error
}

export class BlogPublisher {
  constructor({
    repoRoot,
    commandRunner = runCommand,
    repository = repositoryName,
    npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm',
  }) {
    this.repoRoot = resolve(repoRoot)
    this.commandRunner = commandRunner
    this.repository = repository
    this.npmCommand = npmCommand
    this.branchLocks = new Map()
    this.fetchPromise = null
  }

  command(command, args, options = {}) {
    return this.commandRunner(command, args, { cwd: this.repoRoot, ...options })
  }

  git(args, cwd = this.repoRoot) {
    return this.command('git', args, { cwd })
  }

  gh(args, cwd = this.repoRoot) {
    return this.command('gh', args, { cwd })
  }

  async pullRequests(branch, state, { cwd = this.repoRoot, expectedSha } = {}) {
    const owner = this.repository.split('/')[0].toLowerCase()
    const result = await this.gh([
      'pr', 'list', '--repo', this.repository, '--head', branch, '--state', state,
      '--limit', '20', '--json', pullRequestFields,
    ], cwd)
    return parseJson(result.stdout, []).filter((pullRequest) => (
      pullRequest.baseRefName === 'main'
      && pullRequest.headRefName === branch
      && pullRequest.headRepositoryOwner?.login?.toLowerCase() === owner
      && pullRequest.isCrossRepository === false
      && (!expectedSha || pullRequest.headRefOid === expectedSha)
    ))
  }

  async fetch({ fresh = false } = {}) {
    if (fresh && this.fetchPromise) {
      try {
        await this.fetchPromise
      } catch {}
    }
    if (!this.fetchPromise) {
      const operation = this.git(['fetch', 'origin', '--prune'])
      const tracked = operation.finally(() => {
        if (this.fetchPromise === tracked) this.fetchPromise = null
      })
      this.fetchPromise = tracked
    }
    await this.fetchPromise
  }

  async pushBranch(branch, expectedRevision, directory) {
    const sha = (await this.git(['rev-parse', 'HEAD'], directory)).stdout.trim()
    try {
      await this.git([
        'push', `--force-with-lease=refs/heads/${branch}:${expectedRevision ?? ''}`,
        'origin', `HEAD:refs/heads/${branch}`,
      ], directory)
    } catch (error) {
      if (error instanceof CommandError && /\(stale info\)/u.test(error.stderr)) {
        throw revisionConflict()
      }
      try {
        await this.fetch({ fresh: true })
      } catch (verificationError) {
        error.outcomeUnknown = true
        error.verificationDiagnostic = verificationError
        throw error
      }
      let exists
      try {
        exists = await this.branchExists(branch)
      } catch (verificationError) {
        error.outcomeUnknown = true
        error.verificationDiagnostic = verificationError
        throw error
      }
      if (!exists) {
        if (expectedRevision) throw revisionConflict()
        throw error
      }
      let remote
      try {
        remote = (await this.git([
          'rev-parse', `origin/${branch}`,
        ])).stdout.trim()
      } catch (verificationError) {
        error.outcomeUnknown = true
        error.verificationDiagnostic = verificationError
        throw error
      }
      if (remote === sha) return sha
      if (remote !== expectedRevision) throw revisionConflict(remote)
      throw error
    }
    return sha
  }

  async branchExists(branch) {
    try {
      await this.git(['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`])
      return true
    } catch (error) {
      if (error instanceof CommandError && error.code === 1) return false
      throw error
    }
  }

  async withBranchLock(branch, callback) {
    const previous = this.branchLocks.get(branch) ?? Promise.resolve()
    let release
    const current = new Promise((resolvePromise) => { release = resolvePromise })
    const tail = previous.catch(() => {}).then(() => current)
    this.branchLocks.set(branch, tail)
    await previous.catch(() => {})
    try {
      return await callback()
    } finally {
      release()
      if (this.branchLocks.get(branch) === tail) this.branchLocks.delete(branch)
    }
  }

  async listPosts() {
    await this.fetch()
    const publishedResult = await this.git(['ls-tree', '-r', '--name-only', 'origin/main', '--', 'content/blog'])
    const published = publishedResult.stdout
      .split(/\r?\n/u)
      .filter((path) => path.endsWith('.md'))
      .map((path) => basename(path, '.md'))
    const draftResult = await this.git(['ls-remote', '--heads', 'origin', 'refs/heads/draft/blog/*'])
    const drafts = draftResult.stdout
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => line.split('\t')[1]?.replace('refs/heads/draft/blog/', ''))
      .filter(Boolean)
    return { published: [...new Set(published)].sort(), drafts: [...new Set(drafts)].sort() }
  }

  async readPost(slug, source = 'published') {
    validateSlug(slug)
    await this.fetch()
    const ref = source === 'draft' ? `origin/${draftBranch(slug)}` : 'origin/main'
    if (source === 'draft' && !(await this.branchExists(draftBranch(slug)))) {
      const error = new Error(`Draft ${slug} does not exist.`)
      error.code = 'BLOG_DRAFT_NOT_FOUND'
      throw error
    }
    const revision = (await this.git(['rev-parse', ref])).stdout.trim()
    const result = await this.git(['show', `${revision}:content/blog/${slug}.md`])
    return {
      post: parsePostSource(result.stdout, slug, { draft: source === 'draft' }),
      revision,
    }
  }

  async readMedia(slug, name, source = 'published') {
    validateSlug(slug)
    const filename = validateMediaName(name)
    await this.fetch()
    const ref = source === 'draft' ? `origin/${draftBranch(slug)}` : 'origin/main'
    if (source === 'draft' && !(await this.branchExists(draftBranch(slug)))) {
      const error = new Error(`Draft ${slug} does not exist.`)
      error.code = 'BLOG_DRAFT_NOT_FOUND'
      throw error
    }
    const result = await this.command('git', [
      'show', `${ref}:public/blog/media/${slug}/${filename}`,
    ], { encoding: null })
    const kind = mediaKind(result.stdout)
    const extension = filename.split('.').at(-1).toLowerCase().replace('jpeg', 'jpg')
    if (!kind || kind !== extension) throw new Error(`${filename} content does not match its extension.`)
    return { buffer: result.stdout, contentType: mediaContentTypes[kind] }
  }

  async withWorktree(branch, callback, { rebase = false, startPoint } = {}) {
    await this.fetch()
    const directory = await mkdtemp(join(tmpdir(), 'portfolio-blog-'))
    await rm(directory, { recursive: true, force: true })
    const exists = await this.branchExists(branch)
    const source = startPoint ?? (exists ? `origin/${branch}` : 'origin/main')
    let operationError
    let result
    try {
      await this.git(['worktree', 'add', '-B', branch, directory, source])
      if (rebase) await this.git(['rebase', 'origin/main'], directory)
      result = await callback(directory, exists)
    } catch (error) {
      operationError = error
    }

    let cleanupError
    try {
      await this.git(['worktree', 'remove', '--force', directory])
    } catch {
      try {
        await rm(directory, { recursive: true, force: true })
      } catch (error) {
        cleanupError = error
      }
      try {
        await this.git(['worktree', 'prune'])
      } catch (error) {
        cleanupError ??= error
      }
    }

    if (operationError) {
      if (cleanupError) {
        operationError.cleanupDiagnostic = cleanupError
      }
      throw operationError
    }
    if (cleanupError) throw cleanupError
    return result
  }

  prepareDraft(post, media = []) {
    try {
      const source = serializePost(post, { draft: true })
      const slug = validateSlug(post.slug)
      const files = decodeMedia(media, slug)
      const branch = draftBranch(slug)
      const retained = referencedMediaNames(post)
      for (const file of files) retained.add(basename(file.relativePath))
      return {
        branch,
        files,
        retained,
        slug,
        source,
        title: post.metadata?.title ?? post.title,
      }
    } catch (error) {
      if (typeof error.code === 'string' && error.code.startsWith('BLOG_')) throw error
      throw new BlogInputError(error.message, { cause: error })
    }
  }

  async assertExpectedRevision(branch, value) {
    const expected = validateExpectedRevision(value)
    await this.fetch()
    const exists = await this.branchExists(branch)
    const ref = exists ? `origin/${branch}` : 'origin/main'
    const current = (await this.git(['rev-parse', ref])).stdout.trim()
    if ((!exists && expected === null) || current === expected) {
      return { baseRevision: current, branchRevision: exists ? current : null }
    }
    throw revisionConflict(current)
  }

  async revisionEntries(revision, paths) {
    return (await this.git([
      'ls-tree', '-r', '-z', revision, '--', ...paths,
    ])).stdout
      .split('\0')
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('\t')
        const metadata = entry.slice(0, separator)
        const path = entry.slice(separator + 1)
        const [mode, type, object] = metadata.split(' ', 3)
        return { mode, object, path, type }
      })
  }

  async assertPublishScope(slug, revision) {
    const result = await this.git([
      'diff', '--name-only', '--no-renames', '-z', `origin/main...${revision}`, '--',
    ])
    const postPath = `content/blog/${slug}.md`
    const mediaRoot = `public/blog/media/${slug}`
    const mediaPrefix = `${mediaRoot}/`
    const mediaNamePattern = /^[a-z0-9][a-z0-9._-]{0,79}$/u
    const isAllowedPath = (path) => (
      path === postPath
      || (
        path.startsWith(mediaPrefix)
        && mediaNamePattern.test(path.slice(mediaPrefix.length))
      )
    )
    const unexpected = result.stdout
      .split('\0')
      .filter(Boolean)
      .filter((path) => !isAllowedPath(path))
    const entries = await this.revisionEntries(revision, [postPath, mediaRoot])
    const unsafeEntries = entries.filter(({ mode, path, type }) => (
      !isAllowedPath(path) || mode !== '100644' || type !== 'blob'
    ))
    const mediaEntries = entries.filter(({ path }) => path !== postPath)
    let totalMediaBytes = 0
    let invalidMedia = mediaEntries.length > maximumMediaFiles
    for (const entry of mediaEntries) {
      const name = entry.path.slice(mediaPrefix.length)
      const size = Number((await this.git([
        'cat-file', '-s', `${revision}:${entry.path}`,
      ])).stdout.trim())
      totalMediaBytes += size
      if (
        !Number.isSafeInteger(size)
        || size < 1
        || size > maximumMediaBytes
        || totalMediaBytes > maximumMediaTotalBytes
      ) {
        invalidMedia = true
        continue
      }
      let validName = true
      try {
        validateMediaName(name)
      } catch {
        validName = false
      }
      const buffer = (await this.command('git', [
        'show', `${revision}:${entry.path}`,
      ], { encoding: null })).stdout
      const kind = mediaKind(buffer)
      const extension = name.split('.').at(-1).toLowerCase().replace('jpeg', 'jpg')
      if (!validName || !kind || kind !== extension) invalidMedia = true
    }
    if (
      unexpected.length
      || unsafeEntries.length
      || invalidMedia
      || !entries.some(({ path }) => path === postPath)
    ) {
      const error = new Error('Draft branch contains changes outside its post and media directory.')
      error.code = 'BLOG_PUBLISH_SCOPE'
      throw error
    }
  }

  async expectedDraftTree(draft, expectedRevision) {
    const postPath = `content/blog/${draft.slug}.md`
    const mediaPrefix = `public/blog/media/${draft.slug}/`
    const expected = new Map([[postPath, Buffer.from(draft.source, 'utf8')]])
    for (const file of draft.files) expected.set(file.relativePath, file.buffer)
    for (const name of draft.retained) {
      const path = `${mediaPrefix}${name}`
      if (expected.has(path)) continue
      if (!expectedRevision) return null
      try {
        const media = await this.command('git', [
          'show', `${expectedRevision}:${path}`,
        ], { encoding: null })
        expected.set(path, media.stdout)
      } catch (error) {
        if (!(error instanceof CommandError && error.code === 128)) throw error
        return null
      }
    }
    return expected
  }

  async revisionMatchesDraft(revision, draft, expectedRevision) {
    try {
      const expected = await this.expectedDraftTree(draft, expectedRevision)
      if (!expected) return false
      const postPath = `content/blog/${draft.slug}.md`
      const mediaRoot = `public/blog/media/${draft.slug}`
      const entries = await this.revisionEntries(revision, [postPath, mediaRoot])
      if (
        entries.length !== expected.size
        || entries.some(({ mode, path, type }) => (
          mode !== '100644' || type !== 'blob' || !expected.has(path)
        ))
      ) return false
      for (const { path } of entries) {
        const actual = await this.command('git', [
          'show', `${revision}:${path}`,
        ], { encoding: null })
        if (!actual.stdout.equals(expected.get(path))) return false
      }
      return true
    } catch (error) {
      if (error instanceof CommandError && error.code === 128) return false
      throw error
    }
  }

  async reconcile(post, media = [], expectedRevision) {
    const draft = this.prepareDraft(post, media)
    const previousRevision = validateExpectedRevision(expectedRevision)
    return this.withBranchLock(draft.branch, async () => {
      await this.fetch()
      if (await this.branchExists(draft.branch)) {
        const revision = (await this.git([
          'rev-parse', `origin/${draft.branch}`,
        ])).stdout.trim()
        if (await this.revisionMatchesDraft(revision, draft, previousRevision)) {
          return {
            branch: draft.branch,
            liveUrl: `${SITE_URL}/blog/${draft.slug}/`,
            pullRequest: null,
            published: false,
            revision,
          }
        }
      }

      const revision = (await this.git(['rev-parse', 'origin/main'])).stdout.trim()
      if (!(await this.revisionMatchesDraft(revision, draft, previousRevision))) return null
      return {
        branch: draft.branch,
        liveUrl: `${SITE_URL}/blog/${draft.slug}/`,
        pullRequest: null,
        published: true,
        revision,
      }
    })
  }

  async savePreparedDraft(
    { branch, files, retained, slug, source, title },
    { baseRevision, expectedRevision },
  ) {
    let durableRevision
    try {
      if (expectedRevision) await this.assertPublishScope(slug, baseRevision)
      return await this.withWorktree(branch, async (directory) => {
        const relativePostPath = `content/blog/${slug}.md`
        const relativeMediaDirectory = `public/blog/media/${slug}`
        await writeAtomic(join(directory, relativePostPath), Buffer.from(source, 'utf8'))
        for (const file of files) await writeAtomic(join(directory, file.relativePath), file.buffer)
        const removed = []
        try {
          for (const entry of await readdir(join(directory, relativeMediaDirectory))) {
            if (retained.has(entry)) continue
            await rm(join(directory, relativeMediaDirectory, entry), { recursive: true, force: true })
            removed.push(`${relativeMediaDirectory}/${entry}`)
          }
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
        const paths = [relativePostPath, ...files.map((file) => file.relativePath), ...removed]
        await this.git(['add', '-A', '--', ...paths], directory)
        const staged = await this.git(['diff', '--cached', '--name-only'], directory)
        if (staged.stdout.trim()) {
          await this.git(['commit', '-m', `Draft blog: ${title}`], directory)
        }
        const sha = await this.pushBranch(branch, expectedRevision, directory)
        durableRevision = sha
        return { branch, sha, media: files.map((file) => file.publicPath) }
      }, { startPoint: baseRevision })
    } catch (error) {
      if (durableRevision && !error.recovery?.draft) {
        error.recovery = { draft: { branch, sha: durableRevision } }
      }
      throw error
    }
  }

  async saveDraft(post, media = [], expectedRevision) {
    const draft = this.prepareDraft(post, media)
    return this.withBranchLock(draft.branch, async () => {
      const revisions = await this.assertExpectedRevision(draft.branch, expectedRevision)
      return this.savePreparedDraft(draft, {
        baseRevision: revisions.baseRevision,
        expectedRevision: revisions.branchRevision,
      })
    })
  }

  async publishBranch(slug, branch, expectedRevision) {
    let baseRevision
    if (expectedRevision === undefined) {
      if (!(await this.branchExistsAfterFetch(branch))) throw new Error(`Draft ${slug} does not exist.`)
      baseRevision = (await this.git(['rev-parse', `origin/${branch}`])).stdout.trim()
    } else {
      baseRevision = (await this.assertExpectedRevision(branch, expectedRevision)).baseRevision
    }
    await this.assertPublishScope(slug, baseRevision)
    let durableRevision = baseRevision
    let publicationPending = false
    try {
      return await this.withWorktree(branch, async (directory) => {
        const postPath = join(directory, 'content', 'blog', `${slug}.md`)
        const post = parsePostSource(await readFile(postPath, 'utf8'), slug)
        await this.command(this.npmCommand, ['ci'], { cwd: directory, timeout: 5 * 60_000 })
        await this.command(this.npmCommand, ['test'], { cwd: directory, timeout: 15 * 60_000 })
        const sha = await this.pushBranch(branch, baseRevision, directory)
        durableRevision = sha
        publicationPending = true
        let pullRequests = await this.pullRequests(branch, 'open', {
          cwd: directory,
          expectedSha: sha,
        })
        if (!pullRequests.length) {
          const body = `Publishes \`${post.title}\` from the local blog studio.\n\n- Static content validation passed\n- Full portfolio test suite passed\n`
          await this.gh([
            'pr', 'create', '--repo', this.repository, '--base', 'main', '--head', branch,
            '--title', `Publish blog: ${post.title}`, '--body', body,
          ], directory)
          pullRequests = await this.pullRequests(branch, 'open', {
            cwd: directory,
            expectedSha: sha,
          })
        }
        const pullRequest = pullRequests[0]
        if (!pullRequest) throw new Error('GitHub did not return the created pull request.')
        let autoMergeQueued = true
        let autoMergeError
        let autoMergeDiagnostic
        try {
          await this.gh([
            'pr', 'merge', String(pullRequest.number), '--repo', this.repository,
            '--auto', '--squash', '--delete-branch', '--match-head-commit', sha,
          ], directory)
        } catch (error) {
          autoMergeQueued = false
          autoMergeError = 'Auto-merge could not be queued. Review the studio terminal.'
          autoMergeDiagnostic = error
        }
        const result = { branch, sha, pullRequest, autoMergeQueued, autoMergeError }
        if (autoMergeDiagnostic) {
          Object.defineProperty(result, 'diagnostic', { value: autoMergeDiagnostic })
        }
        return result
      }, { rebase: true, startPoint: baseRevision })
    } catch (error) {
      if (error.code !== 'BLOG_REVISION_CONFLICT' && !error.recovery?.draft) {
        error.recovery = {
          draft: { branch, sha: durableRevision },
          publicationPending,
        }
      }
      throw error
    }
  }

  async saveAndPublish(post, media = [], expectedRevision) {
    const draft = this.prepareDraft(post, media)
    const previousRevision = validateExpectedRevision(expectedRevision)
    return this.withBranchLock(draft.branch, async () => {
      await this.fetch()
      const branchExists = await this.branchExists(draft.branch)
      let branchRevision = null
      let branchMatches = false
      if (branchExists) {
        branchRevision = (await this.git([
          'rev-parse', `origin/${draft.branch}`,
        ])).stdout.trim()
        if (branchRevision !== previousRevision) throw revisionConflict(branchRevision)
        branchMatches = await this.revisionMatchesDraft(
          branchRevision,
          draft,
          previousRevision,
        )
      }
      const mainRevision = (await this.git(['rev-parse', 'origin/main'])).stdout.trim()
      if (
        (!branchExists || branchMatches)
        && await this.revisionMatchesDraft(mainRevision, draft, previousRevision)
      ) {
        const durable = {
          branch: draft.branch,
          media: draft.files.map((file) => file.publicPath),
          sha: branchRevision ?? mainRevision,
        }
        return {
          draft: durable,
          published: {
            alreadyPublished: true,
            autoMergeQueued: false,
            branch: draft.branch,
            liveUrl: `${SITE_URL}/blog/${draft.slug}/`,
            pullRequest: null,
            sha: mainRevision,
          }
        }
      }
      const revisions = await this.assertExpectedRevision(draft.branch, previousRevision)
      const saved = await this.savePreparedDraft(draft, {
        baseRevision: revisions.baseRevision,
        expectedRevision: revisions.branchRevision,
      })
      try {
        const published = await this.publishBranch(draft.slug, draft.branch, saved.sha)
        return { draft: saved, published }
      } catch (error) {
        if (error.code !== 'BLOG_REVISION_CONFLICT' && !error.recovery?.draft) {
          error.recovery = { draft: saved }
        }
        throw error
      }
    })
  }

  async publish(slug) {
    validateSlug(slug)
    const branch = draftBranch(slug)
    return this.withBranchLock(branch, () => this.publishBranch(slug, branch))
  }

  async branchExistsAfterFetch(branch) {
    await this.fetch()
    return this.branchExists(branch)
  }

  async status(slug, expectedRevision) {
    const branch = draftBranch(slug)
    const revision = validateExpectedRevision(expectedRevision)
    if (!revision) throw new BlogInputError('A status revision is required.')
    const pullRequest = (await this.pullRequests(branch, 'all', {
      expectedSha: revision,
    }))[0] ?? null
    return { branch, pullRequest, liveUrl: `${SITE_URL}/blog/${slug}/` }
  }
}