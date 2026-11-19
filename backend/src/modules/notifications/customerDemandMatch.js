/**
 * Conservative whole-word product request matching.
 * Never use fuzzy substring matching for availability notifications.
 */
export function normalizeDemandProductName(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function matchesCustomerDemand(wantedValue, availableValue) {
  const wanted = normalizeDemandProductName(wantedValue)
  const available = normalizeDemandProductName(availableValue)
  if (wanted.length < 3 || !available) return false
  return wanted === available || available.startsWith(`${wanted} `) ||
    available.endsWith(` ${wanted}`) || available.includes(` ${wanted} `)
}
