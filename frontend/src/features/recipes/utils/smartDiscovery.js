/*
 * M2 Smart Discovery: deterministic read-only selection of approved public
 * recipes already returned by EPANTRY. Never invent views, trends, holidays,
 * source regions, food classifications or publication status.
 *
 * Editorial metadata is stored in Dish.tags, already supported by EPANTRY:
 * season:summer | festival:diwali | discover-from:2026-11-01 |
 * discover-until:2026-11-30 | region:India | editorial:featured
 * A date window is mandatory for seasonal/festival promotion; no claim is made
 * outside it. Dates are evaluated against the customer's calendar date.
 */
export const MEALS = Object.freeze(['Breakfast', 'Lunch', 'Snacks', 'Dinner'])
const COURSE_TERMS = {
  Breakfast: new Set(['breakfast', 'brunch', 'morning meal']),
  Lunch: new Set(['lunch', 'midday meal', 'afternoon meal']),
  Snacks: new Set(['snack', 'snacks', 'starter', 'appetizer', 'small plates', 'quick bites']),
  Dinner: new Set(['dinner', 'supper', 'evening meal']),
}
const norm = (value) => String(value ?? '').trim().toLocaleLowerCase('en').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
const isDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) && new Date(`${text}T00:00:00Z`).toISOString().startsWith(text)

export function getLocalMeal(now = new Date()) {
  const h = now.getHours()
  if (h >= 5 && h < 11) return 'Breakfast'
  if (h >= 11 && h < 15) return 'Lunch'
  if (h >= 15 && h < 18) return 'Snacks'
  return 'Dinner'
}

export function localCalendarDate(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function recipeMeta(entry) {
  const item = entry?.item || entry || {}
  const dish = item?.dish || {}
  const recipe = item?.recipe || {}
  const tags = [
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(dish.tags) ? dish.tags : []),
    ...(Array.isArray(recipe.tags) ? recipe.tags : []),
  ].filter((tag) => typeof tag === 'string').map((tag) => tag.trim())
  const course = [
    ...(Array.isArray(item.courseLabels) ? item.courseLabels : []),
    item.course, dish.course, recipe.course,
    item.mealType, dish.mealType, recipe.mealType,
  ].filter(Boolean).map(norm)
  // Country and cuisine are declared metadata only. Do not derive from title,
  // account address or an inferred geolocation.
  const cuisine = String(item.cuisine || dish.cuisine || recipe.cuisine || '').trim()
  const country = String(item.originCountry || item.countryOfOrigin || dish.countryOfOrigin || dish.originCountry || recipe.countryOfOrigin || '').trim()
  return { tags, course, cuisine, country }
}

// Admin recipe creation normalizes tags with normalizeRecipeKey(), turning
// `discover-from:2026-11-01` into `discover_from_2026_11_01`.
// Accept both normalized saved tags and raw host/editorial tags.
function tagged(tags, prefix) {
  const normalizedPrefix = `${prefix.replace(/-/g, '_')}_`
  for (const value of tags) {
    const raw = String(value).trim()
    if (raw.toLowerCase().startsWith(`${prefix}:`)) return raw.slice(prefix.length + 1).trim()
    if (raw.toLowerCase().startsWith(normalizedPrefix)) {
      const suffix = raw.slice(normalizedPrefix.length)
      if (prefix === 'discover-from' || prefix === 'discover-until') return suffix.replace(/_/g, '-')
      return suffix.replace(/_/g, ' ')
    }
  }
  return ''
}

export function editorialEvidence(entry, now = new Date(), location = '') {
  const { tags } = recipeMeta(entry)
  const season = tagged(tags, 'season')
  const festival = tagged(tags, 'festival')
  const from = tagged(tags, 'discover-from')
  const until = tagged(tags, 'discover-until')
  const region = tagged(tags, 'region')
  const today = localCalendarDate(now)
  const datesValid = isDate(from) && isDate(until) && from <= until
  const active = datesValid && from <= today && today <= until
  // Location is user-selected/opted-in; unknown does not qualify a region-only campaign.
  const regionAllowed = !region || (location && norm(region) === norm(location))
  return {
    seasonal: Boolean((season || festival) && active && regionAllowed),
    label: festival && active && regionAllowed ? festival.replace(/-/g, ' ') : season && active && regionAllowed ? season.replace(/-/g, ' ') : '',
    editorial: tags.some((tag) => ['editorial_featured', 'editorial:featured'].includes(String(tag).trim().toLowerCase())),
    region,
  }
}

export function matchesMeal(entry, meal) {
  const allowed = COURSE_TERMS[meal]
  if (!allowed) return false
  return recipeMeta(entry).course.some((term) => allowed.has(term))
}

export function getCuisineOptions(entries = []) {
  const blocked = new Set(['recipe', 'recipes', 'food', 'dish', 'meal', 'drinks', 'drink', 'sweets', 'desserts', 'bakery', 'ready made food'])
  return [...new Set(entries.flatMap((entry) => {
    const meta = recipeMeta(entry)
    return [meta.country || meta.cuisine, tagged(meta.tags, 'region')]
  }).filter((value) => value && !blocked.has(norm(value))))].sort((a, b) => a.localeCompare(b))
}

export function getSmartRecipes(entries = [], { mode = 'now', meal = getLocalMeal(), region = '', now = new Date(), limit = 6 } = {}) {
  const list = Array.isArray(entries) ? entries : []
  let selected = []
  if (mode === 'seasonal') selected = list.filter((entry) => editorialEvidence(entry, now, region).seasonal)
  else if (mode === 'editorial') selected = list.filter((entry) => editorialEvidence(entry, now, region).editorial)
  else if (mode === 'region') selected = region ? list.filter((entry) => {
    const meta = recipeMeta(entry)
    return norm(meta.country) === norm(region) || norm(meta.cuisine) === norm(region)
  }) : []
  else selected = list.filter((entry) => matchesMeal(entry, meal))
  // Strict mode: no misleading fallback labelled as seasonal, local or popular.
  const matched = selected.length > 0
  // When an explicitly chosen theme is empty, the caller can show a neutral
  // browse fallback. Do not silently switch labels.
  const count = Math.max(1, Math.min(36, Number(limit) || 6))
  return { items: selected.slice(0, count), matched }
}

export function buildEditorialTags({ season = '', festival = '', from = '', until = '', region = '', featured = false } = {}) {
  const selectedSeason = String(season).trim().toLowerCase()
  const selectedFestival = String(festival).trim().toLowerCase().replace(/[^a-z0-9\s-]+/g, '').replace(/\s+/g, '-').slice(0, 55)
  const selectedRegion = String(region).trim().slice(0, 60)
  const seasonal = Boolean(selectedSeason || selectedFestival)
  if (seasonal && (!isDate(from) || !isDate(until) || from > until)) {
    throw new Error('Seasonal or festival collections need a valid start and end date (YYYY-MM-DD).')
  }
  const tags = []
  if (selectedSeason) tags.push(`season:${selectedSeason}`)
  if (selectedFestival) tags.push(`festival:${selectedFestival}`)
  if (seasonal) tags.push(`discover-from:${from}`, `discover-until:${until}`)
  if (selectedRegion) tags.push(`region:${selectedRegion}`)
  if (featured) tags.push('editorial:featured')
  return tags
}
