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

export function isInstrumentDescriptor(value) {
  return value === undefined || (
    value !== null
    && typeof value === 'object'
    && typeof value.src === 'string'
    && /^\/[^?#]+\.glb$/iu.test(value.src)
    && Array.isArray(value.rotation)
    && value.rotation.length === 3
    && value.rotation.every(Number.isFinite)
  )
}

export function isPositiveFiniteNumber(value) {
  return Number.isFinite(value) && value > 0
}

export function isBoundedRect(value, width, height) {
  return value !== null
    && typeof value === 'object'
    && isPositiveFiniteNumber(width)
    && isPositiveFiniteNumber(height)
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && isPositiveFiniteNumber(value.width)
    && isPositiveFiniteNumber(value.height)
    && value.x >= 0
    && value.y >= 0
    && value.x + value.width <= width
    && value.y + value.height <= height
}

export function clampRect(value, width, height) {
  const safeWidth = isPositiveFiniteNumber(width) ? width : 1
  const safeHeight = isPositiveFiniteNumber(height) ? height : 1
  const x = Math.min(safeWidth - 1, Math.max(0, Number.isFinite(value?.x) ? value.x : 0))
  const y = Math.min(safeHeight - 1, Math.max(0, Number.isFinite(value?.y) ? value.y : 0))
  return {
    x,
    y,
    width: Math.min(safeWidth - x, Math.max(1, Number.isFinite(value?.width) ? value.width : 1)),
    height: Math.min(safeHeight - y, Math.max(1, Number.isFinite(value?.height) ? value.height : 1)),
  }
}
