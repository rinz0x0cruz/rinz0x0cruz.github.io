import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import profile from '../src/profile.js'
import { defineCollection } from '../src/content/define.js'

const collections = [
  ['links', profile.links, ['id', 'label', 'detail', 'href'], []],
  ['skills', profile.disciplines, ['id', 'abbr', 'name', 'detail'], []],
  ['experience', profile.experience, ['id', 'company', 'role', 'kind', 'start', 'period', 'place', 'outcome'], ['notable']],
  ['languages', profile.languages, ['id', 'name', 'native', 'lang', 'level', 'detail', 'accent'], []],
  ['certifications', profile.certifications, ['id', 'issuer', 'code', 'name', 'status', 'detail', 'accent'], ['links']],
  ['projects', profile.projects, ['id', 'name', 'field', 'language', 'issued', 'blurb', 'glyph', 'accent'], ['points', 'flow']],
  ['achievements', profile.achievements, ['id', 'metric', 'title', 'detail', 'motif', 'glyph', 'accent'], []],
]

test('feature collections accept an additional valid record', () => {
  for (const [name, records, fields, lists] of collections) {
    const added = { ...records[0], id: `${records[0].id}-fixture` }
    assert.equal(defineCollection(name, [...records, added], fields, lists).length, records.length + 1)
  }

  const staticAchievement = { ...profile.achievements[0], id: 'static-achievement-fixture' }
  delete staticAchievement.instrument
  assert.equal(
    defineCollection('achievements', [...profile.achievements, staticAchievement], [
      'id', 'metric', 'title', 'detail', 'motif', 'glyph', 'accent',
    ]).at(-1).instrument,
    undefined,
  )
})

test('feature collections reject empty, incomplete, and duplicate records', () => {
  assert.throws(() => defineCollection('skills', [], ['id']), /at least one/u)
  assert.throws(() => defineCollection('skills', [{ id: 'missing-name' }], ['id', 'name']), /name is required/u)
  assert.throws(
    () => defineCollection('skills', [{ id: 'same' }, { id: 'same' }], ['id']),
    /duplicate id/u,
  )
  assert.throws(
    () => defineCollection('skills', [{ id: 'Not stable', name: 'Skill' }], ['id', 'name']),
    /lowercase letters/u,
  )
  assert.throws(
    () => defineCollection('projects', [{ id: 'project', name: 'Project', flow: [] }], ['id', 'name'], ['flow']),
    /flow must contain at least one/u,
  )
})

test('project evidence links use unique public HTTPS destinations', () => {
  const allowedHosts = new Set(['github.com', 'rinz0x0cruz.github.io'])

  for (const [projectIndex, project] of profile.projects.entries()) {
    if (!project.links) continue

    const destinations = new Set()
    for (const [linkIndex, link] of project.links.entries()) {
      assert.equal(typeof link.label, 'string', `projects[${projectIndex}].links[${linkIndex}].label`)
      assert.ok(link.label.trim(), `projects[${projectIndex}].links[${linkIndex}].label`)

      const destination = new URL(link.href)
      assert.equal(destination.protocol, 'https:', `${project.name}: ${link.href}`)
      assert.ok(allowedHosts.has(destination.hostname), `${project.name}: ${link.href}`)
      assert.equal(destinations.has(destination.href), false, `${project.name}: ${link.href}`)
      destinations.add(destination.href)
    }
  }
})

test('false-positive reduction outcome matches work-history evidence', () => {
  const achievement = profile.achievements.find(({ id }) => id === 'ingestion-specs-authored')

  assert.equal(achievement.metric, '47%')
  assert.equal(achievement.title, 'False positives reduced')
  assert.ok(profile.experience.some(({ outcome }) => (
    outcome.includes('Reduced false-positive volume by 47% across 10+ products')
  )))
})

test('security.txt publishes a current canonical disclosure contact', async () => {
  const source = await readFile(new URL('../public/.well-known/security.txt', import.meta.url), 'utf8')
  const fields = new Map(source.trim().split(/\r?\n/u).map((line) => line.split(/:\s+/u, 2)))

  assert.equal(fields.get('Contact'), 'mailto:rinz0x0cruz@gmail.com')
  assert.equal(fields.get('Canonical'), 'https://rinz0x0cruz.github.io/.well-known/security.txt')
  assert.equal(fields.get('Preferred-Languages'), 'en')
  const expires = Date.parse(fields.get('Expires'))
  assert.ok(Number.isFinite(expires))
  assert.ok(expires > Date.now(), 'security.txt must not be expired')
  assert.ok(expires - Date.now() <= 366 * 24 * 60 * 60_000, 'security.txt expiry must stay within one year')
})