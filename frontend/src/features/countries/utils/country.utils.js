// Country flag is derived from a real ISO 3166-1 alpha-2 code, never a guessed image.
const NORMALIZE = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const KNOWN = {
  'united states': 'US', 'united states of america': 'US', 'usa': 'US', 'america': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'south korea': 'KR', 'north korea': 'KP', 'russia': 'RU',
  'czech republic': 'CZ', 'uae': 'AE', 'united arab emirates': 'AE',
  'vietnam': 'VN', 'taiwan': 'TW', 'ivory coast': 'CI',
  'india': 'IN', 'japan': 'JP', 'thailand': 'TH', 'italy': 'IT',
  'mexico': 'MX', 'france': 'FR', 'china': 'CN', 'germany': 'DE',
  'spain': 'ES', 'pakistan': 'PK', 'bangladesh': 'BD', 'nepal': 'NP',
}
let isoCodes
function getCodes() {
  if (isoCodes) return isoCodes
  isoCodes = new Map(Object.entries(KNOWN))
  try {
    const countries = new Intl.DisplayNames(['en'], { type: 'region' })
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      const label = countries.of(code)
      if (label && label !== code && !isoCodes.has(NORMALIZE(label))) isoCodes.set(NORMALIZE(label), code)
    }
  } catch { /* Explicit known ISO codes remain available. */ }
  return isoCodes
}
export function countryFlag(name) {
  const iso2 = getCodes().get(NORMALIZE(name))
  if (!iso2 || !/^[A-Z]{2}$/.test(iso2)) return ''
  return String.fromCodePoint(...[...iso2].map(letter => 127397 + letter.charCodeAt(0)))
}
export function countryExplorePath(name) {
  const country = String(name || '').trim()
  return `/explore/countries/${encodeURIComponent(country)}`
}
