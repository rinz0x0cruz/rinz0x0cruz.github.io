import identity from './content/identity.js'
import { defineCollection } from './content/define.js'
import disciplines from './content/skills.js'
import experience from './content/experience.js'
import languages from './content/languages.js'
import certifications from './content/certifications.js'
import projects from './content/projects.js'
import achievements from './content/achievements.js'

export default {
  ...identity,
  links: defineCollection('links', identity.links, ['id', 'label', 'detail', 'href']),
  disciplines: defineCollection('skills', disciplines, ['id', 'abbr', 'name', 'detail']),
  experience: defineCollection('experience', experience, ['id', 'company', 'role', 'kind', 'start', 'period', 'place', 'outcome'], ['notable']),
  languages: defineCollection('languages', languages, ['id', 'name', 'native', 'lang', 'level', 'detail', 'accent']),
  certifications: defineCollection('certifications', certifications, ['id', 'issuer', 'code', 'name', 'status', 'detail', 'accent'], ['links']),
  projects: defineCollection('projects', projects, ['id', 'name', 'field', 'language', 'issued', 'blurb', 'glyph', 'accent'], ['points', 'flow']),
  achievements: defineCollection('achievements', achievements, ['id', 'metric', 'title', 'detail', 'motif', 'glyph', 'accent']),
}