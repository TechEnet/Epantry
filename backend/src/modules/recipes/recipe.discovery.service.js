/**
 * F1: Public recipe geography, authentic-language labels and evidence-based discovery.
 * No host-entered fields, paid AI, invented origin or public draft exposure.
 * All third-party calls are server-side, bounded, and cached. This is enrichment,
 * not an editorial approval or a replacement for the host's published dish name.
 */
import { RecipeIngredient } from './recipe.models.js'
import { getPublicRecipe, listPublicRecipes } from './recipe.public.service.js'

const DAY = 24 * 60 * 60 * 1000
const originCache = new Map()
const mapCache = new Map()
const ORIGIN_TTL = 7 * DAY
const MAP_TTL = 30 * DAY
const UNKNOWN_TTL = DAY
const REQUEST_LIMIT_MS = 3700
const FOOD_DESCRIPTION = /\b(food|dish|recipe|meal|cuisine|stew|soup|dessert|sweet|bread|cake|pastry|drink|beverage|curry|salad|noodle|rice|pudding|pie|sauce|snack|sandwich|vegetable preparation|meat preparation)\b/i
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const GB_API = 'https://www.geoboundaries.org/api/current/gbOpen/'
const USER_AGENT = process.env.EPANTRY_WIKIMEDIA_USER_AGENT || 'EPANTRYFoodDiscovery/1.0 (https://epantry.in)'

function remembered(cache, key) {
  const entry = cache.get(key)
  if (!entry || entry.expires <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function remember(cache, key, value, ttl) {
  if (cache.size >= 300) cache.delete(cache.keys().next().value)
  cache.set(key, { value, expires: Date.now() + ttl })
  return value
}

async function fetchJson(url, { timeout = REQUEST_LIMIT_MS, maxBytes = 2_400_000 } = {}) {
  const parsed = new URL(url)
  const allowedHosts = new Set([
    'www.wikidata.org', 'www.geoboundaries.org', 'geoboundaries.org',
    'raw.githubusercontent.com', 'github.com', 'media.githubusercontent.com',
  ])
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) return null
  try {
    const response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    })
    if (!response.ok || Number(response.headers.get('content-length') || 0) > maxBytes) return null
    const body = await response.text()
    return body.length <= maxBytes ? JSON.parse(body) : null
  } catch {
    return null
  }
}

async function wikidata(params) {
  const url = new URL(WIKIDATA_API)
  Object.entries({ format: 'json', origin: '*', ...params }).forEach(([key, value]) => url.searchParams.set(key, value))
  return fetchJson(url)
}

function normalized(text) {
  return String(text || '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function firstEntityId(item, property) {
  const statements = item?.claims?.[property] || []
  const statement = statements.find(row => row?.rank !== 'deprecated' && row?.mainsnak?.snaktype === 'value')
  const value = statement?.mainsnak?.datavalue?.value
  return value?.id || (Number.isInteger(value?.['numeric-id']) ? `Q${value['numeric-id']}` : '')
}

function textClaim(item, property) {
  const value = item?.claims?.[property]?.find(row => row?.rank !== 'deprecated')?.mainsnak?.datavalue?.value
  return typeof value === 'string' ? value.trim() : ''
}

async function loadEntities(ids) {
  const unique = [...new Set(ids.filter(id => /^Q\d+$/.test(id)))]
  if (!unique.length) return {}
  const response = await wikidata({
    action: 'wbgetentities', ids: unique.join('|'), props: 'labels|descriptions|claims|aliases',
  })
  return response?.entities || {}
}

function noOrigin(name) {
  return {
    hostName: name, englishName: '', localName: '', localLanguage: '',
    reading: '', country: null, region: null, wikidataId: '', sourceUrl: '',
    verified: false,
  }
}

async function resolveOrigin(name) {
  const key = normalized(name)
  if (!key) return noOrigin(name)
  const cached = remembered(originCache, key)
  if (cached) return { ...cached, hostName: name }

  const fallback = noOrigin(name)
  const search = await wikidata({ action: 'wbsearchentities', search: name, language: 'en', limit: '8' })
  // A partial/fuzzy match is not permission to rewrite a Host's recipe identity.
  const matches = (search?.search || []).filter(row =>
    normalized(row.label) === key && FOOD_DESCRIPTION.test(row.description || ''),
  )
  if (matches.length !== 1) return remember(originCache, key, fallback, UNKNOWN_TTL)

  const entityId = matches[0].id
  const entities = await loadEntities([entityId])
  const entity = entities[entityId]
  if (!entity) return remember(originCache, key, fallback, UNKNOWN_TTL)

  // P495 = country of origin; P17 = country. Do not guess from cuisine label.
  const countryId = firstEntityId(entity, 'P495') || firstEntityId(entity, 'P17')
  const regionId = firstEntityId(entity, 'P131')
  const related = await loadEntities([countryId, regionId])
  const country = related[countryId]
  const region = related[regionId]
  const countryName = country?.labels?.en?.value || ''
  const iso3 = textClaim(country, 'P298').toUpperCase()
  const officialLanguageId = firstEntityId(country, 'P37')
  const languages = await loadEntities([officialLanguageId])
  const localLanguageCode = textClaim(languages[officialLanguageId], 'P218').toLowerCase()
  const localLabel = entity.labels?.[localLanguageCode]?.value || ''
  const englishLabel = entity.labels?.en?.value || ''
  const localIsDifferent = Boolean(localLabel && normalized(localLabel) !== normalized(englishLabel || name))

  const result = {
    hostName: name,
    englishName: englishLabel && normalized(englishLabel) !== key ? englishLabel : '',
    localName: localIsDifferent ? localLabel : '',
    localLanguage: localIsDifferent ? (languages[officialLanguageId]?.labels?.en?.value || localLanguageCode) : '',
    // English Wikidata label can be a reading aid, but is not claimed to be IPA.
    reading: localIsDifferent && englishLabel ? englishLabel : '',
    country: countryName && /^[A-Z]{3}$/.test(iso3)
      ? { name: countryName, iso3, wikidataId: countryId }
      : null,
    region: countryName && region?.labels?.en?.value
      ? { name: region.labels.en.value, wikidataId: regionId }
      : null,
    wikidataId: entityId,
    sourceUrl: `https://www.wikidata.org/wiki/${entityId}`,
    verified: Boolean(countryName && /^[A-Z]{3}$/.test(iso3)),
  }
  return remember(originCache, key, result, ORIGIN_TTL)
}

function simplifyRing(ring, maxPoints = 240) {
  if (!Array.isArray(ring) || ring.length < 4) return []
  const step = Math.max(1, Math.ceil(ring.length / maxPoints))
  const points = ring.filter((_, i) => i % step === 0)
    .map(point => [Number(Number(point[0]).toFixed(3)), Number(Number(point[1]).toFixed(3))])
    .filter(point => point.every(Number.isFinite))
  if (points.length > 2) points.push(points[0])
  return points.length >= 4 ? points : []
}

function toRings(geojson, maxFeatures = 55) {
  const features = geojson?.type === 'FeatureCollection' ? geojson.features : [geojson]
  if (!Array.isArray(features)) return []
  return features.slice(0, maxFeatures).flatMap(feature => {
    const geometry = feature?.geometry || feature
    const polygons = geometry?.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []
    const rings = polygons.slice(0, 25).flatMap(polygon => polygon.slice(0, 2).map(ring => simplifyRing(ring)).filter(Boolean))
    return rings.length ? [{ name: String(feature?.properties?.shapeName || feature?.properties?.name || '').slice(0, 100), rings }] : []
  })
}

export async function loadMap(country, region) {
  if (!country?.iso3) return null
  const key = country.iso3
  const cached = remembered(mapCache, key)
  if (cached !== undefined) return cached
  const readLevel = async level => {
    const metadata = await fetchJson(`${GB_API}${key}/${level}/`, { timeout: 3000 })
    const geoURL = metadata?.simplifiedGeometryGeoJSON
    if (!geoURL) return []
    const json = await fetchJson(geoURL, { timeout: 4500 })
    return toRings(json)
  }
  const outline = await readLevel('ADM0')
  if (!outline.length) return remember(mapCache, key, null, UNKNOWN_TTL)
  // Keep state boundaries as separate polygons. Region is highlighted only
  // when Wikidata has actually identified a matching administrative unit.
  const stateShapes = region?.name ? await readLevel('ADM1') : []
  return remember(mapCache, key, {
    outline, states: stateShapes,
    credit: { label: 'geoBoundaries (CC BY 4.0)', url: 'https://www.geoboundaries.org/' },
  }, MAP_TTL)
}

function normalizedSet(values) {
  return new Set(values.map(value => String(value || '').trim()).filter(Boolean))
}

async function findRelated(published) {
  const mainIds = normalizedSet(published.ingredients?.map(row => row?.canonicalIngredientId || row?.ingredient?.id) || [])
  if (!mainIds.size) return { similar: [], candidates: [] }
  const firstPage = await listPublicRecipes({ page: 1, limit: 50, search: '', cuisine: '', course: '', tag: '', sourceScope: 'all' })
  const secondPage = (firstPage?.pagination?.pages || 0) > 1
    ? await listPublicRecipes({ page: 2, limit: 50, search: '', cuisine: '', course: '', tag: '', sourceScope: 'all' })
    : { recipes: [] }
  const candidates = [...(firstPage.recipes || []), ...(secondPage.recipes || [])]
    .filter(item => item?.dish?.slug !== published?.dish?.slug && item?.recipe?.id)
  if (!candidates.length) return { similar: [], candidates: [] }
  const versionIds = candidates.map(item => item.recipe.id)
  const ingredientRows = await RecipeIngredient.find({ recipeVersionId: { $in: versionIds } })
    .select('recipeVersionId canonicalIngredientId').lean()
  const byVersion = new Map()
  ingredientRows.forEach(row => {
    const versionId = String(row.recipeVersionId)
    if (!byVersion.has(versionId)) byVersion.set(versionId, new Set())
    byVersion.get(versionId).add(String(row.canonicalIngredientId))
  })
  const ranked = candidates.map(item => {
    const ids = byVersion.get(String(item.recipe.id)) || new Set()
    const shared = [...mainIds].filter(id => ids.has(id)).length
    const cuisineMatch = published.dish.cuisine && normalized(published.dish.cuisine) === normalized(item.dish?.cuisine)
    const courseMatch = published.dish.course && normalized(published.dish.course) === normalized(item.dish?.course)
    const overlap = shared / Math.max(mainIds.size, ids.size, 1)
    return { item, shared, score: shared * 12 + overlap * 8 + Number(Boolean(cuisineMatch)) * 3 + Number(Boolean(courseMatch)) * 2 }
  }).filter(entry => entry.shared > 0).sort((a, b) => b.score - a.score)
  return { similar: ranked.slice(0, 5).map(entry => entry.item), candidates }
}

export async function getRecipeDiscovery(slug) {
  // Published and active checks stay centralized in the existing service.
  const published = await getPublicRecipe(slug)
  const origin = await resolveOrigin(published.dish.name)
  const [map, related] = await Promise.all([
    origin.country ? loadMap(origin.country, origin.region) : Promise.resolve(null),
    findRelated(published),
  ])

  let moreFromCountry = []
  // Prevent language/cuisine metadata alone from being treated as factual origin.
  if (origin.country && published.dish.cuisine) {
    const candidates = related.candidates
      .filter(item => normalized(item.dish?.cuisine) === normalized(published.dish.cuisine))
      .slice(0, 3)
    // Keep Wikimedia concurrency <= 3 and avoid an unbounded discovery request.
    const tested = await Promise.all(candidates.map(async item => ({
      item,
      origin: await resolveOrigin(item.dish.name),
    })))
    moreFromCountry = tested
      .filter(result => result.origin.country?.iso3 === origin.country.iso3)
      .map(result => result.item)
  }

  return {
    name: published.dish.name,
    origin,
    map,
    similarRecipes: related.similar,
    moreFromCountry,
    // An AI answer or cuisine tag does not prove country-by-country popularity.
    worldwidePopularity: null,
    dataPolicy: 'Only documented geographic facts and published EPANTRY recipes are returned.',
  }
}
