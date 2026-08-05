import { spawn } from 'node:child_process'
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
const repositoryName = 'rinz0x0cruz/rinz0x0cruz.github.io'

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

export function runCommand(command, args, {
  cwd,
  encoding = 'utf8',
  env = process.env,
  timeout = 10 * 60_000,
} = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
    })
    let stdout = encoding ? '' : []
    let stderr = ''
    const timer = setTimeout(() => child.kill(), timeout)
    if (encoding) child.stdout.setEncoding(encoding)
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      if (encoding) stdout += chunk
      else stdout.push(chunk)
    })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timer)
      rejectPromise(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
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

  async fetch() {
    await this.git(['fetch', 'origin', '--prune'])
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
      throw new Error(`Draft ${slug} does not exist.`)
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
    try {
      await this.git(['worktree', 'add', '-B', branch, directory, source])
      if (rebase) await this.git(['rebase', 'origin/main'], directory)
      return await callback(directory, exists)
    } finally {
      try {
        await this.git(['worktree', 'remove', '--force', directory])
      } catch {
        await rm(directory, { recursive: true, force: true })
      }
    }
  }

  prepareDraft(post, media = []) {
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

  async savePreparedDraft(
    { branch, files, retained, slug, source, title },
    { baseRevision, expectedRevision },
  ) {
    return this.withWorktree(branch, async (directory) => {
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
      try {
        await this.git([
          'push', `--force-with-lease=refs/heads/${branch}:${expectedRevision ?? ''}`,
          'origin', `HEAD:refs/heads/${branch}`,
        ], directory)
      } catch (error) {
        if (error instanceof CommandError && /\(stale info\)/u.test(error.stderr)) {
          throw revisionConflict()
        }
        throw error
      }
      const sha = (await this.git(['rev-parse', 'HEAD'], directory)).stdout.trim()
      return { branch, sha, media: files.map((file) => file.publicPath) }
    }, { startPoint: baseRevision })
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
    return this.withWorktree(branch, async (directory) => {
      const postPath = join(directory, 'content', 'blog', `${slug}.md`)
      const post = parsePostSource(await readFile(postPath, 'utf8'), slug)
      await this.command(this.npmCommand, ['ci'], { cwd: directory, timeout: 5 * 60_000 })
      await this.command(this.npmCommand, ['test'], { cwd: directory, timeout: 15 * 60_000 })
      try {
        await this.git([
          'push', `--force-with-lease=refs/heads/${branch}:${baseRevision}`,
          'origin', `HEAD:refs/heads/${branch}`,
        ], directory)
      } catch (error) {
        if (error instanceof CommandError && /\(stale info\)/u.test(error.stderr)) {
          throw revisionConflict()
        }
        throw error
      }
      const sha = (await this.git(['rev-parse', 'HEAD'], directory)).stdout.trim()
      let pullRequests = parseJson((await this.gh([
        'pr', 'list', '--repo', this.repository, '--head', branch, '--state', 'open', '--json', 'number,url',
      ], directory)).stdout, [])
      if (!pullRequests.length) {
        const body = `Publishes \`${post.title}\` from the local blog studio.\n\n- Static content validation passed\n- Full portfolio test suite passed\n`
        await this.gh([
          'pr', 'create', '--repo', this.repository, '--base', 'main', '--head', branch,
          '--title', `Publish blog: ${post.title}`, '--body', body,
        ], directory)
        pullRequests = parseJson((await this.gh([
          'pr', 'list', '--repo', this.repository, '--head', branch, '--state', 'open', '--json', 'number,url',
        ], directory)).stdout, [])
      }
      const pullRequest = pullRequests[0]
      if (!pullRequest) throw new Error('GitHub did not return the created pull request.')
      let autoMergeQueued = true
      let autoMergeError
      try {
        await this.gh([
          'pr', 'merge', String(pullRequest.number), '--repo', this.repository,
          '--auto', '--squash', '--delete-branch', '--match-head-commit', sha,
        ], directory)
      } catch (error) {
        autoMergeQueued = false
        autoMergeError = error.message
      }
      return { branch, sha, pullRequest, autoMergeQueued, autoMergeError }
    }, { rebase: true, startPoint: baseRevision })
  }

  async saveAndPublish(post, media = [], expectedRevision) {
    const draft = this.prepareDraft(post, media)
    return this.withBranchLock(draft.branch, async () => {
      const revisions = await this.assertExpectedRevision(draft.branch, expectedRevision)
      const saved = await this.savePreparedDraft(draft, {
        baseRevision: revisions.baseRevision,
        expectedRevision: revisions.branchRevision,
      })
      const published = await this.publishBranch(draft.slug, draft.branch, saved.sha)
      return { draft: saved, published }
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

  async status(slug) {
    const branch = draftBranch(slug)
    const result = await this.gh([
      'pr', 'list', '--repo', this.repository, '--head', branch, '--state', 'all', '--limit', '1',
      '--json', 'number,url,state,mergeStateStatus,statusCheckRollup',
    ])
    const pullRequest = parseJson(result.stdout, [])[0] ?? null
    return { branch, pullRequest, liveUrl: `${SITE_URL}/blog/${slug}/` }
  }
}