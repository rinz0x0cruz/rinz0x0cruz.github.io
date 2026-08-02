import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import {
  BlogPublisher,
  CommandError,
  runCommand,
} from '../scripts/blog/publisher.mjs'
import { createStudioServer } from '../scripts/blog/studio.mjs'

async function git(cwd, args) {
  return runCommand('git', args, { cwd })
}

async function repositoryFixture() {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-publisher-test-'))
  const remote = join(root, 'remote.git')
  const checkout = join(root, 'checkout')
  await mkdir(checkout)
  await git(root, ['init', '--bare', '--initial-branch=main', remote])
  await git(checkout, ['init', '--initial-branch=main'])
  await git(checkout, ['config', 'user.name', 'Blog Test'])
  await git(checkout, ['config', 'user.email', 'blog-test@example.invalid'])
  await mkdir(join(checkout, 'content', 'blog'), { recursive: true })
  await writeFile(join(checkout, 'README.md'), '# Fixture\n')
  await git(checkout, ['add', 'README.md'])
  await git(checkout, ['commit', '-m', 'Initial'])
  await git(checkout, ['remote', 'add', 'origin', remote])
  await git(checkout, ['push', '-u', 'origin', 'main'])
  return { checkout, remote }
}

function draftPost(published) {
  return {
    slug: 'safe-draft',
    metadata: {
      title: 'Safe draft',
      summary: 'A durable draft stored on a remote branch.',
      ...(published ? { published } : {}),
      tags: ['Testing'],
      cover: '/blog/media/safe-draft/cover.png',
      coverAlt: 'A small test image.',
    },
    body: '# Draft\n\nA body.',
  }
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

test('saves and reloads a durable draft branch with verified media', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const media = [
    { name: 'cover.png', data: png.toString('base64') },
    { name: 'motion.gif', data: gif.toString('base64') },
  ]
  const result = await publisher.saveDraft(draftPost(), media)

  assert.equal(result.branch, 'draft/blog/safe-draft')
  assert.deepEqual(result.media, [
    '/blog/media/safe-draft/cover.png',
    '/blog/media/safe-draft/motion.gif',
  ])
  const source = await git(fixture.checkout, [
    '--git-dir', fixture.remote, 'show', 'refs/heads/draft/blog/safe-draft:content/blog/safe-draft.md',
  ])
  assert.match(source.stdout, /title: Safe draft/u)
  const mediaObject = (await git(fixture.checkout, [
    '--git-dir', fixture.remote, 'rev-parse', 'refs/heads/draft/blog/safe-draft:public/blog/media/safe-draft/cover.png',
  ])).stdout.trim()
  const mediaSize = (await git(fixture.checkout, [
    '--git-dir', fixture.remote, 'cat-file', '-s', mediaObject,
  ])).stdout.trim()
  assert.equal(mediaSize, String(png.length))
  const loadedMedia = await publisher.readMedia('safe-draft', 'cover.png', 'draft')
  assert.deepEqual(loadedMedia.buffer, png)
  assert.equal(loadedMedia.contentType, 'image/png')
  const loadedGif = await publisher.readMedia('safe-draft', 'motion.gif', 'draft')
  assert.deepEqual(loadedGif.buffer, gif)
  assert.equal(loadedGif.contentType, 'image/gif')
  const loaded = await publisher.readPost('safe-draft', 'draft')
  assert.equal(loaded.title, 'Safe draft')
  assert.deepEqual((await publisher.listPosts()).drafts, ['safe-draft'])

  const repeated = await publisher.saveDraft(draftPost(), media)
  assert.equal(repeated.sha, result.sha)
})

test('rejects unsafe media before opening a worktree', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  await assert.rejects(
    publisher.saveDraft(draftPost(), [{ name: '../cover.png', data: png.toString('base64') }]),
    /Media filenames/u,
  )
  await assert.rejects(
    publisher.saveDraft(draftPost(), [{ name: 'cover.jpg', data: png.toString('base64') }]),
    /does not match/u,
  )
  await assert.rejects(
    publisher.saveDraft(draftPost(), [
      { name: 'cover.png', data: png.toString('base64') },
      { name: 'cover.png', data: png.toString('base64') },
    ]),
    /Media filenames must be unique/u,
  )
  for (const [name, data] of [
    ['image.png', png.subarray(0, 8)],
    ['image.jpg', Buffer.from([0xff, 0xd8, 0xff])],
    ['image.gif', Buffer.from('GIF89a')],
    ['image.webp', Buffer.from('RIFF\0\0\0\0WEBP')],
    ['image.avif', Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif')])],
  ]) {
    await assert.rejects(
      publisher.saveDraft(draftPost(), [{ name, data: data.toString('base64') }]),
      /does not match/u,
      name,
    )
  }
  const oversized = Buffer.alloc(2 * 1024 * 1024 + 1)
  png.copy(oversized)
  await assert.rejects(
    publisher.saveDraft(draftPost(), [{ name: 'cover.png', data: oversized.toString('base64') }]),
    /must be between/u,
  )
  await assert.rejects(
    publisher.saveDraft(
      draftPost(),
      Array.from({ length: 9 }, (_, index) => ({
        name: `image-${index}.png`,
        data: png.toString('base64'),
      })),
    ),
    /at most 8 files/u,
  )
  await assert.rejects(publisher.saveDraft(draftPost(), {}), /media must be an array/u)
  await assert.rejects(publisher.readMedia('safe-draft', '../cover.png', 'draft'), /Media filenames/u)
})

test('removes unreferenced media from an updated draft', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  await publisher.saveDraft(draftPost(), [{ name: 'cover.png', data: png.toString('base64') }])

  const updated = draftPost()
  delete updated.metadata.cover
  delete updated.metadata.coverAlt
  await publisher.saveDraft(updated)

  await assert.rejects(
    git(fixture.checkout, [
      '--git-dir', fixture.remote, 'show',
      'refs/heads/draft/blog/safe-draft:public/blog/media/safe-draft/cover.png',
    ]),
    CommandError,
  )
})

test('publishes through a protected PR and reports unavailable auto-merge', async () => {
  const fixture = await repositoryFixture()
  let pullRequestCreated = false
  const commands = []
  const runner = async (command, args, options) => {
    commands.push([command, ...args])
    if (command === 'fake-npm') return { stdout: '', stderr: '' }
    if (command === 'gh') {
      if (args[1] === 'list') {
        return {
          stdout: pullRequestCreated ? '[{"number":12,"url":"https://example.invalid/pr/12"}]' : '[]',
          stderr: '',
        }
      }
      if (args[1] === 'create') {
        pullRequestCreated = true
        return { stdout: 'https://example.invalid/pr/12\n', stderr: '' }
      }
      if (args[1] === 'merge') {
        throw new CommandError('gh', args, 1, '', 'Auto-merge is disabled')
      }
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
    repository: 'owner/repo',
  })
  await publisher.saveDraft(draftPost('2026-08-02'))
  const result = await publisher.publish('safe-draft')

  assert.equal(result.pullRequest.number, 12)
  assert.equal(result.autoMergeQueued, false)
  assert.match(result.autoMergeError, /Auto-merge is disabled/u)
  assert.equal(commands.filter(([command, action]) => command === 'fake-npm' && action === 'test').length, 1)
  assert.equal(commands.some(([command, group, action]) => command === 'gh' && group === 'pr' && action === 'create'), true)
  assert.equal(commands.some(([command, group, action]) => command === 'gh' && group === 'pr' && action === 'merge'), true)
})

test('stops before GitHub and cleans its worktree when tests fail', async () => {
  const fixture = await repositoryFixture()
  const commands = []
  const runner = async (command, args, options) => {
    commands.push([command, ...args])
    if (command === 'fake-npm' && args[0] === 'ci') return { stdout: '', stderr: '' }
    if (command === 'fake-npm') {
      throw new CommandError(command, args, 1, '', 'Tests failed')
    }
    if (command === 'gh') throw new Error('GitHub must not run after a failed test gate.')
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
    repository: 'owner/repo',
  })
  await publisher.saveDraft(draftPost('2026-08-02'))

  await assert.rejects(publisher.publish('safe-draft'), /Tests failed/u)
  assert.deepEqual(
    commands.filter(([command]) => command === 'fake-npm').map(([, action]) => action),
    ['ci', 'test'],
  )
  assert.equal(commands.some(([command]) => command === 'gh'), false)
  const worktrees = await git(fixture.checkout, ['worktree', 'list', '--porcelain'])
  assert.equal(worktrees.stdout.split(/\r?\n/u).filter((line) => line.startsWith('worktree ')).length, 1)
})

test('studio rejects cross-origin and missing-CSRF mutations', async () => {
  let savedMediaCount = 0
  const fakePublisher = {
    listPosts: async () => ({ drafts: [], published: [] }),
    readPost: async () => ({}),
    status: async () => ({}),
    saveDraft: async (_post, media) => {
      savedMediaCount = media.length
      return {}
    },
    publish: async () => ({}),
  }
  const server = createStudioServer({
    publisher: fakePublisher,
    csrf: 'test-csrf',
    accessToken: 'test-access-token',
    logger: { error() {} },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const post = {
    slug: 'safe-post',
    metadata: { title: 'Safe', summary: 'Safe preview.' },
    body: '# Safe',
  }
  try {
    const page = await fetch(base).then((response) => response.text())
    assert.doesNotMatch(page, /test-access-token/u)
    const missingToken = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
      },
      body: JSON.stringify({ post }),
    })
    assert.equal(missingToken.status, 401)
    assert.match(missingToken.headers.get('content-type'), /^application\/json/u)
    assert.deepEqual(await missingToken.json(), { error: 'Studio token required.' })
    const missing = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({ post }),
    })
    assert.equal(missing.status, 403)
    const crossOrigin = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://example.invalid',
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({ post }),
    })
    assert.equal(crossOrigin.status, 403)
    const valid = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({ post }),
    })
    assert.equal(valid.status, 200)

    const wrongType = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({ post }),
    })
    assert.equal(wrongType.status, 415)

    const malformed = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: '{',
    })
    assert.equal(malformed.status, 400)
    assert.match((await malformed.json()).error, /JSON|Unexpected end/u)

    const empty = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
    })
    assert.equal(empty.status, 400)
    assert.deepEqual(await empty.json(), { error: 'Request body is required.' })

    const mediaChunk = Buffer.alloc(2 * 1024 * 1024).toString('base64')
    const maximumMedia = await fetch(`${base}/api/draft`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({
        post,
        media: ['a.png', 'b.png', 'c.png', 'd.png'].map((name) => ({ name, data: mediaChunk })),
      }),
    })
    assert.equal(maximumMedia.status, 200)
    assert.equal(savedMediaCount, 4)

    const oversizedRequest = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: 'x'.repeat(12 * 1024 * 1024 + 1),
    })
    assert.equal(oversizedRequest.status, 400)
    assert.deepEqual(await oversizedRequest.json(), { error: 'Request body exceeds 12 MiB.' })
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test('studio media fallback does not hide draft integrity failures', async () => {
  const calls = []
  const fakePublisher = {
    async readMedia(slug, _name, source) {
      calls.push(`${slug}:${source}`)
      if (source === 'draft' && slug === 'published-post') {
        const error = new Error('Draft published-post does not exist.')
        error.code = 'BLOG_DRAFT_NOT_FOUND'
        throw error
      }
      if (source === 'draft') throw new Error('Draft media is corrupt.')
      return { buffer: png, contentType: 'image/png' }
    },
  }
  const server = createStudioServer({
    publisher: fakePublisher,
    accessToken: 'unused',
    logger: { error() {} },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const published = await fetch(`${base}/blog/media/published-post/cover.png`)
    assert.equal(published.status, 200)
    assert.deepEqual(Buffer.from(await published.arrayBuffer()), png)

    const corrupt = await fetch(`${base}/blog/media/corrupt-post/cover.png`)
    assert.equal(corrupt.status, 400)
    assert.deepEqual(calls, [
      'published-post:draft',
      'published-post:published',
      'corrupt-post:draft',
    ])
  } finally {
    server.closeAllConnections()
    server.close()
  }
})