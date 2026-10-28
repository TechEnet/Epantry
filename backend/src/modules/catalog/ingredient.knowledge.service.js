/**
 * F2 – Public ingredient knowledge. Reuses the canonical ingredient identity,
 * approved Host listing media and the existing published Recipe lifecycle.
 * Wikimedia facts are optional, source-attributed and never treated as Host data.
 */
import { CanonicalIngredient } from './catalog.models.js'
import { HostUnifiedListingPacket } from '../hostOperations/hostUnifiedListing.models.js'
import { publicHostSlug } from '../hostOperations/hostUnifiedListing.public.js'
import { Dish, RecipeIngredient, RecipeVersion } from '../recipes/recipe.models.js'
import { getPublicRecipe } from '../recipes/recipe.public.service.js'
import { ApiError } from '../../utils/ApiError.js'

const OBJECT_ID = /^[a-f\d]{24}$/i
const ENTITY_ID = /^Q\d+$/
const DAY = 86_400_000
const MAX_TEXT = 720
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const REQUEST_MS = 3600
const USER_AGENT = process.env.EPANTRY_WIKIMEDIA_USER_AGENT || 'EPANTRYFoodDiscovery/1.0 (https://epantry.in)'
const FOOD_CONTEXT = /\b(food|ingredient|plant|fruit|vegetable|root|spice|herb|seed|grain|nut|legume|tuber|cereal|edible|crop|culinary|fish|meat|dairy|cheese|pulse|milk|egg|flour|sauce|beverage|fungus|mushroom|species)\b/i
const memo = new Map()

function safeWord(value, max = 160) {
  return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
}
function norm(value) {
  return safeWord(value).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function readableSearchName(value) {
  // Catalog identity is unchanged. This only repairs legacy joined names
  // such as "ChickenBreast" when searching public encyclopedias.
  return safeWord(value)
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function media(value) {
  const url = safeWord(value, 2000)
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? url : ''
  } catch { return '' }
}
function lookupMemo(key) {
  const record = memo.get(key)
  if (!record || record.until < Date.now()) {
    memo.delete(key)
    return undefined
  }
  return record.data
}
function cacheMemo(key, data, ttl) {
  if (memo.size >= 250) memo.delete(memo.keys().next().value)
  memo.set(key, { data, until: Date.now() + ttl })
  return data
}
async function jsonRequest(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || !['www.wikidata.org', 'en.wikipedia.org', 'commons.wikimedia.org'].includes(u.hostname)) return null
    const response = await fetch(u, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_MS),
    })
    if (!response.ok || Number(response.headers.get('content-length') || 0) > 800_000) return null
    const body = await response.text()
    return body.length <= 800_000 ? JSON.parse(body) : null
  } catch { return null }
}
async function wikidata(query) {
  const u = new URL(WIKIDATA_API)
  Object.entries({ format: 'json', ...query }).forEach(([k, v]) => u.searchParams.set(k, v))
  return jsonRequest(u)
}
function entityId(entity, property) {
  const statement = (entity?.claims?.[property] || []).find(item =>
    item.rank !== 'deprecated' && item.mainsnak?.snaktype === 'value',
  )
  const value = statement?.mainsnak?.datavalue?.value
  return value?.id || ''
}
function stringClaim(entity, property) {
  const statement = (entity?.claims?.[property] || []).find(item => item.rank !== 'deprecated')
  const value = statement?.mainsnak?.datavalue?.value
  return typeof value === 'string' ? value : ''
}
async function entities(ids) {
  const unique = [...new Set(ids.filter(id => ENTITY_ID.test(id)))].slice(0, 5)
  if (!unique.length) return {}
  const response = await wikidata({
    action: 'wbgetentities', ids: unique.join('|'), props: 'labels|descriptions|claims|aliases|sitelinks',
  })
  return response?.entities || {}
}
// Only show an image when an exact Wikidata ingredient identifies the
// Commons file and Commons explicitly provides a reusable license.
// Artist/license/source stay visible to the customer for attribution.
async function licensedCommonsImage(filename) {
  const file = safeWord(filename, 240)
  if (!file || !/\.(?:jpe?g|png|webp)$/i.test(file)) return null
  const url = new URL(COMMONS_API)
  Object.entries({
    action: 'query', format: 'json', titles: `File:${file}`,
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '900',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  const response = await jsonRequest(url)
  const page = Object.values(response?.query?.pages || {})[0]
  const info = page?.imageinfo?.[0]
  const license = safeWord(String(info?.extmetadata?.LicenseShortName?.value || '')
    .replace(/<[^>]*>/g, ''), 80)
  const free = /^CC BY(?:-SA)?(?:\s|$)/i.test(license) ||
    /^(?:CC0|public domain|PD-old|PD-self|PD-author)/i.test(license)
  const imageUrl = media(info?.thumburl || info?.url)
  const sourceUrl = media(info?.descriptionurl)
  if (!free || !imageUrl || !sourceUrl) return null
  const artist = safeWord(String(info?.extmetadata?.Artist?.value || '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '), 160)
  return { imageUrl, license, artist, sourceUrl }
}

async function exactWikipediaArticle(name) {
  const label = readableSearchName(name)
  if (!label) return null
  const query = new URL(WIKIPEDIA_API)
  Object.entries({
    action: 'query', format: 'json', prop: 'extracts|pageprops', exintro: '1',
    explaintext: '1', redirects: '1', titles: label,
  }).forEach(([key, value]) => query.searchParams.set(key, value))
  const response = await jsonRequest(query)
  const page = Object.values(response?.query?.pages || {})[0]
  if (!page || page.missing !== undefined || !page.extract) return null
  const redirects = response?.query?.redirects || []
  const exactTitle = norm(page.title) === norm(label)
  const redirectedFromExactName = redirects.some(row => norm(row.from) === norm(label))
  if (!exactTitle && !redirectedFromExactName) return null
  const cleaned = String(page.extract).replace(/\s+/g, ' ').trim()
  return cleaned ? {
    summary: cleaned.length > MAX_TEXT
      ? `${cleaned.slice(0, MAX_TEXT).replace(/\s+\S*$/, '')}…`
      : cleaned,
    title: safeWord(page.title, 160),
    wikidataId: ENTITY_ID.test(page.pageprops?.wikibase_item || '') ? page.pageprops.wikibase_item : '',
  } : null
}

async function encyclopedia(name) {
  const searchName = readableSearchName(name)
  const key = `wiki:${norm(searchName)}`
  if (!norm(searchName)) return null
  const saved = lookupMemo(key)
  if (saved !== undefined) return saved
  const search = await wikidata({ action: 'wbsearchentities', search: searchName, language: 'en', limit: '8' })
  const candidates = (search?.search || []).filter(item =>
    (norm(item.label) === norm(searchName) || (item.aliases || []).some(alias => norm(alias) === norm(searchName))) &&
    FOOD_CONTEXT.test(item.description || ''),
  )
  // When a precise Wikidata identity is not available, use only a directly
  // matching Wikipedia article/redirect. Do not accept loose search hits.
  if (candidates.length !== 1 || !ENTITY_ID.test(candidates[0].id)) {
    const article = await exactWikipediaArticle(searchName)
    const item = article?.wikidataId
      ? (await entities([article.wikidataId]))[article.wikidataId] : null
    const image = item ? await licensedCommonsImage(stringClaim(item, 'P18')) : null
    const fallback = article ? {
      wikidataId: article.wikidataId || '', wikipediaTitle: article.title, summary: article.summary,
      aliases: [], origin: null, source: null, image,
      article: { name: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}` },
    } : null
    return cacheMemo(key, fallback, fallback ? 7 * DAY : DAY)
  }
  const item = (await entities([candidates[0].id]))[candidates[0].id]
  if (!item) {
    const article = await exactWikipediaArticle(searchName)
    const recovered = article?.wikidataId
      ? (await entities([article.wikidataId]))[article.wikidataId] : null
    const image = recovered ? await licensedCommonsImage(stringClaim(recovered, 'P18')) : null
    return cacheMemo(key, article ? {
      wikidataId: article.wikidataId || '', wikipediaTitle: article.title, summary: article.summary,
      aliases: [], origin: null, source: null, image,
      article: { name: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}` },
    } : null, article ? 7 * DAY : DAY)
  }
  const enwiki = item.sitelinks?.enwiki?.title || ''
  let summary = ''
  if (enwiki) {
    const u = new URL(WIKIPEDIA_API)
    Object.entries({ action: 'query', format: 'json', prop: 'extracts', exintro: '1', explaintext: '1', redirects: '1', titles: enwiki }).forEach(([k, v]) => u.searchParams.set(k, v))
    const response = await jsonRequest(u)
    const page = Object.values(response?.query?.pages || {})[0]
    if (page?.extract) {
      const cleaned = String(page.extract).replace(/\s+/g, ' ').trim()
      summary = cleaned.length > MAX_TEXT ? `${cleaned.slice(0, MAX_TEXT).replace(/\s+\S*$/, '')}…` : cleaned
    }
  }
  const countryId = entityId(item, 'P495') || entityId(item, 'P17')
  const regionId = entityId(item, 'P131')
  const places = await entities([countryId, regionId])
  const country = places[countryId]
  const region = places[regionId]
  const iso3 = stringClaim(country, 'P298').toUpperCase()
  const origin = country?.labels?.en?.value && /^[A-Z]{3}$/.test(iso3)
    ? {
        country: { name: country.labels.en.value, iso3, wikidataId: countryId },
        region: region?.labels?.en?.value ? { name: region.labels.en.value, wikidataId: regionId } : null,
      }
    : null
  const result = {
    wikidataId: candidates[0].id,
    wikipediaTitle: enwiki,
    summary,
    aliases: (item.aliases?.en || []).map(row => safeWord(row.value, 80)).filter(Boolean).slice(0, 8),
    origin,
    image: await licensedCommonsImage(stringClaim(item, 'P18')),
    source: { name: 'Wikidata', url: `https://www.wikidata.org/wiki/${candidates[0].id}` },
    article: enwiki ? { name: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.replace(/ /g, '_'))}` } : null,
  }
  return cacheMemo(key, result, 7 * DAY)
}

async function publishedDishesForIngredient(canonicalIngredientId) {
  if (!canonicalIngredientId) return []
  const rows = await RecipeIngredient.find({ canonicalIngredientId }).select('recipeVersionId').limit(220).lean()
  const ids = [...new Set(rows.map(row => String(row.recipeVersionId)).filter(Boolean))]
  if (!ids.length) return []
  const now = new Date()
  const versions = await RecipeVersion.find({
    _id: { $in: ids }, status: 'published', effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }],
  }).select('_id dishId').sort({ effectiveFrom: -1 }).limit(50).lean()
  if (!versions.length) return []
  const dishes = await Dish.find({
    _id: { $in: versions.map(v => v.dishId) }, status: 'active',
  }).select('_id slug name').lean()
  const dishMap = new Map(dishes.map(dish => [String(dish._id), dish]))
  const results = []
  const used = new Set()
  // getPublicRecipe enforces the existing published-version and chef outlet gates.
  for (const version of versions.slice(0, 30)) {
    const dish = dishMap.get(String(version.dishId))
    if (!dish || used.has(String(dish._id))) continue
    try {
      const published = await getPublicRecipe(dish.slug)
      if (String(published?.recipe?.id) !== String(version._id)) continue
      used.add(String(dish._id))
      results.push({ dish: published.dish, recipe: published.recipe, path: `/recipes/${published.dish.slug}` })
      if (results.length === 8) break
    } catch { /* Never disclose unpublished or ineligible recipes. */ }
  }
  return results
}

async function approvedHostDishesForIngredient(canonicalId) {
  if (!canonicalId) return []
  const listings = await HostUnifiedListingPacket.find({
    status: 'approved',
    type: { $in: ['brand_recipe', 'kitchen_recipe', 'prepared_food'] },
    'packet.ingredients.canonicalIngredientId': String(canonicalId),
  }).select('_id title publicSlug type packet.images packet.category packet.shareRecipe packet.countryOfOrigin packet.regionOfOrigin').sort({ approvedAt: -1 }).limit(10).lean()
  return listings.filter(row => row.type === 'prepared_food' || row.packet?.shareRecipe).slice(0, 8).map(row => ({
    id: String(row._id),
    name: row.title,
    imageUrl: media(row.packet?.images?.[0]),
    category: safeWord(row.packet?.category, 60),
    path: `/recipes/${publicHostSlug(row)}`,
  }))
}

// Cooking locations are NOT assertions about an ingredient's botanical origin.
// Expose only Host-declared places on approved public recipes that use this
// exact canonical ingredient, separately labelled from verified origins.
async function approvedDishLocations(canonicalId) {
  if (!canonicalId) return []
  const rows = await HostUnifiedListingPacket.find({
    status: 'approved',
    type: { $in: ['brand_recipe', 'kitchen_recipe', 'prepared_food'] },
    'packet.ingredients.canonicalIngredientId': String(canonicalId),
    'packet.countryOfOrigin': { $exists: true, $ne: '' },
  }).select('title publicSlug packet.images packet.countryOfOrigin packet.regionOfOrigin packet.shareRecipe type').limit(60).lean()
  const seen = new Set()
  return rows.filter(row => row.type === 'prepared_food' || row.packet?.shareRecipe).map(row => {
    const name = safeWord(row.packet?.countryOfOrigin, 90)
    const region = safeWord(row.packet?.regionOfOrigin, 90)
    if (!name || !/^[\p{L} .,&()'-]{2,90}$/u.test(name) || (region && !/^[\p{L} .,&()'-]{2,90}$/u.test(region))) return null
    return {
      name, iso3: '', region, imageUrl: media(row.packet?.images?.[0]),
      description: `Location of an EPANTRY-published dish`,
      sourceUrl: '',
    }
  }).filter(place => {
    if (!place) return false
    const key = `${norm(place.name)}:${norm(place.region)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
}

async function approvedHostIngredientImage(canonicalId, listingId, name) {
  const findPhoto = (records) => {
    for (const record of records) {
      const matched = (record?.packet?.ingredients || []).find(item =>
        ((canonicalId && String(item.canonicalIngredientId) === String(canonicalId)) ||
          (!canonicalId && norm(item.name) === norm(name))) && media(item.imageUrl),
      )
      if (matched) return media(matched.imageUrl)
    }
    return ''
  }

  if (OBJECT_ID.test(String(listingId || ''))) {
    const current = await HostUnifiedListingPacket.findOne({
      _id: listingId, status: 'approved',
    }).select('packet.ingredients').lean()
    const selectedPhoto = findPhoto([current])
    if (selectedPhoto) return selectedPhoto
  }

  // Recipe Detail opens the Atlas without a Host listingId. Look for an
  // approved photo from any Host packet linked to the SAME canonical ID.
  if (canonicalId) {
    const approved = await HostUnifiedListingPacket.find({
      status: 'approved',
      'packet.ingredients.canonicalIngredientId': String(canonicalId),
    }).select('packet.ingredients').sort({ approvedAt: -1 }).limit(12).lean()
    return findPhoto(approved)
  }
  return ''
}

// Only evidence-backed catalog places are displayed. Origin is not a
// worldwide popularity measure, and Host listings never supply this claim.
function verifiedCatalogPlace(attributes = {}) {
  const geo = attributes.origin || attributes.geography || {}
  const verified = geo.verified === true ||
    ['verified', 'approved'].includes(String(geo.evidenceState || '').toLowerCase())
  const countryName = safeWord(geo.country?.name || geo.countryName || '', 100)
  const countryCode = safeWord(geo.country?.iso3 || geo.iso3 || '', 3).toUpperCase()
  if (!verified || !countryName || !/^[A-Z]{3}$/.test(countryCode)) return null
  return {
    name: countryName,
    iso3: countryCode,
    region: safeWord(geo.region?.name || geo.regionName || '', 100),
    imageUrl: media(geo.imageUrl),
    description: 'Verified EPANTRY catalog origin',
    sourceUrl: media(geo.sourceUrl),
  }
}

function uniqueLocations(origin, varieties, ingredientPlace) {
  const places = []
  if (origin?.country?.name) {
    places.push({
      name: safeWord(origin.country.name, 100),
      iso3: safeWord(origin.country.iso3, 3),
      region: safeWord(origin.region?.name, 100),
      description: 'Documented ingredient origin · Wikidata',
      sourceUrl: /^Q\d+$/.test(origin.country.wikidataId || '')
        ? `https://www.wikidata.org/wiki/${origin.country.wikidataId}` : '',
      imageUrl: '',
    })
  }
  if (ingredientPlace) places.push(ingredientPlace)
  for (const variety of varieties) {
    if (variety.place) places.push(variety.place)
  }
  const seen = new Set()
  return places.filter(place => {
    const key = `${place.iso3 || norm(place.name)}:${norm(place.region)}`
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
}

async function approvedIngredientProducts(ingredient, varieties) {
  if (!ingredient) return []
  const linkedIds = [ingredient._id, ...varieties.map(row => row._id)].map(String)
  // Grocery packets currently use the same approved-host workflow, and may
  // not carry a canonicalIngredientId for single-ingredient grocery items.
  // In that case accept ONLY an exact approved listing title match.
  const exactNames = [ingredient.canonicalName, ...(ingredient.aliases || []),
    ...varieties.map(row => row.canonicalName)]
    .map(value => safeWord(value, 140)).filter(value => value.length >= 3)
    .slice(0, 20)
  const exactTitle = exactNames.map(value => new RegExp(
    `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i',
  ))
  const rows = await HostUnifiedListingPacket.find({
    status: 'approved', type: 'grocery',
    $or: [
      { 'packet.canonicalIngredientId': { $in: linkedIds } },
      { 'packet.ingredientId': { $in: linkedIds } },
      { 'packet.ingredients.canonicalIngredientId': { $in: linkedIds } },
      { title: { $in: exactTitle } },
      { 'packet.productFamily': { $in: exactTitle } },
    ],
  }).select('_id title publicSlug packet.category packet.grocerySubcategory packet.images packet.brandName packet.ingredients')
    .sort({ approvedAt: -1 }).limit(18).lean()
  return rows.map(row => ({
    id: String(row._id),
    name: safeWord(row.title, 180),
    category: safeWord(row.packet?.grocerySubcategory || row.packet?.category, 80),
    brand: safeWord(row.packet?.brandName, 100),
    imageUrl: media(row.packet?.images?.[0]),
    path: `/grocery/product/${publicHostSlug(row)}`,
  }))
}

export async function getIngredientKnowledge(rawKey, { listingId = '' } = {}) {
  const key = safeWord(rawKey, 100)
  if (!key || key.length > 100 || /[/\\?#]/.test(key)) throw new ApiError(400, 'Invalid ingredient reference.')
  let ingredient = null
  if (OBJECT_ID.test(key)) {
    ingredient = await CanonicalIngredient.findOne({ _id: key, status: 'active' }).lean()
    if (!ingredient) throw new ApiError(404, 'Ingredient information is not available.')
  } else {
    const regex = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    ingredient = await CanonicalIngredient.findOne({ status: 'active', $or: [{ slug: key.toLowerCase() }, { canonicalName: regex }, { aliases: regex }] }).lean()
  }
  const name = safeWord(ingredient?.canonicalName || key, 160)
  const lookupFacts = async () => {
    const terms = [name, ...(ingredient?.aliases || [])]
      .map(readableSearchName).filter(Boolean)
    for (const term of [...new Set(terms.map(value => value.toLowerCase()))].slice(0, 4)) {
      const result = await encyclopedia(term)
      if (result) return result
    }
    return null
  }
  const [facts, relatedRecipes, relatedHostDishes, varieties, hostImage, dishLocations] = await Promise.all([
    lookupFacts(),
    ingredient ? publishedDishesForIngredient(ingredient._id) : Promise.resolve([]),
    ingredient ? approvedHostDishesForIngredient(ingredient._id) : Promise.resolve([]),
    ingredient ? CanonicalIngredient.find({ parentId: ingredient._id, status: 'active' })
      .select('_id slug canonicalName attributes').sort({ canonicalName: 1 }).limit(24).lean() : Promise.resolve([]),
    approvedHostIngredientImage(ingredient?._id, listingId, name),
    approvedDishLocations(ingredient?._id),
  ])
  const origin = facts?.origin || null
  const topProducts = await approvedIngredientProducts(ingredient, varieties)
  const varietyRows = varieties.map(row => {
    const place = verifiedCatalogPlace(row.attributes)
    return {
      id: String(row._id), name: row.canonicalName, slug: row.slug,
      imageUrl: media(row.attributes?.approvedImageUrl),
      country: place?.name || '', region: place?.region || '',
      place,
    }
  })
  const documentedLocations = uniqueLocations(origin, varietyRows, verifiedCatalogPlace(ingredient?.attributes))
  const seenLocations = new Set(documentedLocations.map(place => `${norm(place.name)}:${norm(place.region)}`))
  const topLocations = [...documentedLocations, ...dishLocations.filter(place => {
    const key = `${norm(place.name)}:${norm(place.region)}`
    if (seenLocations.has(key)) return false
    seenLocations.add(key)
    return true
  })].slice(0, 12)
  // Existing canonical approved media may be reused; never manufacture a photo.
  const canonicalImage = media(ingredient?.attributes?.approvedImageUrl)
  const commonsImage = facts?.image || null
  const displayImage = hostImage || canonicalImage || commonsImage?.imageUrl || ''
  return {
    identity: {
      id: ingredient ? String(ingredient._id) : null,
      name,
      displayName: readableSearchName(name) || name,
      slug: ingredient?.slug || '',
      imageUrl: displayImage,
      imageSource: hostImage ? 'Approved EPANTRY Host listing' : canonicalImage ? 'EPANTRY catalog' : commonsImage ? 'Wikimedia Commons' : '',
      imageCredit: commonsImage && displayImage === commonsImage.imageUrl ? commonsImage.artist : '',
      imageLicense: commonsImage && displayImage === commonsImage.imageUrl ? commonsImage.license : '',
      imageCreditUrl: commonsImage && displayImage === commonsImage.imageUrl ? commonsImage.sourceUrl : '',
      aliases: [...new Set([...(ingredient?.aliases || []), ...(facts?.aliases || [])].map(item => safeWord(item, 80)).filter(Boolean))].slice(0, 12),
      catalogMatched: Boolean(ingredient),
    },
    overview: facts?.summary || '',
    origin, map: null,
    topLocations,
    varieties: varietyRows.map(({ place, ...publicVariety }) => publicVariety),
    topProducts,
    relatedRecipes,
    relatedHostDishes,
    sources: [facts?.source, facts?.article].filter(Boolean),
    dataNotice: 'Geography and descriptions are shown only where documented. EPANTRY recipes are published records, not worldwide rankings.',
  }
}
