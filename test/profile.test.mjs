import assert from 'node:assert/strict'
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