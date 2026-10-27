/**
 * F1: Public recipe geography, authentic-language labels and evidence-based discovery.
 * No host-entered fields, paid AI, invented origin or public draft exposure.
 * All third-party calls are server-side, bounded, and cached. This is enrichment,
 * not an editorial approval or a replacement for the host's published dish name.
 */
import { RecipeIngredient } from './recipe.models.js'
import { HostUnifiedListingPacket } from '../hostOperations/hostUnifiedListing.models.js'
import { publicListing } from '../hostOperations/hostUnifiedListing.public.js'
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
    'raw.githubusercontent.com', 'github.com', 'media.githubusercontent.com', 'objects.githubusercontent.com',
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

export async function resolveOrigin(name) {
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
    // A country can contain many disconnected islands. Truncating the first
    // 25 polygons clipped India's island groups and produced an incomplete map.
    const rings = polygons.slice(0, 240).flatMap(polygon => polygon.slice(0, 2).map(ring => simplifyRing(ring)).filter(Boolean))
    return rings.length ? [{ name: String(feature?.properties?.shapeName || feature?.properties?.name || feature?.properties?.st_nm || feature?.properties?.ST_NM || feature?.properties?.STATE || feature?.properties?.State || feature?.properties?.State_Name || feature?.properties?.NAME_1 || '').slice(0, 100), rings }] : []
  })
}

export async function loadMap(country, region) {
  if (!country?.iso3) return null
  // Map with ADM1 is different data from country-only map. The old country-only
  // cache silently prevented state highlighting when a second recipe loaded.
  const regionName = normalized(region?.name)
  const key = `${country.iso3}:${regionName || 'country'}`
  const cached = remembered(mapCache, key)
  if (cached !== undefined) return cached

  const readLevel = async level => {
    const metadata = await fetchJson(`${GB_API}${country.iso3}/${level}/`, { timeout: 3800 })
    const geometryUrl = metadata?.simplifiedGeometryGeoJSON
    if (!geometryUrl) return []
    // geoBoundaries serves its actual GeoJSON on github.com; both hosts are
    // allowlisted above. A URL from any other origin is still rejected.
    const geojson = await fetchJson(geometryUrl, { timeout: 6500, maxBytes: 6_000_000 })
    return toRings(geojson, level === 'ADM1' ? 80 : 55)
  }

  let outline = await readLevel('ADM0')
  let credit = { label: country.iso3 === 'IND' ? 'geoBoundaries (India, CC BY 2.5 IN)' : 'geoBoundaries (source-specific licence)', url: 'https://www.geoboundaries.org/' }
  if (!outline.length) {
    const earth = await fetchJson('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson', {
      timeout: 5500, maxBytes: 1_700_000,
    })
    const features = Array.isArray(earth?.features) ? earth.features : []
    const selected = features.find(feature => [feature.properties?.ADM0_A3, feature.properties?.SOV_A3, feature.properties?.ISO_A3, feature.properties?.GU_A3].includes(country.iso3))
    outline = selected ? toRings({ type: 'FeatureCollection', features: [selected] }) : []
    if (outline.length) credit = { label: 'Natural Earth (public domain)', url: 'https://www.naturalearthdata.com/' }
  }

  let states = regionName ? await readLevel('ADM1') : []
  let stateCredit = null
  // Public MIT-licensed India state data is a fallback if the large geoBoundaries
  // ADM1 file is temporarily unreachable. It is not presented as verified origin.
  if (regionName && country.iso3 === 'IND' && (!states.length || !states.some(item => normalized(item.name) === regionName))) {
    const indiaStates = await fetchJson('https://raw.githubusercontent.com/AbhinavSwami28/india-official-geojson/main/india-states-simplified.geojson', {
      timeout: 5500, maxBytes: 1_000_000,
    })
    const fallbackStates = toRings(indiaStates, 55)
    if (fallbackStates.some(item => normalized(item.name) === regionName)) {
      states = fallbackStates
      stateCredit = { label: 'India States (community dataset)', url: 'https://github.com/AbhinavSwami28/india-official-geojson' }
      // CRITICAL: keep the complete country ADM0 boundary. State features are
      // *only* an overlay for region highlighting, not a replacement for India.
      // Previously `outline = fallbackStates` cut/warped India's silhouette.
    }
  }
  // Only use state geometry as the silhouette if *no* ADM0 provider succeeded.
  // Never substitute it for an actual country outline during a normal request.
  if (!outline.length && states.length) {
    outline = states
    if (stateCredit) credit = stateCredit
  }
  if (!outline.length) return remember(mapCache, key, null, UNKNOWN_TTL)
  return remember(mapCache, key, { outline, states, credit, stateCredit }, MAP_TTL)
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
  // Location remains as text; maps are intentionally not requested by Recipe Detail.
  const related = await findRelated(published)

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
    map: null,
    similarRecipes: related.similar,
    moreFromCountry,
    // An AI answer or cuisine tag does not prove country-by-country popularity.
    worldwidePopularity: null,
    dataPolicy: 'Only documented geographic facts and published EPANTRY recipes are returned.',
  }
}


// Approved Host submissions reuse the SAME customer Recipe Detail component.
// Their supplied geographic assertions remain visibly Host-declared, not
// Wikidata-verified. Discovery never leaks private Host costs or draft records.
const HOST_ISO3 = Object.freeze({
  india: 'IND', japan: 'JPN', china: 'CHN', france: 'FRA', italy: 'ITA',
  thailand: 'THA', 'united states': 'USA', usa: 'USA', 'united kingdom': 'GBR',
  mexico: 'MEX', spain: 'ESP', germany: 'DEU', 'south korea': 'KOR',
  indonesia: 'IDN', vietnam: 'VNM', turkey: 'TUR', pakistan: 'PAK',
  nepal: 'NPL', 'sri lanka': 'LKA', bangladesh: 'BGD', 'united arab emirates': 'ARE',
  australia: 'AUS', canada: 'CAN', brazil: 'BRA', russia: 'RUS',
  malaysia: 'MYS', singapore: 'SGP', morocco: 'MAR', egypt: 'EGY',
  nigeria: 'NGA', peru: 'PER', argentina: 'ARG', 'south africa': 'ZAF',
})
const publicHostFilter = { status: 'approved', deletedAt: null }
function listItemFromHost(record) {
  const l = publicListing(record)
  return {
    path: `/recipes/host--${l.id}`,
    dish: { slug: `host--${l.id}`, name: l.title, heroImageUrl: l.images?.[0] || '',
      cuisine: l.countryOfOrigin || '', course: l.category || '' },
    recipe: { id: `host--${l.id}` },
  }
}
function nameSet(items) {
  return new Set((items || []).map(item => normalized(item?.name || item?.ingredient?.name)).filter(Boolean))
}
export async function getHostRecipeDiscovery(record) {
  if (!record || record.status !== 'approved' || record.deletedAt || record.type === 'grocery') return null
  const packet = record.packet || {}
  const declaredCountry = String(packet.countryOfOrigin || '').trim()
  const declaredRegion = String(packet.regionOfOrigin || '').trim()
  // Wikidata is used for documented names; it must never overwrite a Host's
  // explicitly declared country with an unrelated or fuzzy search result.
  const documented = await resolveOrigin(record.title)
  const origin = {
    ...documented,
    hostName: record.title,
    localName: packet.localRecipeName || documented.localName || '',
    localLanguage: packet.localRecipeName ? (packet.localRecipeLanguage || '') : documented.localLanguage,
    reading: packet.englishNameReading || documented.reading || '',
    country: declaredCountry ? { name: declaredCountry,
      iso3: HOST_ISO3[normalized(declaredCountry)] || (normalized(documented.country?.name) === normalized(declaredCountry) ? documented.country.iso3 : '') } : documented.country,
    region: declaredRegion ? { name: declaredRegion } : (declaredCountry ? null : documented.region),
    sourceUrl: declaredCountry ? '' : documented.sourceUrl,
    sourceType: declaredCountry ? 'host_declared' : 'wikidata',
    verified: !declaredCountry && documented.verified,
  }
  // Only fetch real published records. Host packet data is NOT a catalogue
  // recipe version, so name equality is the narrow truthful similarity test.
  const hosts = await HostUnifiedListingPacket.find({ ...publicHostFilter,
    type: { $in: ['kitchen_recipe', 'brand_recipe', 'prepared_food'] },
    _id: { $ne: record._id },
  }).sort({ approvedAt: -1 }).limit(60).lean()
  const originalNames = nameSet(packet.ingredients)
  const rankedHosts = hosts.map(other => {
    const ingredients = nameSet(other.packet?.ingredients)
    const common = [...originalNames].filter(n => ingredients.has(n)).length
    return { other, common }
  }).filter(x => x.common > 0).sort((a,b) => b.common - a.common)
  let moreFromCountry = hosts.filter(other => origin.country &&
    normalized(other.packet?.countryOfOrigin) === normalized(origin.country.name) &&
    (!origin.region?.name || normalized(other.packet?.regionOfOrigin) === normalized(origin.region.name)))
    .slice(0, 5).map(listItemFromHost)
  let similarRecipes = rankedHosts.slice(0, 5).map(({other}) => listItemFromHost(other))
  // Include genuine published canonical EPANTRY recipes when ingredient names
  // overlap. Never claim the ingredients are canonical-matched without evidence.
  try {
    const page = await listPublicRecipes({ page: 1, limit: 24, search: '', cuisine: '', course: '', tag: '', sourceScope: 'all' })
    const candidates = (page?.recipes || []).filter(x => x?.dish?.slug).slice(0, 16)
    const checked = await Promise.all(candidates.map(async c => {
      try {
        const published = await getPublicRecipe(c.dish.slug)
        const similar = [...nameSet(published.ingredients)].filter(n => originalNames.has(n)).length
        const originalCountry = origin.country ? await resolveOrigin(c.dish.name) : null
        return { c, similar, originalCountry }
      } catch { return null }
    }))
    for (const candidate of checked.filter(Boolean)) {
      if (candidate.similar > 0 && similarRecipes.length < 5)
        similarRecipes.push(candidate.c)
      if (origin.country && candidate.originalCountry?.country?.name &&
          normalized(candidate.originalCountry.country.name) === normalized(origin.country.name) &&
          (!origin.region?.name || normalized(candidate.originalCountry.region?.name) === normalized(origin.region.name)) &&
          moreFromCountry.length < 5) moreFromCountry.push(candidate.c)
    }
  } catch { /* Public canonical discovery is optional; never expose unpublished data. */ }
  return {
    name: record.title, origin,
    map: null,
    similarRecipes, moreFromCountry,
    dataPolicy: 'Origin provided by Host when declared; recommendations contain only approved/published recipes.',
  }
}
