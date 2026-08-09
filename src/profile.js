import identity from './content/identity.js'
import { defineCollection } from './content/define.js'
import disciplines from './content/skills.js'
import experience from './content/experience.js'
import languages from './content/languages.js'
import certifications from './content/certifications.js'
import projects from './content/projects.js'
import achievements from './content/achievements.js'
import {
  achievementMotifs,
  companyMarks,
  isAchievementMotif,
  isCompanyMark,
  isHexAccent,
  isInstrumentDescriptor,
} from './content/contracts.js'

const accentValidator = (value) => isHexAccent(value) || 'must be a six-digit hex color.'

export default {
  ...identity,
  links: defineCollection('links', identity.links, ['id', 'label', 'detail', 'href']),
  disciplines: defineCollection('skills', disciplines, ['id', 'abbr', 'name', 'detail']),
  experience: defineCollection(
    'experience',
    experience,
    ['id', 'company', 'mark', 'role', 'kind', 'start', 'period', 'place', 'outcome'],
    ['notable'],
    { mark: (value) => isCompanyMark(value) || `must be one of: ${companyMarks.join(', ')}.` },
  ),
  languages: defineCollection(
    'languages',
    languages,
    ['id', 'name', 'native', 'lang', 'level', 'detail', 'accent'],
    [],
    { accent: accentValidator },
  ),
  certifications: defineCollection(
    'certifications',
    certifications,
    ['id', 'issuer', 'code', 'name', 'status', 'detail', 'accent'],
    ['links'],
    { accent: accentValidator },
  ),
  projects: defineCollection(
    'projects',
    projects,
    ['id', 'name', 'field', 'language', 'issued', 'blurb', 'glyph', 'accent'],
    ['points', 'flow'],
    { accent: accentValidator },
  ),
  achievements: defineCollection(
    'achievements',
    achievements,
    [
      'id',
      'metric',
      'title',
      'detail',
      'evidenceLabel',
      'evidenceHref',
      'motif',
      'glyph',
      'accent',
    ],
    [],
    {
      accent: accentValidator,
      instrument: (value) => isInstrumentDescriptor(value) || 'must contain a root-relative GLB path and three finite rotations.',
      motif: (value) => isAchievementMotif(value) || `must be one of: ${achievementMotifs.join(', ')}.`,
    },
  ),
}