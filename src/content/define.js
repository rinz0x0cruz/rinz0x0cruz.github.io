export function defineCollection(name, records, requiredFields, requiredLists = []) {
  if (!Array.isArray(records) || !records.length) throw new Error(`${name} must contain at least one record.`)

  const ids = new Set()
  for (const [index, record] of records.entries()) {
    for (const field of requiredFields) {
      if (typeof record[field] !== 'string' || !record[field].trim()) {
        throw new Error(`${name}[${index}].${field} is required.`)
      }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.id)) {
      throw new Error(`${name}[${index}].id must use lowercase letters, numbers, and single hyphens.`)
    }
    for (const field of requiredLists) {
      if (!Array.isArray(record[field]) || !record[field].length) {
        throw new Error(`${name}[${index}].${field} must contain at least one item.`)
      }
    }
    if (ids.has(record.id)) throw new Error(`${name} contains duplicate id: ${record.id}.`)
    ids.add(record.id)
  }
  return records
}