export const achievementMotifs = Object.freeze(['orbit', 'stack', 'prism', 'signal'])
export const companyMarks = Object.freeze(['microsoft', 'justice', 'bhis', 'probe'])

export function isAchievementMotif(value) {
  return achievementMotifs.includes(value)
}

export function isCompanyMark(value) {
  return companyMarks.includes(value)
}

export function isHexAccent(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value)
}

function isRootRelativeGlbPath(value) {
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.includes('?')
    || value.includes('#')
    || /[\u0000-\u0020\\\u007f]/u.test(value)
  ) return false

  try {
    const url = new URL(value, 'https://portfolio.invalid')
    return url.origin === 'https://portfolio.invalid'
      && url.pathname.toLowerCase().endsWith('.glb')
  } catch {
    return false
  }
}

export function isInstrumentDescriptor(value) {
  return value === undefined || (
    value !== null
    && typeof value === 'object'
    && isRootRelativeGlbPath(value.src)
    && Array.isArray(value.rotation)
    && value.rotation.length === 3
    && Object.hasOwn(value.rotation, 0)
    && Object.hasOwn(value.rotation, 1)
    && Object.hasOwn(value.rotation, 2)
    && Number.isFinite(value.rotation[0])
    && Number.isFinite(value.rotation[1])
    && Number.isFinite(value.rotation[2])
  )
}
