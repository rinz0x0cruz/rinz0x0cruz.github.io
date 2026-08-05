import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import {
  BlogPublisher,
  CommandError,
  runCommand,
} from '../scripts/blog/publisher.mjs'
import { parsePostSource, serializePost } from '../scripts/blog/lib.mjs'
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
  const result = await publisher.saveDraft(draftPost(), media, null)

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
  assert.equal(loaded.post.title, 'Safe draft')
  assert.equal(loaded.revision, result.sha)
  assert.deepEqual((await publisher.listPosts()).drafts, ['safe-draft'])

  const repeated = await publisher.saveDraft(draftPost(), media, result.sha)
  assert.equal(repeated.sha, result.sha)
})

test('serializes concurrent first writes and rejects the stale contender', async () => {
  const fixture = await repositoryFixture()
  let worktreeAdds = 0
  const runner = async (command, args, options) => {
    const result = await runCommand(command, args, options)
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'add') {
      worktreeAdds += 1
      if (worktreeAdds === 1) await new Promise((resolve) => setTimeout(resolve, 150))
    }
    return result
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })
  const first = draftPost()
  first.metadata.summary = 'The first concurrent save.'
  const second = draftPost()
  second.metadata.summary = 'The second concurrent save.'

  const results = await Promise.allSettled([
    publisher.saveDraft(first, [], null),
    publisher.saveDraft(second, [], null),
  ])

  assert.deepEqual(results.map(({ status }) => status), ['fulfilled', 'rejected'])
  assert.equal(results[1].reason.code, 'BLOG_REVISION_CONFLICT')
  assert.equal(worktreeAdds, 1)
  const saved = await publisher.readPost('safe-draft', 'draft')
  assert.equal(saved.post.summary, first.metadata.summary)
  const worktrees = await git(fixture.checkout, ['worktree', 'list', '--porcelain'])
  assert.equal(worktrees.stdout.split(/\r?\n/u).filter((line) => line.startsWith('worktree ')).length, 1)
})

test('rejects a stale draft revision without replacing the newer edit', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const initial = await publisher.saveDraft(draftPost(), [], null)
  const firstClient = await publisher.readPost('safe-draft', 'draft')
  const staleClient = await publisher.readPost('safe-draft', 'draft')

  assert.equal(firstClient.revision, initial.sha)
  assert.equal(staleClient.revision, initial.sha)

  const newer = draftPost()
  newer.metadata.summary = 'The first client saved this revision.'
  await publisher.saveDraft(newer, [], firstClient.revision)

  const stale = draftPost()
  stale.metadata.summary = 'The stale client must not replace it.'
  await assert.rejects(
    publisher.saveDraft(stale, [], staleClient.revision),
    (error) => {
      assert.equal(error.code, 'BLOG_REVISION_CONFLICT')
      return true
    },
  )

  const saved = await publisher.readPost('safe-draft', 'draft')
  assert.equal(saved.post.summary, newer.metadata.summary)
})

test('creates the first draft from a published post revision', async () => {
  const fixture = await repositoryFixture()
  const published = draftPost('2026-08-02')
  await writeFile(
    join(fixture.checkout, 'content', 'blog', 'safe-draft.md'),
    serializePost(published),
    'utf8',
  )
  await git(fixture.checkout, ['add', 'content/blog/safe-draft.md'])
  await git(fixture.checkout, ['commit', '-m', 'Publish safe draft'])
  await git(fixture.checkout, ['push', 'origin', 'main'])
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const loaded = await publisher.readPost('safe-draft', 'published')
  const edited = draftPost('2026-08-02')
  edited.metadata.summary = 'The first draft edit of a published post.'

  const saved = await publisher.saveDraft(edited, [], loaded.revision)

  assert.equal(saved.branch, 'draft/blog/safe-draft')
  assert.equal((await publisher.readPost('safe-draft', 'draft')).post.summary, edited.metadata.summary)

  await git(fixture.checkout, ['push', 'origin', '--delete', saved.branch])
  const reopened = draftPost('2026-08-02')
  reopened.metadata.summary = 'A new draft after the merged branch was deleted.'
  const recreated = await publisher.saveDraft(reopened, [], loaded.revision)

  assert.equal(recreated.branch, saved.branch)
  assert.equal((await publisher.readPost('safe-draft', 'draft')).post.summary, reopened.metadata.summary)
})

test('rejects a remote update that lands while a draft is saving', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const initial = await initialPublisher.saveDraft(draftPost(), [], null)
  const remotePublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const remote = draftPost()
  remote.metadata.summary = 'A remote editor saved this revision.'
  const stale = draftPost()
  stale.metadata.summary = 'This stale edit must not replace it.'
  let fetches = 0
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'fetch' && ++fetches === 2) {
      await remotePublisher.saveDraft(remote, [], initial.sha)
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })

  await assert.rejects(
    publisher.saveDraft(stale, [], initial.sha),
    (error) => {
      assert.equal(error.code, 'BLOG_REVISION_CONFLICT')
      return true
    },
  )
  const saved = await remotePublisher.readPost('safe-draft', 'draft')
  assert.equal(saved.post.summary, remote.metadata.summary)
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
  const saved = await publisher.saveDraft(
    draftPost(),
    [{ name: 'cover.png', data: png.toString('base64') }],
    null,
  )

  const updated = draftPost()
  delete updated.metadata.cover
  delete updated.metadata.coverAlt
  await publisher.saveDraft(updated, [], saved.sha)

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
  await publisher.saveDraft(draftPost('2026-08-02'), [], null)
  const result = await publisher.publish('safe-draft')

  assert.equal(result.pullRequest.number, 12)
  assert.equal(result.autoMergeQueued, false)
  assert.match(result.autoMergeError, /Auto-merge is disabled/u)
  assert.equal(commands.filter(([command, action]) => command === 'fake-npm' && action === 'test').length, 1)
  assert.equal(commands.some(([command, group, action]) => command === 'gh' && group === 'pr' && action === 'create'), true)
  assert.equal(commands.some(([command, group, action]) => command === 'gh' && group === 'pr' && action === 'merge'), true)
})

test('keeps save and publish atomic against a concurrent draft update', async () => {
  const fixture = await repositoryFixture()
  let releaseFirstWorktree
  let signalFirstWorktree
  const firstWorktreeReady = new Promise((resolve) => { signalFirstWorktree = resolve })
  const firstWorktreeGate = new Promise((resolve) => { releaseFirstWorktree = resolve })
  let worktreeAdds = 0
  let pullRequestCreated = false
  let testedSummary
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'add') {
      worktreeAdds += 1
      if (worktreeAdds === 1) {
        const result = await runCommand(command, args, options)
        signalFirstWorktree()
        await firstWorktreeGate
        return result
      }
    }
    if (command === 'fake-npm') {
      if (args[0] === 'test') {
        testedSummary = parsePostSource(
          await readFile(join(options.cwd, 'content', 'blog', 'safe-draft.md'), 'utf8'),
          'safe-draft',
        ).summary
      }
      return { stdout: '', stderr: '' }
    }
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
      if (args[1] === 'merge') return { stdout: '', stderr: '' }
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
    repository: 'owner/repo',
  })
  const published = draftPost('2026-08-02')
  published.metadata.summary = 'The publish request payload.'
  const later = draftPost('2026-08-02')
  later.metadata.summary = 'A later draft update.'

  const publishing = publisher.saveAndPublish(published, [], null)
  await firstWorktreeReady
  const saving = publisher.saveDraft(later, [], null)
  releaseFirstWorktree()
  const [publishResult, saveResult] = await Promise.allSettled([publishing, saving])

  assert.equal(publishResult.status, 'fulfilled')
  assert.equal(publishResult.value.published.pullRequest.number, 12)
  assert.equal(saveResult.status, 'rejected')
  assert.equal(saveResult.reason.code, 'BLOG_REVISION_CONFLICT')
  assert.equal(testedSummary, published.metadata.summary)
  assert.equal((await publisher.readPost('safe-draft', 'draft')).post.summary, published.metadata.summary)
})

test('rejects a remote update that lands between saving and publishing', async () => {
  const fixture = await repositoryFixture()
  const remotePublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const remote = draftPost('2026-08-02')
  remote.metadata.summary = 'A remote editor changed the saved draft.'
  let fetches = 0
  let pullRequestCreated = false
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'fetch' && ++fetches === 3) {
      const current = await remotePublisher.readPost('safe-draft', 'draft')
      await remotePublisher.saveDraft(remote, [], current.revision)
    }
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
      if (args[1] === 'merge') return { stdout: '', stderr: '' }
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
    repository: 'owner/repo',
  })
  const requested = draftPost('2026-08-02')
  requested.metadata.summary = 'The publish request payload.'

  await assert.rejects(
    publisher.saveAndPublish(requested, [], null),
    (error) => {
      assert.equal(error.code, 'BLOG_REVISION_CONFLICT')
      return true
    },
  )
  assert.equal(pullRequestCreated, false)
  const saved = await remotePublisher.readPost('safe-draft', 'draft')
  assert.equal(saved.post.summary, remote.metadata.summary)
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
  await publisher.saveDraft(draftPost('2026-08-02'), [], null)

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
  let savedRevision
  let atomicPublications = 0
  const fakePublisher = {
    listPosts: async () => ({ drafts: [], published: [] }),
    readPost: async () => ({}),
    status: async () => ({}),
    saveDraft: async (_post, media, expectedRevision) => {
      savedMediaCount = media.length
      savedRevision = expectedRevision
      return {}
    },
    saveAndPublish: async () => {
      atomicPublications += 1
      return { draft: {}, published: {} }
    },
    publish: async () => { throw new Error('Publish must use the atomic operation.') },
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

    const missingRevision = await fetch(`${base}/api/draft`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({ post }),
    })
    assert.equal(missingRevision.status, 428)
    assert.deepEqual(await missingRevision.json(), {
      error: 'A draft revision is required. Reload the post before saving.',
      code: 'BLOG_REVISION_REQUIRED',
    })

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
        expectedRevision: null,
      }),
    })
    assert.equal(maximumMedia.status, 200)
    assert.equal(savedMediaCount, 4)
    assert.equal(savedRevision, null)

    const publication = await fetch(`${base}/api/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({
        post: {
          ...post,
          metadata: { ...post.metadata, published: '2026-08-05' },
        },
        expectedRevision: null,
      }),
    })
    assert.equal(publication.status, 200)
    assert.equal(atomicPublications, 1)

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