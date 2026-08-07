import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import {
  BlogPublisher,
  CommandError,
  CommandLaunchError,
  CommandOutputError,
  CommandTimeoutError,
  runCommand,
} from '../scripts/blog/publisher.mjs'
import { parsePostSource, serializePost } from '../scripts/blog/lib.mjs'
import { createStudioServer } from '../scripts/blog/studio.mjs'

const fixtureRoots = new Set()

test.afterEach(async () => {
  const roots = [...fixtureRoots]
  fixtureRoots.clear()
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
})

async function git(cwd, args) {
  return runCommand('git', args, { cwd })
}

async function repositoryFixture() {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-publisher-test-'))
  fixtureRoots.add(root)
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

async function pullRequestRecord(options, overrides = {}) {
  const headRefOid = (await runCommand('git', ['rev-parse', 'HEAD'], options)).stdout.trim()
  return {
    baseRefName: 'main',
    headRefName: 'draft/blog/safe-draft',
    headRefOid,
    headRepositoryOwner: { login: 'owner' },
    isCrossRepository: false,
    mergeStateStatus: 'CLEAN',
    number: 12,
    state: 'OPEN',
    statusCheckRollup: [],
    url: 'https://example.invalid/pr/12',
    ...overrides,
  }
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

async function waitForProcessExit(processId, timeout = 2_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      process.kill(processId, 0)
    } catch {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return false
}

test('bounds command output and terminates descendants on timeout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-command-test-'))
  const pidPath = join(directory, 'descendant.pid')
  const parent = [
    "const { spawn } = require('node:child_process')",
    "const { writeFileSync } = require('node:fs')",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })",
    `writeFileSync(${JSON.stringify(pidPath)}, String(child.pid))`,
    'setInterval(() => {}, 1000)',
  ].join(';')
  let descendantPid
  try {
    await assert.rejects(
      runCommand(process.execPath, ['-e', parent], { timeout: 100 }),
      (error) => error.code === 'BLOG_COMMAND_TIMEOUT',
    )
    descendantPid = Number(await readFile(pidPath, 'utf8'))
    assert.equal(await waitForProcessExit(descendantPid), true)

    await assert.rejects(
      runCommand(process.execPath, ['-e', "process.stdout.write('x'.repeat(2048))"], {
        maxOutputBytes: 1_024,
      }),
      (error) => error.code === 'BLOG_COMMAND_OUTPUT_LIMIT',
    )
    await assert.rejects(
      runCommand('portfolio-command-that-does-not-exist', []),
      (error) => error instanceof CommandLaunchError && error.code === 'BLOG_COMMAND_LAUNCH',
    )
    await assert.rejects(
      runCommand(process.execPath, ['\0']),
      (error) => error instanceof CommandLaunchError && error.code === 'BLOG_COMMAND_LAUNCH',
    )
  } finally {
    if (descendantPid && !(await waitForProcessExit(descendantPid, 50))) {
      process.kill(descendantPid)
    }
    await rm(directory, { recursive: true, force: true })
  }
})

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

test('deduplicates overlapping Git fetches for concurrent media reads', async () => {
  const fixture = await repositoryFixture()
  const post = draftPost('2026-08-02')
  await writeFile(
    join(fixture.checkout, 'content', 'blog', 'safe-draft.md'),
    serializePost(post),
    'utf8',
  )
  await mkdir(join(fixture.checkout, 'public', 'blog', 'media', 'safe-draft'), {
    recursive: true,
  })
  await writeFile(
    join(fixture.checkout, 'public', 'blog', 'media', 'safe-draft', 'cover.png'),
    png,
  )
  await git(fixture.checkout, ['add', 'content/blog/safe-draft.md', 'public/blog/media/safe-draft/cover.png'])
  await git(fixture.checkout, ['commit', '-m', 'Publish media fixture'])
  await git(fixture.checkout, ['push', 'origin', 'main'])

  let fetches = 0
  let releaseFetch
  let signalFetch
  const fetchStarted = new Promise((resolve) => { signalFetch = resolve })
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve })
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'fetch') {
      fetches += 1
      signalFetch()
      await fetchGate
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })

  const first = publisher.readMedia('safe-draft', 'cover.png')
  await fetchStarted
  const second = publisher.readMedia('safe-draft', 'cover.png')
  await Promise.resolve()
  releaseFetch()
  const results = await Promise.all([first, second])

  assert.equal(fetches, 1)
  assert.deepEqual(results.map(({ buffer }) => buffer), [png, png])
  await publisher.readMedia('safe-draft', 'cover.png')
  assert.equal(fetches, 2)
})

test('reconciles a successful push whose command reports an unknown outcome', async () => {
  const fixture = await repositoryFixture()
  let losePushResponse = true
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'push' && losePushResponse) {
      losePushResponse = false
      await runCommand(command, args, options)
      throw new CommandTimeoutError(command, 100)
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })

  const saved = await publisher.saveDraft(draftPost(), [], null)

  assert.equal(
    saved.sha,
    (await git(fixture.checkout, [
      '--git-dir', fixture.remote, 'rev-parse', 'refs/heads/draft/blog/safe-draft',
    ])).stdout.trim(),
  )
})

test('forces a fresh fetch after an ambiguous push outcome', async () => {
  const fixture = await repositoryFixture()
  await writeFile(join(fixture.checkout, 'README.md'), '# Candidate\n')
  await git(fixture.checkout, ['add', 'README.md'])
  await git(fixture.checkout, ['commit', '-m', 'Candidate'])
  let fetches = 0
  let releaseFirstFetch
  let signalFirstFetch
  let signalPush
  const firstFetchStarted = new Promise((resolve) => { signalFirstFetch = resolve })
  const firstFetchGate = new Promise((resolve) => { releaseFirstFetch = resolve })
  const pushFinished = new Promise((resolve) => { signalPush = resolve })
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'fetch') {
      fetches += 1
      const result = await runCommand(command, args, options)
      if (fetches === 1) {
        signalFirstFetch()
        await firstFetchGate
      }
      return result
    }
    if (command === 'git' && args[0] === 'push') {
      await runCommand(command, args, options)
      signalPush()
      throw new CommandTimeoutError(command, 100)
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })

  const staleFetch = publisher.fetch()
  await firstFetchStarted
  const pushing = publisher.pushBranch('draft/blog/safe-draft', null, fixture.checkout)
  await pushFinished
  releaseFirstFetch()
  const revision = await pushing
  await staleFetch

  assert.equal(fetches, 2)
  assert.equal(
    revision,
    (await git(fixture.checkout, [
      '--git-dir', fixture.remote, 'rev-parse', 'refs/heads/draft/blog/safe-draft',
    ])).stdout.trim(),
  )
})

test('marks a push unknown when fresh verification cannot run', async () => {
  const fixture = await repositoryFixture()
  await writeFile(join(fixture.checkout, 'README.md'), '# Candidate\n')
  await git(fixture.checkout, ['add', 'README.md'])
  await git(fixture.checkout, ['commit', '-m', 'Candidate'])
  let pushAttempted = false
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'push') {
      pushAttempted = true
      await runCommand(command, args, options)
      throw new CommandTimeoutError(command, 100)
    }
    if (command === 'git' && args[0] === 'fetch' && pushAttempted) {
      throw new CommandError(command, args, 128, '', 'Network unavailable')
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })

  await assert.rejects(
    publisher.pushBranch('draft/blog/safe-draft', null, fixture.checkout),
    (error) => error.code === 'BLOG_COMMAND_TIMEOUT' && error.outcomeUnknown === true,
  )
})

test('treats branch deletion during an ambiguous update as a revision conflict', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const initial = await initialPublisher.saveDraft(draftPost(), [], null)
  let deleteBranch = true
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'push' && deleteBranch) {
      deleteBranch = false
      await git(fixture.checkout, [
        'push', 'origin', '--delete', 'draft/blog/safe-draft',
      ])
      throw new CommandTimeoutError(command, 100)
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })
  const updated = draftPost()
  updated.metadata.summary = 'Update racing a remote branch deletion.'

  await assert.rejects(
    publisher.saveDraft(updated, [], initial.sha),
    (error) => error.code === 'BLOG_REVISION_CONFLICT' && error.recovery === undefined,
  )
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

test('classifies a divergent ambiguous push as a revision conflict', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const initial = await initialPublisher.saveDraft(draftPost(), [], null)
  const remoteRoot = await mkdtemp(join(tmpdir(), 'portfolio-remote-editor-'))
  fixtureRoots.add(remoteRoot)
  const remoteCheckout = join(remoteRoot, 'checkout')
  await git(remoteRoot, ['clone', fixture.remote, remoteCheckout])
  await git(remoteCheckout, ['config', 'user.name', 'Remote Blog Test'])
  await git(remoteCheckout, ['config', 'user.email', 'remote-blog-test@example.invalid'])
  const remotePublisher = new BlogPublisher({ repoRoot: remoteCheckout })
  let injectConflict = true
  let failRemove = true
  let failPrune = true
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'push' && injectConflict) {
      injectConflict = false
      const current = await remotePublisher.readPost('safe-draft', 'draft')
      const changed = draftPost()
      changed.metadata.summary = 'Concurrent remote version.'
      await remotePublisher.saveDraft(changed, [], current.revision)
      throw new CommandTimeoutError(command, 100)
    }
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'remove' && failRemove) {
      failRemove = false
      throw new CommandError(command, args, 1, '', 'Injected removal failure')
    }
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'prune' && failPrune) {
      failPrune = false
      throw new CommandError(command, args, 1, '', 'Injected prune failure')
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })
  const local = draftPost()
  local.metadata.summary = 'Ambiguous local version.'

  await assert.rejects(
    publisher.saveDraft(local, [], initial.sha),
    (error) => (
      error.code === 'BLOG_REVISION_CONFLICT'
      && error.recovery === undefined
      && error.cleanupDiagnostic instanceof CommandError
    ),
  )
  await git(fixture.checkout, ['worktree', 'prune'])
})

test('rejects unsafe media before opening a worktree', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const invalidPost = draftPost()
  invalidPost.metadata.title = 'Unsafe\0title'
  await assert.rejects(
    publisher.saveDraft(invalidPost, [], null),
    /title contains unsupported characters/u,
  )
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
        const expected = await pullRequestRecord(options)
        const conflicting = [
          { ...expected, number: 98, headRepositoryOwner: { login: 'attacker' }, isCrossRepository: true },
          { ...expected, number: 99, baseRefName: 'other' },
          { ...expected, number: 100, headRefOid: 'f'.repeat(40) },
        ]
        return {
          stdout: JSON.stringify(pullRequestCreated ? [...conflicting, expected] : conflicting),
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
  assert.equal(result.autoMergeError, 'Auto-merge could not be queued. Review the studio terminal.')
  assert.match(result.diagnostic.message, /Auto-merge is disabled/u)
  assert.equal(JSON.stringify(result).includes('Auto-merge is disabled'), false)
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
          stdout: pullRequestCreated
            ? JSON.stringify([await pullRequestRecord(options)])
            : '[]',
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
    if (command === 'git' && args[0] === 'fetch' && ++fetches === 4) {
      const current = await remotePublisher.readPost('safe-draft', 'draft')
      await remotePublisher.saveDraft(remote, [], current.revision)
    }
    if (command === 'fake-npm') return { stdout: '', stderr: '' }
    if (command === 'gh') {
      if (args[1] === 'list') {
        return {
          stdout: pullRequestCreated
            ? JSON.stringify([await pullRequestRecord(options)])
            : '[]',
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
      assert.equal(error.recovery, undefined)
      return true
    },
  )
  assert.equal(pullRequestCreated, false)
  const saved = await remotePublisher.readPost('safe-draft', 'draft')
  assert.equal(saved.post.summary, remote.metadata.summary)
})

test('returns the durable draft revision when publication fails after saving', async () => {
  const fixture = await repositoryFixture()
  let failTests = true
  let pullRequestCreated = false
  const runner = async (command, args, options) => {
    if (command === 'fake-npm') {
      if (args[0] === 'test' && failTests) {
        throw new CommandError(command, args, 1, '', 'Tests failed')
      }
      return { stdout: '', stderr: '' }
    }
    if (command === 'gh') {
      if (args[1] === 'list') {
        return {
          stdout: pullRequestCreated
            ? JSON.stringify([await pullRequestRecord(options)])
            : '[]',
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
  let failure
  try {
    await publisher.saveAndPublish(requested, [], null)
  } catch (error) {
    failure = error
  }

  assert.match(failure.message, /Tests failed/u)
  assert.match(failure.recovery.draft.sha, /^[0-9a-f]{40}$/u)
  assert.equal(
    (await publisher.readPost('safe-draft', 'draft')).revision,
    failure.recovery.draft.sha,
  )

  failTests = false
  const retried = await publisher.saveAndPublish(
    requested,
    [],
    failure.recovery.draft.sha,
  )
  assert.equal(retried.published.pullRequest.number, 12)
})

test('returns the rebased remote revision when GitHub fails after the publish push', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const saved = await initialPublisher.saveDraft(draftPost('2026-08-02'), [], null)
  await writeFile(join(fixture.checkout, 'README.md'), '# Main advanced\n')
  await git(fixture.checkout, ['add', 'README.md'])
  await git(fixture.checkout, ['commit', '-m', 'Advance main'])
  await git(fixture.checkout, ['push', 'origin', 'main'])

  const runner = async (command, args, options) => {
    if (command === 'fake-npm') return { stdout: '', stderr: '' }
    if (command === 'gh') {
      throw new CommandError(command, args, 1, '', 'GitHub unavailable')
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
    repository: 'owner/repo',
  })
  let failure
  try {
    await publisher.saveAndPublish(draftPost('2026-08-02'), [], saved.sha)
  } catch (error) {
    failure = error
  }

  const remoteRevision = (await git(fixture.checkout, [
    '--git-dir', fixture.remote, 'rev-parse', 'refs/heads/draft/blog/safe-draft',
  ])).stdout.trim()
  assert.notEqual(remoteRevision, saved.sha)
  assert.equal(failure.recovery.draft.sha, remoteRevision)
})

test('marks publication pending when a no-op push reaches GitHub', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const post = draftPost('2026-08-02')
  const media = [{ name: 'cover.png', data: png.toString('base64') }]
  const saved = await initialPublisher.saveDraft(post, media, null)
  const runner = async (command, args, options) => {
    if (command === 'fake-npm') return { stdout: '', stderr: '' }
    if (command === 'gh') {
      throw new CommandError(command, args, 1, '', 'GitHub unavailable')
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
    repository: 'owner/repo',
  })

  await assert.rejects(
    publisher.saveAndPublish(post, [], saved.sha),
    (error) => {
      assert.equal(error.recovery.draft.sha, saved.sha)
      assert.equal(error.recovery.publicationPending, true)
      return true
    },
  )
})

test('reconciles exact draft media and a merged post after branch deletion', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const post = draftPost('2026-08-02')
  const media = [{ name: 'cover.png', data: png.toString('base64') }]
  const saved = await publisher.saveDraft(post, media, null)

  const draftMatch = await publisher.reconcile(post, media, null)
  assert.equal(draftMatch.published, false)
  assert.equal(draftMatch.revision, saved.sha)
  assert.equal(await publisher.reconcile(post, [
    { name: 'motion.gif', data: gif.toString('base64') },
  ], null), null)

  await git(fixture.checkout, ['fetch', 'origin'])
  await git(fixture.checkout, ['merge', '--squash', 'origin/draft/blog/safe-draft'])
  await git(fixture.checkout, ['commit', '-m', 'Publish reconciled post'])
  await git(fixture.checkout, ['push', 'origin', 'main'])

  const lingering = await publisher.saveAndPublish(post, media, saved.sha)
  assert.equal(lingering.published.alreadyPublished, true)
  assert.equal(lingering.published.sha, (await git(
    fixture.checkout,
    ['rev-parse', 'HEAD'],
  )).stdout.trim())
  assert.equal(lingering.draft.sha, saved.sha)

  const lingeringRetry = await publisher.saveAndPublish(post, media, lingering.draft.sha)
  assert.equal(lingeringRetry.published.alreadyPublished, true)
  assert.equal(lingeringRetry.draft.sha, saved.sha)

  await git(fixture.checkout, ['push', 'origin', '--delete', 'draft/blog/safe-draft'])

  const publishedMatch = await publisher.reconcile(post, media, saved.sha)
  assert.equal(publishedMatch.published, true)
  assert.equal(
    publishedMatch.revision,
    (await git(fixture.checkout, ['rev-parse', 'HEAD'])).stdout.trim(),
  )

  const repeated = await publisher.saveAndPublish(post, media, saved.sha)
  assert.equal(repeated.published.alreadyPublished, true)
  assert.equal(repeated.published.sha, publishedMatch.revision)
  const recreated = await git(fixture.checkout, [
    'ls-remote', '--heads', fixture.remote, 'refs/heads/draft/blog/safe-draft',
  ])
  assert.equal(recreated.stdout.trim(), '')
})

test('rejects reconciliation when retained media is altered or orphaned', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const post = draftPost('2026-08-02')
  const media = [{ name: 'cover.png', data: png.toString('base64') }]
  const saved = await publisher.saveDraft(post, media, null)
  await git(fixture.checkout, [
    'switch', '-C', 'draft/blog/safe-draft', 'origin/draft/blog/safe-draft',
  ])
  await writeFile(
    join(fixture.checkout, 'public', 'blog', 'media', 'safe-draft', 'orphan.png'),
    png,
  )
  await git(fixture.checkout, ['add', 'public/blog/media/safe-draft/orphan.png'])
  await git(fixture.checkout, ['commit', '-m', 'Add orphan media'])
  await git(fixture.checkout, ['push', 'origin', 'draft/blog/safe-draft'])
  await git(fixture.checkout, ['switch', 'main'])
  assert.equal(await publisher.reconcile(post, media, saved.sha), null)

  await git(fixture.checkout, ['switch', '-C', 'draft/blog/safe-draft', saved.sha])
  const alteredPng = Buffer.concat([png.subarray(0, -12), Buffer.from([0]), png.subarray(-12)])
  await writeFile(
    join(fixture.checkout, 'public', 'blog', 'media', 'safe-draft', 'cover.png'),
    alteredPng,
  )
  await git(fixture.checkout, ['add', 'public/blog/media/safe-draft/cover.png'])
  await git(fixture.checkout, ['commit', '-m', 'Alter retained media'])
  await git(fixture.checkout, ['push', '--force', 'origin', 'draft/blog/safe-draft'])
  await git(fixture.checkout, ['switch', 'main'])
  assert.equal(await publisher.reconcile(post, media, saved.sha), null)
})

test('rejects reconciliation when referenced media is absent from both trees', async () => {
  const fixture = await repositoryFixture()
  const publisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const post = draftPost('2026-08-02')
  delete post.metadata.cover
  delete post.metadata.coverAlt
  post.body = '# Draft\n\n![Missing](/blog/media/safe-draft/missing.png)'
  const saved = await publisher.saveDraft(post, [], null)

  assert.equal(await publisher.reconcile(post, [], saved.sha), null)
})

test('reconciliation waits for publication and returns its rebased revision', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  const post = draftPost('2026-08-02')
  const media = [{ name: 'cover.png', data: png.toString('base64') }]
  const saved = await initialPublisher.saveDraft(post, media, null)
  await writeFile(join(fixture.checkout, 'README.md'), '# Main advanced\n')
  await git(fixture.checkout, ['add', 'README.md'])
  await git(fixture.checkout, ['commit', '-m', 'Advance main'])
  await git(fixture.checkout, ['push', 'origin', 'main'])

  let releaseTests
  let signalTests
  const testsStarted = new Promise((resolve) => { signalTests = resolve })
  const testGate = new Promise((resolve) => { releaseTests = resolve })
  let pullRequestCreated = false
  const runner = async (command, args, options) => {
    if (command === 'fake-npm') {
      if (args[0] === 'test') {
        signalTests()
        await testGate
      }
      return { stdout: '', stderr: '' }
    }
    if (command === 'gh') {
      if (args[1] === 'list') {
        return {
          stdout: pullRequestCreated
            ? JSON.stringify([await pullRequestRecord(options)])
            : '[]',
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

  const publishing = publisher.publish('safe-draft')
  await testsStarted
  const reconciling = publisher.reconcile(post, media, saved.sha)
  releaseTests()
  const [published, reconciled] = await Promise.all([publishing, reconciling])

  assert.notEqual(published.sha, saved.sha)
  assert.equal(reconciled.revision, published.sha)
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

test('prunes worktree metadata when Git removal fails', async () => {
  const fixture = await repositoryFixture()
  let removeFailed = false
  const runner = async (command, args, options) => {
    if (
      command === 'git'
      && args[0] === 'worktree'
      && args[1] === 'remove'
      && !removeFailed
    ) {
      removeFailed = true
      throw new CommandError(command, args, 1, '', 'Injected removal failure')
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })

  await publisher.saveDraft(draftPost(), [], null)

  assert.equal(removeFailed, true)
  const worktrees = await git(fixture.checkout, ['worktree', 'list', '--porcelain'])
  assert.equal(worktrees.stdout.split(/\r?\n/u).filter((line) => line.startsWith('worktree ')).length, 1)
})

test('returns the durable revision when fallback worktree cleanup fails', async () => {
  const fixture = await repositoryFixture()
  let failRemove = true
  let failPrune = true
  const runner = async (command, args, options) => {
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'remove' && failRemove) {
      failRemove = false
      throw new CommandError(command, args, 1, '', 'Injected removal failure')
    }
    if (command === 'git' && args[0] === 'worktree' && args[1] === 'prune' && failPrune) {
      failPrune = false
      throw new CommandError(command, args, 1, '', 'Injected prune failure')
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
  })
  let failure
  try {
    await publisher.saveDraft(draftPost(), [], null)
  } catch (error) {
    failure = error
  }

  const remoteRevision = (await git(fixture.checkout, [
    '--git-dir', fixture.remote, 'rev-parse', 'refs/heads/draft/blog/safe-draft',
  ])).stdout.trim()
  assert.equal(failure.recovery.draft.sha, remoteRevision)
  await git(fixture.checkout, ['worktree', 'prune'])
  const worktrees = await git(fixture.checkout, ['worktree', 'list', '--porcelain'])
  assert.equal(worktrees.stdout.split(/\r?\n/u).filter((line) => line.startsWith('worktree ')).length, 1)
})

test('rejects draft branch code changes before running npm or GitHub', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  await initialPublisher.saveDraft(draftPost('2026-08-02'), [], null)
  await git(fixture.checkout, [
    'switch', '-C', 'draft/blog/safe-draft', 'origin/draft/blog/safe-draft',
  ])
  await writeFile(join(fixture.checkout, 'package.json'), '{"scripts":{"test":"node malicious.js"}}\n')
  await git(fixture.checkout, ['add', 'package.json'])
  await git(fixture.checkout, ['commit', '-m', 'Unexpected code change'])
  await git(fixture.checkout, ['push', 'origin', 'draft/blog/safe-draft'])
  await git(fixture.checkout, ['switch', 'main'])

  const commands = []
  const runner = async (command, args, options) => {
    commands.push([command, ...args])
    if (command === 'fake-npm' || command === 'gh') {
      throw new Error(`${command} must not run for an unsafe draft branch.`)
    }
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
    repository: 'owner/repo',
  })

  await assert.rejects(
    publisher.publish('safe-draft'),
    (error) => {
      assert.equal(error.code, 'BLOG_PUBLISH_SCOPE')
      return true
    },
  )
  assert.equal(commands.some(([command]) => ['fake-npm', 'gh'].includes(command)), false)
  assert.equal(commands.some(([command, action]) => (
    command === 'git' && action === 'worktree'
  )), false)
})

test('rejects symlink media before worktree checkout or npm', async () => {
  const fixture = await repositoryFixture()
  const initialPublisher = new BlogPublisher({ repoRoot: fixture.checkout })
  await initialPublisher.saveDraft(draftPost('2026-08-02'), [], null)
  await git(fixture.checkout, [
    'switch', '-C', 'draft/blog/safe-draft', 'origin/draft/blog/safe-draft',
  ])
  const target = join(fixture.checkout, 'symlink-target.txt')
  await writeFile(target, '../../../../outside')
  const object = (await git(fixture.checkout, ['hash-object', '-w', target])).stdout.trim()
  await git(fixture.checkout, [
    'update-index', '--add', '--cacheinfo', `120000,${object},public/blog/media/safe-draft`,
  ])
  await git(fixture.checkout, ['commit', '-m', 'Add unsafe media symlink'])
  await git(fixture.checkout, ['push', 'origin', 'draft/blog/safe-draft'])
  const tamperedRevision = (await git(fixture.checkout, ['rev-parse', 'HEAD'])).stdout.trim()
  await git(fixture.checkout, ['switch', 'main'])

  const commands = []
  const runner = async (command, args, options) => {
    commands.push([command, ...args])
    if (command === 'fake-npm') throw new Error('npm must not run for symlink media.')
    return runCommand(command, args, options)
  }
  const publisher = new BlogPublisher({
    repoRoot: fixture.checkout,
    commandRunner: runner,
    npmCommand: 'fake-npm',
  })

  await assert.rejects(
    publisher.saveAndPublish(draftPost('2026-08-02'), [], tamperedRevision),
    (error) => error.code === 'BLOG_PUBLISH_SCOPE',
  )
  assert.equal(commands.some(([command]) => command === 'fake-npm'), false)
  assert.equal(commands.some(([command, action]) => command === 'git' && action === 'worktree'), false)

  await git(fixture.checkout, ['switch', '-C', 'draft/blog/safe-draft', 'origin/main'])
  await mkdir(join(fixture.checkout, 'content', 'blog'), { recursive: true })
  await writeFile(
    join(fixture.checkout, 'content', 'blog', 'safe-draft.md'),
    serializePost(draftPost('2026-08-02')),
    'utf8',
  )
  await mkdir(join(fixture.checkout, 'public', 'blog', 'media', 'safe-draft'), {
    recursive: true,
  })
  await writeFile(
    join(fixture.checkout, 'public', 'blog', 'media', 'safe-draft', 'payload.html'),
    '<script>alert(1)</script>',
  )
  await git(fixture.checkout, ['add', 'content/blog/safe-draft.md', 'public/blog/media/safe-draft/payload.html'])
  await git(fixture.checkout, ['commit', '-m', 'Add active media blob'])
  await git(fixture.checkout, ['push', '--force', 'origin', 'draft/blog/safe-draft'])
  const activeRevision = (await git(fixture.checkout, ['rev-parse', 'HEAD'])).stdout.trim()
  await git(fixture.checkout, ['switch', 'main'])
  await assert.rejects(
    publisher.saveAndPublish(draftPost('2026-08-02'), [], activeRevision),
    (error) => error.code === 'BLOG_PUBLISH_SCOPE',
  )
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
    body: '# Safe\n\nSafe & sound.',
  }
  const invalidRequestMessage = 'The blog request is invalid. Review the studio terminal for details.'
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
    const validBody = await valid.text()
    assert.equal(valid.status, 200)
    assert.equal(/[<>&]/u.test(validBody), false)
    assert.equal(validBody.includes('\\u0026'), true)
    assert.equal(validBody.includes('\\u003c'), true)
    assert.equal(validBody.includes('\\u003e'), true)
    assert.match(JSON.parse(validBody).html, /Safe &amp; sound\./u)

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
    assert.deepEqual(await malformed.json(), {
      error: invalidRequestMessage,
      code: 'BLOG_INVALID_REQUEST',
    })

    const scalar = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: 'null',
    })
    assert.equal(scalar.status, 400)
    assert.deepEqual(await scalar.json(), {
      error: invalidRequestMessage,
      code: 'BLOG_INVALID_REQUEST',
    })

    const metacharacterError = await fetch(`${base}/api/preview`, {
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
          metadata: { ...post.metadata, '<script>&': 'unsafe' },
        },
      }),
    })
    const metacharacterBody = await metacharacterError.text()
    assert.equal(metacharacterError.status, 400)
    assert.equal(/[<>&]/u.test(metacharacterBody), false)
    assert.deepEqual(JSON.parse(metacharacterBody), {
      error: invalidRequestMessage,
      code: 'BLOG_INVALID_REQUEST',
    })

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
    assert.deepEqual(await empty.json(), {
      error: invalidRequestMessage,
      code: 'BLOG_INVALID_REQUEST',
    })

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

    const malformedRevision = await fetch(`${base}/api/draft`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({ post, expectedRevision: 'not-a-revision' }),
    })
    assert.equal(malformedRevision.status, 400)
    assert.deepEqual(await malformedRevision.json(), {
      error: invalidRequestMessage,
      code: 'BLOG_INVALID_REQUEST',
    })

    const malformedStatusRevision = await fetch(
      `${base}/api/status?slug=safe-post&revision=not-a-revision`,
      { headers: { 'x-blog-studio-token': 'test-access-token' } },
    )
    assert.equal(malformedStatusRevision.status, 400)
    assert.deepEqual(await malformedStatusRevision.json(), {
      error: invalidRequestMessage,
      code: 'BLOG_INVALID_REQUEST',
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
    assert.deepEqual(await oversizedRequest.json(), {
      error: invalidRequestMessage,
      code: 'BLOG_INVALID_REQUEST',
    })
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
    const crossOrigin = await fetch(`${base}/blog/media/published-post/cover.png`, {
      headers: { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' },
    })
    assert.equal(crossOrigin.status, 403)
    assert.deepEqual(calls, [])

    const resourceHeaders = { 'sec-fetch-site': 'same-origin' }
    const published = await fetch(`${base}/blog/media/published-post/cover.png`, {
      headers: resourceHeaders,
    })
    assert.equal(published.status, 200)
    assert.equal(published.headers.get('cross-origin-resource-policy'), 'same-origin')
    assert.deepEqual(Buffer.from(await published.arrayBuffer()), png)

    const corrupt = await fetch(`${base}/blog/media/corrupt-post/cover.png`, {
      headers: resourceHeaders,
    })
    assert.equal(corrupt.status, 500)
    assert.deepEqual(await corrupt.json(), {
      error: 'The blog studio encountered an internal error. Review the studio terminal.',
      code: 'BLOG_INTERNAL_ERROR',
    })
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

test('studio redacts dependency and internal failures with stable statuses', async () => {
  let failure = new CommandError('git', ['fetch', 'origin'], 128, '', 'private path detail')
  const logged = []
  const expectedLogged = [failure]
  const server = createStudioServer({
    publisher: {
      async listPosts() {
        throw failure
      },
    },
    accessToken: 'test-access-token',
    logger: { error: (error) => logged.push(error) },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = () => fetch(`${base}/api/posts`, {
    headers: { 'x-blog-studio-token': 'test-access-token' },
  })
  try {
    const dependency = await request()
    assert.equal(dependency.status, 502)
    assert.deepEqual(await dependency.json(), {
      error: 'A required Git, GitHub, or npm command failed. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_FAILED',
    })

    failure = new CommandTimeoutError('npm', 100)
  expectedLogged.push(failure)
    const timeout = await request()
    assert.equal(timeout.status, 504)
    assert.deepEqual(await timeout.json(), {
      error: 'A required command timed out. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_TIMEOUT',
    })

    failure = new CommandLaunchError('gh')
  expectedLogged.push(failure)
    const launch = await request()
    assert.equal(launch.status, 502)
    assert.deepEqual(await launch.json(), {
      error: 'A required Git, GitHub, or npm command failed. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_LAUNCH',
    })

    failure = new CommandOutputError('git', 100)
  expectedLogged.push(failure)
    const output = await request()
    assert.equal(output.status, 502)
    assert.deepEqual(await output.json(), {
      error: 'A required Git, GitHub, or npm command failed. Review the studio terminal before retrying.',
      code: 'BLOG_COMMAND_OUTPUT_LIMIT',
    })

    failure = new Error('C:\\private\\workspace\\detail')
  expectedLogged.push(failure)
    const internal = await request()
    assert.equal(internal.status, 500)
    assert.deepEqual(await internal.json(), {
      error: 'The blog studio encountered an internal error. Review the studio terminal.',
      code: 'BLOG_INTERNAL_ERROR',
    })
    assert.equal(logged.length, expectedLogged.length)
    for (const [index, error] of expectedLogged.entries()) assert.equal(logged[index], error)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test('studio logs auto-merge diagnostics without serializing them', async () => {
  const diagnostic = new CommandError('gh', ['pr', 'merge'], 1, '', 'private auto-merge detail')
  const published = {
    autoMergeError: 'Auto-merge could not be queued. Review the studio terminal.',
    autoMergeQueued: false,
    branch: 'draft/blog/safe-post',
    pullRequest: { number: 12, url: 'https://example.invalid/pr/12' },
    sha: 'a'.repeat(40),
  }
  Object.defineProperty(published, 'diagnostic', { value: diagnostic })
  const logged = []
  const server = createStudioServer({
    publisher: {
      async saveAndPublish() {
        return {
          draft: { branch: published.branch, sha: published.sha },
          published,
        }
      },
    },
    accessToken: 'test-access-token',
    csrf: 'test-csrf',
    logger: { error: (error) => logged.push(error) },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const response = await fetch(`${base}/api/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        'x-blog-studio-csrf': 'test-csrf',
        'x-blog-studio-token': 'test-access-token',
      },
      body: JSON.stringify({
        expectedRevision: null,
        post: {
          slug: 'safe-post',
          metadata: {
            published: '2026-08-05',
            summary: 'Safe publication.',
            title: 'Safe post',
          },
          body: '# Safe',
        },
      }),
    })
    const body = await response.text()
    assert.equal(response.status, 200)
    assert.equal(body.includes('private auto-merge detail'), false)
    assert.match(body, /Auto-merge could not be queued/u)
    assert.deepEqual(logged, [diagnostic])
  } finally {
    server.closeAllConnections()
    server.close()
  }
})