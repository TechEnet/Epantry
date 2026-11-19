import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  ChevronDown,
  ChefHat,
  Clock3,
  Coffee,
  GlassWater,
  Globe2,
  MapPin,
  Menu,
  Search,
  X,
} from 'lucide-react'
import { listPublicRecipes } from '../../recipes/services/recipe.service'
import { listPublicHostListings } from '../../host/services/hostUnifiedListing.service'
import { hostDetailPath } from '../../host/services/approvedHostDetail.adapter'
import { publicImageProps } from '../../../lib/publicMediaDelivery'

const PAGE_LIMIT = 50 // Public /recipes API accepts 1–50.
const EMPTY_FILTERS = {
  origin: 'all',
  diet: 'all',
  time: 'all',
  source: 'all',
  sort: 'recommended',
}

const DRINK_TERMS = [
  'drink', 'beverage', 'mocktail', 'cocktail', 'smoothie', 'milkshake',
  'shake', 'juice', 'lemonade', 'lassi', 'sherbet', 'sharbat', 'coffee',
  'latte', 'espresso', 'cappuccino', 'matcha', 'tea', 'chai', 'hot chocolate',
  'iced tea', 'cooler', 'frappe', 'soda', 'kombucha',
]
const SWEET_TERMS = [
  'dessert', 'sweet', 'mithai', 'pastry', 'cake', 'cupcake', 'brownie',
  'pudding', 'mousse', 'custard', 'tart', 'cheesecake', 'cookie', 'biscuit',
  'macaron', 'macaroon', 'baklava', 'halwa', 'kheer', 'rabri', 'rasmalai',
  'gulab jamun', 'jalebi', 'laddu', 'ladoo', 'barfi', 'burfi', 'payasam',
  'ice cream', 'gelato', 'sorbet', 'kulfi', 'trifle', 'fudge', 'doughnut',
  'donut', 'churro', 'tiramisu',
]

function clean(value) {
  return String(value ?? '').trim()
}
function normalized(value) {
  return clean(value).toLowerCase().replace(/[_/-]+/g, ' ').replace(/\s+/g, ' ')
}
function matchesTerms(value, terms) {
  const source = ` ${normalized(value)} `
  return terms.some((term) => source.includes(` ${term} `))
}
function fields(value) {
  return (Array.isArray(value) ? value : [value])
    .filter((item) => typeof item === 'string' || typeof item === 'number')
    .map(clean).filter(Boolean)
}
function firstText(...values) {
  return values.map(clean).find(Boolean) || ''
}
function positiveMinutes(...values) {
  for (const value of values) {
    if (value === null || value === undefined || clean(value) === '') continue
    const minutes = Number(value)
    if (Number.isFinite(minutes) && minutes > 0) return Math.round(minutes)
  }
  return null
}
function kindFromRecord(type) {
  const value = normalized(type)
  if (['vegetarian', 'vegan', 'veg'].includes(value)) return 'veg'
  if (['non vegetarian', 'non veg', 'nonveg', 'eggitarian'].includes(value)) return 'nonveg'
  return 'unknown'
}
function recipeDiet(record) {
  const explicit = firstText(
    record?.dish?.dietaryType, record?.recipe?.dietaryType,
    record?.dish?.dietaryClassification, record?.recipe?.dietaryClassification,
  )
  if (explicit) return kindFromRecord(explicit)
  const tags = [
    ...fields(record?.dish?.tags), ...fields(record?.recipe?.tags),
  ].map(normalized)
  if (tags.some((tag) => ['nonveg', 'non vegetarian', 'non veg', 'eggitarian'].includes(tag))) return 'nonveg'
  if (tags.some((tag) => ['veg', 'vegetarian', 'vegan'].includes(tag))) return 'veg'
  return 'unknown'
}
function categoryFromRecord(metadata, title) {
  // Prefer governed category/course tags. Fall back only to exact food/drink
  // terms in the title, rather than pretending the API has a new taxonomy.
  const category = metadata.join(' ')
  if (matchesTerms(category, SWEET_TERMS)) return 'sweets'
  if (matchesTerms(category, DRINK_TERMS)) return 'drinks'
  if (matchesTerms(title, SWEET_TERMS)) return 'sweets'
  if (matchesTerms(title, DRINK_TERMS)) return 'drinks'
  return null
}
function recipeItem(record, index) {
  const dish = record?.dish || {}
  const recipe = record?.recipe || {}
  const title = firstText(dish.name, recipe.title)
  const meta = [
    ...fields(dish.course), ...fields(recipe.course),
    ...fields(dish.category), ...fields(recipe.category),
    ...fields(dish.mealType), ...fields(recipe.mealType),
    ...fields(dish.tags), ...fields(recipe.tags),
  ]
  const type = categoryFromRecord(meta, title)
  if (!title || !type) return null
  const slug = firstText(dish.slug, recipe.slug)
  if (!slug) return null
  return {
    id: `recipe:${firstText(dish.id, recipe.id, slug)}`,
    title,
    type,
    path: `/recipes/${encodeURIComponent(slug)}`,
    image: firstText(dish.heroImageUrl, recipe.heroImageUrl),
    cuisine: firstText(dish.cuisine, recipe.cuisine),
    origin: firstText(dish.countryOfOrigin, dish.originCountry, dish.origin?.country, dish.country,
      recipe.countryOfOrigin, recipe.originCountry, recipe.origin?.country, recipe.country),
    time: positiveMinutes(recipe.cookingTimeMinutes, dish.cookingTimeMinutes),
    diet: recipeDiet(record),
    source: 'epantry',
    date: firstText(recipe.publishedAt, dish.publishedAt, recipe.createdAt, dish.createdAt),
    index,
  }
}
function hostItem(listing, index) {
  if (listing?.type === 'grocery') return null
  const title = firstText(listing?.title, listing?.name)
  const meta = [
    ...fields(listing?.category), ...fields(listing?.subcategory),
    ...fields(listing?.course), ...fields(listing?.tags), ...fields(listing?.type),
  ]
  const type = categoryFromRecord(meta, title)
  if (!title || !type) return null
  return {
    id: `host:${firstText(listing.id, listing.slug, title)}`,
    title,
    type,
    path: hostDetailPath(listing),
    image: typeof listing?.images?.[0] === 'string'
      ? listing.images[0] : firstText(listing?.images?.[0]?.url, listing?.imageUrl),
    cuisine: firstText(listing?.cuisine),
    origin: firstText(listing?.countryOfOrigin, listing?.originCountry, listing?.origin?.country,
      listing?.country, listing?.recipe?.countryOfOrigin),
    time: positiveMinutes(listing?.cookingMinutes, listing?.recipe?.cookingMinutes,
      listing?.recipe?.cookingTimeMinutes),
    diet: kindFromRecord(listing?.dietary),
    source: 'host',
    date: firstText(listing?.publishedAt, listing?.createdAt),
    index,
  }
}
function durationLabel(minutes) {
  if (minutes == null) return ''
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours} hr${rest ? ` ${rest} min` : ''}`
}
function Dropdown({ label, value, onChange, options }) {
  return (
    <label className="bev-filter-field">
      <span>{label}</span>
      <span className="bev-filter-select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
    </label>
  )
}
function BevCard({ item }) {
  return (
    <article className="bev-card">
      <Link to={item.path} className="bev-card-link" aria-label={`View ${item.title}`}>
        <div className="bev-card-photo">
          {item.image ? (
            <img src={item.image} {...publicImageProps(item.image, {
              widths: [240, 360, 480, 720],
              sizes: '(max-width: 700px) 45vw, (max-width: 1100px) 29vw, 19vw',
            })} alt={item.title} loading="lazy" />
          ) : (
            <span className="bev-card-no-photo"><ChefHat size={28} aria-hidden="true" /> Photo unavailable</span>
          )}
          {item.diet !== 'unknown' && (
            <span className={`bev-diet ${item.diet === 'veg' ? 'is-veg' : 'is-nonveg'}`}
              aria-label={item.diet === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
              title={item.diet === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} />
          )}
        </div>
        <div className="bev-card-body">
          <div className="bev-card-meta">
            {item.origin ? (
              <span title={item.origin}><MapPin size={13} aria-hidden="true" />{item.origin}</span>
            ) : item.cuisine ? (
              <span title={`Cuisine: ${item.cuisine}`}><Globe2 size={13} aria-hidden="true" />{item.cuisine}</span>
            ) : null}
            {item.time != null && (
              <span title="Cooking time"><Clock3 size={13} aria-hidden="true" />{durationLabel(item.time)}</span>
            )}
          </div>
          <h4>{item.title}</h4>
          <div className="bev-card-foot">
            <span>View recipe</span>
            <span className="bev-card-action" aria-hidden="true"><ArrowRight size={16} /></span>
          </div>
        </div>
      </Link>
    </article>
  )
}


function filterRecords(records, query, type, filters) {
  const search = normalized(query)
  const selected = records.filter((item) => {
    if (type !== 'all' && type !== item.type) return false
    if (search && !normalized(`${item.title} ${item.cuisine} ${item.origin}`).includes(search)) return false
    if (filters.origin !== 'all' && (item.origin || item.cuisine) !== filters.origin) return false
    if (filters.diet !== 'all' && item.diet !== filters.diet) return false
    if (filters.source !== 'all' && item.source !== filters.source) return false
    if (filters.time === '15' && !(item.time != null && item.time <= 15)) return false
    if (filters.time === '30' && !(item.time != null && item.time <= 30)) return false
    if (filters.time === '60' && !(item.time != null && item.time <= 60)) return false
    if (filters.time === 'over' && !(item.time != null && item.time > 60)) return false
    return true
  })
  if (filters.sort === 'az') return selected.sort((a, b) => a.title.localeCompare(b.title))
  if (filters.sort === 'time') return selected.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity))
  if (filters.sort === 'latest') return selected.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
  return selected.sort((a, b) => a.index - b.index)
}

// When All is selected, keep the two collections visible without exceeding the page limit.
function alternateCollections(items) {
  const drinks = items.filter((item) => item.type === 'drinks')
  const sweets = items.filter((item) => item.type === 'sweets')
  const ordered = []
  for (let index = 0; index < Math.max(drinks.length, sweets.length); index += 1) {
    if (drinks[index]) ordered.push(drinks[index])
    if (sweets[index]) ordered.push(sweets[index])
  }
  return ordered
}

export default function BeveragesPage() {
  const [recipes, setRecipes] = useState([])
  const [hostListings, setHostListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [type, setType] = useState('drinks')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches)
  const [visibleCount, setVisibleCount] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches ? 6 : 12)
  const resultsRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)')
    const onChange = () => {
      setIsMobile(media.matches)
      setVisibleCount(media.matches ? 6 : 12)
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      const [recipeResult, hostResult] = await Promise.allSettled([
        listPublicRecipes({ page: 1, limit: PAGE_LIMIT, sourceScope: 'all' }),
        listPublicHostListings(),
      ])
      if (!active) return
      if (recipeResult.status === 'fulfilled') {
        const data = recipeResult.value
        const rows = Array.isArray(data?.recipes) ? data.recipes : []
        setRecipes(rows)
        const pages = Number(data?.pagination?.pages)
        setHasMore(Number.isFinite(pages) ? pages > 1 : rows.length === PAGE_LIMIT)
      } else {
        setError('Recipe listings could not be loaded. Please retry.')
      }
      if (hostResult.status === 'fulfilled') {
        setHostListings(Array.isArray(hostResult.value?.listings) ? hostResult.value.listings : [])
      } else if (recipeResult.status !== 'fulfilled') {
        setError('Beverages are temporarily unavailable. Please try again.')
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!drawerOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    function onKey(event) { if (event.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const records = useMemo(() => {
    const mapped = [
      ...recipes.map((item, index) => recipeItem(item, index)),
      ...hostListings.map((item, index) => hostItem(item, recipes.length + index)),
    ].filter(Boolean)
    const used = new Set()
    return mapped.filter((item) => {
      if (used.has(item.id)) return false
      used.add(item.id)
      return true
    })
  }, [recipes, hostListings])

  const originOptions = useMemo(() => [...new Set(records.map((item) => item.origin || item.cuisine).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [records])

  const displayed = useMemo(() => filterRecords(records, query, type, filters),
    [records, query, type, filters])
  const ordered = type === 'all' ? alternateCollections(displayed) : displayed
  const visible = ordered.slice(0, visibleCount)
  const groups = type === 'all'
    ? [
        { id: 'drinks', items: visible.filter((item) => item.type === 'drinks') },
        { id: 'sweets', items: visible.filter((item) => item.type === 'sweets') },
      ]
    : [{ id: type, items: visible }]

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => value !== EMPTY_FILTERS[key]).length

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
    setVisibleCount(isMobile ? 6 : 12)
  }
  function chooseType(nextType, shouldScroll = true) {
    setType(nextType)
    setVisibleCount(isMobile ? 6 : 12)
    if (shouldScroll) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  async function revealMore() {
    if (loadingMore) return
    const target = visibleCount + (isMobile ? 4 : 8)
    setVisibleCount(target)
    if (!hasMore || displayed.length >= target) return
    setLoadingMore(true)
    let nextPage = page
    let nextHasMore = hasMore
    const addedRows = []
    let failure = false
    try {
      // Fetch additional published pages when currently loaded recipes cannot
      // satisfy the requested count; no dummy or duplicated cards are added.
      for (let round = 0; round < 12 && nextHasMore; round += 1) {
        const data = await listPublicRecipes({ page: nextPage + 1, limit: PAGE_LIMIT, sourceScope: 'all' })
        const rows = Array.isArray(data?.recipes) ? data.recipes : []
        addedRows.push(...rows)
        nextPage += 1
        const pages = Number(data?.pagination?.pages)
        nextHasMore = Number.isFinite(pages) ? nextPage < pages : rows.length === PAGE_LIMIT
        const candidateRecords = [
          ...recipes.concat(addedRows).map((item, index) => recipeItem(item, index)),
          ...hostListings.map((item, index) => hostItem(item, recipes.length + addedRows.length + index)),
        ].filter(Boolean)
        if (filterRecords(candidateRecords, query, type, filters).length >= target) break
      }
    } catch {
      failure = true
    }
    if (addedRows.length) setRecipes((current) => [...current, ...addedRows])
    setPage(nextPage)
    setHasMore(nextHasMore)
    if (failure) setError('Could not load more recipes. Please try again.')
    setLoadingMore(false)
  }

  return (
    <main className="bev-page">
      <style>{`
        .bev-page{--ink:#133D33;--muted:#547369;--clay:#BC6546;--line:#DDE4DC;color:var(--ink);background:#F7F6F1;min-height:100svh;font-family:inherit;overflow-x:clip}
        .bev-page *,.bev-page *::before,.bev-page *::after{box-sizing:border-box}
        .bev-page button,.bev-page input,.bev-page select{font-family:inherit}
        .bev-wrap{width:min(calc(100% - 72px),1540px);margin:0 auto}
        .bev-hero{padding:27px 0 18px;background:#F7F6F1}
        .bev-stage{position:relative;height:clamp(345px,32vw,470px);isolation:isolate;overflow:hidden;border-radius:19px;background:#DBEDE6}
        .bev-stage-picture,.bev-stage-picture img{position:absolute;inset:0;width:100%;height:100%;display:block}
        .bev-stage-picture img{object-fit:cover;object-position:center 58%}
        .bev-stage::after{content:'';position:absolute;inset:0;z-index:0;background:linear-gradient(90deg,rgba(226,242,233,.98) 0%,rgba(231,241,233,.94) 19%,rgba(231,241,233,.81) 36%,rgba(231,241,233,.18) 56%,transparent 72%);pointer-events:none}
        .bev-stage-copy{position:absolute;z-index:1;left:clamp(27px,4.2vw,72px);top:50%;transform:translateY(-50%);width:min(49%,560px);color:var(--ink)}
        .bev-overline{display:flex;align-items:center;gap:9px;font-weight:800;text-transform:uppercase;letter-spacing:.17em;font-size:12px;color:#A95A40}
        .bev-overline:before{content:'';width:27px;height:2px;background:#BC6546}
        .bev-stage-copy h1{font-size:clamp(54px,5.7vw,88px);letter-spacing:-.075em;line-height:.99;font-weight:800;margin:17px 0 25px;color:var(--ink)}
        .bev-stage-copy h1 em{font-style:normal;color:var(--clay)}
        .bev-stage-actions{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
        .bev-stage-action{min-height:46px;display:inline-flex;justify-content:center;align-items:center;gap:13px;padding:10px 19px;border-radius:999px;border:1px solid var(--ink);font-size:14px;font-weight:800;color:var(--ink);background:rgba(255,255,255,.68);cursor:pointer;transition:background .2s,transform .2s}
        .bev-stage-action:first-child{background:var(--ink);color:#FFF}
        .bev-stage-action:hover{transform:translateY(-2px);background:#DCEDE3;color:var(--ink)}
        .bev-stage-action:focus-visible,.bev-type-tab:focus-visible,.bev-filters-button:focus-visible,.bev-more:focus-visible{outline:3px solid #BC6546;outline-offset:3px}
        .bev-stage-footer{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #DAE2D8;padding:13px 2px 16px;gap:15px;color:#466B5E;font-size:13px;font-weight:700}
        .bev-stage-footer .bev-stage-trail{color:#B76143;font-weight:800;letter-spacing:.07em;text-transform:uppercase;font-size:11px}
        .bev-catalog{padding:25px 0 67px}
        .bev-toolbar{display:flex;align-items:center;gap:14px;padding:0 0 23px;flex-wrap:wrap}
        .bev-toolbar-head{margin-right:auto;font-size:clamp(23px,2.2vw,34px);font-weight:800;letter-spacing:-.055em;line-height:1.1}
        .bev-type-tabs{display:flex;align-items:center;gap:4px;border-radius:999px;background:#E7EEE7;padding:4px}
        .bev-type-tab{border:0;border-radius:999px;min-height:36px;cursor:pointer;padding:7px 17px;background:transparent;color:#345D49;font-size:14px;font-weight:750;transition:background .2s}
        .bev-type-tab.active{color:white;background:var(--ink);box-shadow:0 4px 12px #133d3328}
        .bev-type-tab:not(.active):hover{background:#D2E4D6}
        .bev-search{display:flex;align-items:center;gap:8px;min-width:0;width:clamp(180px,19vw,280px);height:44px;border:1px solid #D2DED4;border-radius:10px;background:white;color:#678277;padding:0 13px}
        .bev-search input{min-width:0;width:100%;border:0;outline:0;font-size:14px;color:var(--ink);background:transparent}
        .bev-filters-button{display:flex;align-items:center;justify-content:center;gap:9px;min-height:44px;padding:8px 16px;border:1px solid #B9D2C1;background:#DBEBDD;color:var(--ink);border-radius:10px;cursor:pointer;font-size:14px;font-weight:800;transition:background .2s}
        .bev-filters-button:hover{background:#C5E3D0}
        .bev-filter-count{background:#BD694C;border-radius:50%;min-width:20px;height:20px;display:grid;place-items:center;color:white;font-size:11px}
        .bev-shelf{position:relative;margin:0 0 17px;padding:32px clamp(22px,3vw,44px);display:grid;grid-template-columns:minmax(165px,23%) minmax(0,1fr);gap:clamp(18px,2.7vw,44px);background:#E8F1E8;border-radius:17px;overflow:hidden;align-items:center}
        .bev-shelf[data-kind=sweets]{background:#F8E8E0}
        .bev-shelf-title{align-self:start;padding-top:3px}
        .bev-shelf-index{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:850;letter-spacing:.13em;color:#B55F42;text-transform:uppercase}
        .bev-shelf-index:before{content:'';width:23px;height:2px;background:currentColor}
        .bev-shelf-title h2{margin:18px 0 8px;letter-spacing:-.062em;font-weight:800;font-size:clamp(31px,3vw,52px);line-height:1.02}
        .bev-shelf-accent{width:42px;height:3px;background:#B86245;margin-top:20px;border-radius:3px}
        .bev-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px;min-width:0}
        .bev-card{min-width:0;border-radius:13px;overflow:hidden;background:#FEFFFC;box-shadow:0 3px 15px rgba(37,71,49,.07);transition:box-shadow .25s,transform .25s}
        .bev-card:hover{box-shadow:0 12px 25px rgba(34,72,53,.16);transform:translateY(-3px)}
        .bev-card-link{height:100%;display:flex;flex-direction:column;text-decoration:none;color:inherit}
        .bev-card-photo{height:168px;position:relative;overflow:hidden;background:#D6E2D9}
        .bev-card-photo img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .4s}.bev-card:hover img{transform:scale(1.045)}
        .bev-card-no-photo{height:100%;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;color:#648075}
        .bev-diet{position:absolute;top:11px;right:11px;background:#fff;border:2px solid #1B9358;width:19px;height:19px;border-radius:4px;display:grid;place-items:center;box-shadow:0 2px 7px #0002}
        .bev-diet:after{content:'';width:9px;height:9px;border-radius:50%;background:#1B9358}.bev-diet.is-nonveg{border-color:#B64F42}.bev-diet.is-nonveg:after{background:#B64F42}
        .bev-card-body{padding:15px 18px 17px;display:flex;flex-direction:column;gap:9px;min-height:133px;flex:1}
        .bev-card-origin{color:#9C654E;font-size:12px;font-weight:800;letter-spacing:.04em}
        .bev-card h4{font-size:clamp(17px,1.45vw,23px);line-height:1.17;margin:0;font-weight:800;letter-spacing:-.045em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
        .bev-card-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:750;color:#577467}
        .bev-card-foot>span:first-child{display:flex;align-items:center;gap:6px}
        .bev-card-action{width:34px;height:34px;background:#DBEADB;display:grid;place-items:center;border-radius:50%;color:var(--ink);flex:none}
        .bev-shelf[data-kind=sweets] .bev-card-action{background:#F7DACE}
        .bev-gallery.is-solo{grid-template-columns:1fr}
        .bev-gallery.is-solo .bev-card{height:252px}
        .bev-gallery.is-solo .bev-card-link{display:grid;grid-template-columns:minmax(0,47%) minmax(0,1fr)}
        .bev-gallery.is-solo .bev-card-photo{height:100%;width:100%}
        .bev-gallery.is-solo .bev-card-body{padding:clamp(17px,2.4vw,31px);justify-content:center;min-height:0}
        .bev-gallery.is-solo .bev-card h4{font-size:clamp(23px,2.6vw,39px);-webkit-line-clamp:4}
        .bev-gallery.is-solo .bev-card-action{width:39px;height:39px}
        .bev-gallery.is-solo .bev-card-foot{margin-top:22px}
        .bev-more-actions{display:flex;justify-content:center;gap:11px;flex-wrap:wrap;margin-top:24px}
        .bev-more{border:1px solid #B6CBB9;border-radius:999px;background:white;padding:11px 20px;color:var(--ink);font-size:14px;font-weight:800;cursor:pointer}
        .bev-more:hover{background:#E4EEE6}.bev-more:disabled{opacity:.5;cursor:wait}
        .bev-empty{padding:50px 18px;text-align:center;max-width:640px;margin:auto;color:#57776A}.bev-empty svg{margin:auto}.bev-empty h3{font-size:22px;color:var(--ink);margin:12px 0 8px}.bev-empty p{margin:0 0 17px}
        .bev-error{margin:14px 0;color:#9D4D37;font-size:14px}
        .bev-clear{border:1px solid #B7CDBB;border-radius:9px;background:#FFF;padding:10px 16px;color:var(--ink);font-weight:750;cursor:pointer}
        .bev-overlay{position:fixed;inset:0;z-index:10020;background:rgba(18,44,35,.45);backdrop-filter:blur(6px);display:flex;justify-content:flex-end}
        .bev-filter-panel{width:min(100%,430px);height:100%;background:#F7F7F3;box-shadow:-12px 0 45px #173F3540;display:flex;flex-direction:column;overflow:hidden;color:var(--ink)}
        .bev-panel-header{padding:25px 24px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #D8E4D9}
        .bev-panel-header h2{margin:0;font-size:29px;line-height:1.15;letter-spacing:-.05em}.bev-panel-close{display:grid;place-items:center;width:41px;height:41px;border-radius:50%;border:1px solid #C7D9C9;background:#E5F0E5;color:var(--ink);cursor:pointer}
        .bev-panel-body{flex:1;overflow:auto;padding:22px 24px;display:flex;flex-direction:column;gap:20px}
        .bev-filter-field{display:grid;gap:8px;color:var(--ink);font-size:14px;font-weight:750}
        .bev-filter-select-wrap{display:flex;align-items:center;position:relative}.bev-filter-select-wrap select{appearance:none;border:1px solid #CBD9CB;border-radius:11px;background:#fff;min-height:47px;width:100%;color:var(--ink);padding:11px 40px 11px 12px;font-size:15px;font-family:inherit}.bev-filter-select-wrap svg{position:absolute;right:13px;pointer-events:none}
        .bev-panel-bottom{display:flex;gap:10px;padding:18px 24px;border-top:1px solid #D6E1D7}.bev-panel-bottom button{min-width:0;flex:1;border-radius:11px;min-height:44px;border:1px solid #AAC5B0;background:#fff;color:var(--ink);font-weight:800;font-size:14px;cursor:pointer}.bev-panel-bottom button:last-child{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--ink);border-color:var(--ink);color:white}
        @media(max-width:1024px){.bev-wrap{width:calc(100% - 40px)}.bev-shelf{grid-template-columns:minmax(125px,25%) minmax(0,1fr);padding:24px}.bev-gallery{grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))}.bev-toolbar-head{flex-basis:100%}.bev-stage-copy{width:50%}.bev-stage-copy h1{font-size:clamp(46px,6vw,74px)}}
        @media(max-width:700px){.bev-wrap{width:calc(100% - 26px)}.bev-hero{padding:12px 0 13px}.bev-stage{height:380px;border-radius:15px}.bev-stage-picture img{object-position:68% 65%}.bev-stage:after{background:linear-gradient(180deg,rgba(226,242,233,.98) 0%,rgba(226,242,233,.89) 25%,rgba(226,242,233,.35) 51%,rgba(226,242,233,0) 76%)}.bev-stage-copy{top:0;left:20px;right:20px;width:calc(100% - 40px);transform:none;padding-top:23px}.bev-stage-copy h1{font-size:clamp(39px,10vw,54px);margin:11px 0 16px}.bev-stage-actions{gap:7px}.bev-stage-action{min-height:40px;padding:7px 12px;font-size:13px}.bev-stage-footer{font-size:12px;padding:11px 3px 14px}.bev-catalog{padding:20px 0 45px}.bev-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding-bottom:16px}.bev-toolbar-head{grid-column:1/-1;font-size:27px}.bev-type-tabs{grid-column:1/-1;justify-self:start}.bev-search{grid-column:1;width:100%;min-width:0}.bev-filters-button{grid-column:2;padding:8px 13px}.bev-shelf{display:block;padding:20px 16px;margin-bottom:12px}.bev-shelf-title{display:flex;align-items:center;gap:10px;margin-bottom:15px;padding:0}.bev-shelf-title h2{margin:0;font-size:27px}.bev-shelf-index{font-size:10px}.bev-shelf-accent{display:none}.bev-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.bev-card-photo{height:135px}.bev-card-body{padding:12px;min-height:120px}.bev-card h4{font-size:16px}.bev-gallery.is-solo .bev-card{height:192px}.bev-gallery.is-solo .bev-card-link{grid-template-columns:44% minmax(0,1fr)}.bev-gallery.is-solo .bev-card-body{padding:13px}.bev-gallery.is-solo .bev-card h4{font-size:clamp(18px,4vw,25px)}.bev-gallery.is-solo .bev-card-foot{margin-top:10px}}
        @media(max-width:400px){.bev-stage{height:340px}.bev-stage-copy h1{font-size:39px}.bev-overline{font-size:10px}.bev-stage-footer{font-size:11px}.bev-type-tab{padding:6px 12px}.bev-search{width:100%}.bev-toolbar-head{font-size:25px}.bev-shelf{padding:17px 12px}.bev-gallery.is-solo .bev-card{height:177px}.bev-gallery.is-solo .bev-card-body{padding:11px}.bev-gallery.is-solo .bev-card h4{font-size:18px}.bev-card-photo{height:120px}.bev-card h4{font-size:15px}.bev-card-body{min-height:116px;padding:11px}}

        /* Beverages: hero selection above image; shared filter drawer stays unchanged */
        .bev-stage-picture{animation:bev-image-in .35s ease both}
        @keyframes bev-image-in{from{opacity:.72;transform:scale(1.025)}to{opacity:1;transform:scale(1)}}
        .bev-stage[data-kind="sweets"]{background:#F9E5E5}
        .bev-stage[data-kind="sweets"]::after{background:linear-gradient(90deg,rgba(252,237,233,.97) 0%,rgba(252,237,233,.93) 21%,rgba(252,237,233,.67) 37%,rgba(252,237,233,.13) 57%,transparent 73%)}
        .bev-hero-switch{position:absolute;z-index:4;top:20px;right:22px;display:flex;align-items:center;gap:3px;padding:5px;border:1px solid rgba(210,223,210,.85);border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 7px 22px #164d3824;backdrop-filter:blur(8px)}
        .bev-hero-option{border:0;border-radius:999px;background:transparent;color:#315C4C;min-height:39px;min-width:95px;padding:7px 16px;font-size:14px;font-weight:800;cursor:pointer;transition:background .2s,color .2s}
        .bev-hero-option.is-active{background:#143E33;color:white;box-shadow:0 3px 9px #133d3330}
        .bev-stage[data-kind="sweets"] .bev-hero-option.is-active{background:#AD5B47}
        .bev-hero-option:hover:not(.is-active){background:#E6F1E9}
        .bev-hero-option:focus-visible{outline:3px solid #BD694C;outline-offset:3px}
        /* Four equal, compact recipe cards in each desktop row; no special solo giant card */
        .bev-shelf{grid-template-columns:minmax(140px,17%) minmax(0,1fr);gap:20px;padding:25px 26px;align-items:start}
        .bev-shelf-title h2{font-size:clamp(28px,2.7vw,40px);margin-top:15px}
        .bev-gallery{grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;align-items:stretch}
        .bev-card{height:277px;min-height:0;border-radius:13px;overflow:hidden;border:1px solid #E0E9E0;box-shadow:0 3px 12px rgba(26,64,41,.06)}
        .bev-card-photo{height:142px;flex-shrink:0}
        .bev-card-body{min-height:0;flex:1;gap:7px;padding:11px 12px 12px}
        .bev-card-meta{display:flex;align-items:center;gap:7px 11px;flex-wrap:wrap;min-height:16px;font-size:11px;font-weight:750;line-height:1.25;color:#577466}
        .bev-card-meta span{display:inline-flex;align-items:center;gap:4px;max-width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .bev-card-meta span svg{flex:none}
        .bev-card h4{font-size:clamp(15px,1.3vw,18px);line-height:1.19;letter-spacing:-.035em;-webkit-line-clamp:3}
        .bev-card-foot{font-size:12px;margin-top:auto;min-height:29px}
        .bev-card-action{width:29px;height:29px}
        .bev-more-actions{display:flex;justify-content:center;margin:23px 0 0}
        .bev-more{min-width:160px;display:inline-flex;align-items:center;justify-content:center;gap:11px;background:#143E33;border-color:#143E33;color:#FFF;min-height:45px;box-shadow:0 5px 14px #153f3320}
        .bev-more:hover{background:#225A49;color:#FFF}
        @media(max-width:1150px) and (min-width:901px){.bev-gallery{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:900px) and (min-width:701px){.bev-shelf{grid-template-columns:1fr}.bev-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}.bev-shelf-title{display:flex;gap:12px;align-items:center}.bev-shelf-title h2{margin:0}}
        @media(max-width:700px){
          .bev-hero-switch{top:13px;right:13px;gap:2px;padding:4px}
          .bev-hero-option{min-width:69px;padding:6px 10px;min-height:34px;font-size:12px}
          .bev-stage-copy{padding-top:75px}
          .bev-stage[data-kind="sweets"]::after{background:linear-gradient(180deg,rgba(252,239,237,.96),rgba(252,239,237,.77) 33%,rgba(252,239,237,.03) 79%)}
          .bev-shelf{display:block;padding:18px 13px}
          .bev-shelf-title{display:flex;align-items:center;gap:10px;margin-bottom:14px}
          .bev-shelf-title h2{margin:0;font-size:25px}
          .bev-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
          .bev-card{height:239px}
          .bev-card-photo{height:116px}
          .bev-card-body{padding:9px 9px 10px;gap:5px}
          .bev-card-meta{font-size:10px;gap:4px 7px;min-height:14px}
          .bev-card-meta svg{width:11px;height:11px}
          .bev-card h4{font-size:14px;-webkit-line-clamp:3;line-height:1.18}
          .bev-card-foot{font-size:11px;min-height:25px}
          .bev-card-action{width:25px;height:25px}
          .bev-more{min-width:150px}
        }
        @media(max-width:400px){.bev-card{height:223px}.bev-card-photo{height:107px}.bev-card h4{font-size:13px}.bev-card-meta{font-size:9.5px}.bev-stage-copy{padding-top:66px}}

        @media(prefers-reduced-motion:reduce){.bev-page *{transition:none!important;scroll-behavior:auto!important}}
      `}</style>

      <section className="bev-hero" aria-labelledby="bev-page-heading">
        <div className="bev-wrap">
          <div className="bev-stage" data-kind={type === 'sweets' ? 'sweets' : 'drinks'}>
            <picture className="bev-stage-picture" key={type === 'sweets' ? 'desserts' : 'drinks'}>
              <source media="(max-width: 700px)"
                srcSet={type === 'sweets' ? '/banners/desserts_mobile.webp' : '/banners/drinks_studio_mobile.webp'} />
              <img src={type === 'sweets' ? '/banners/desserts_desktop.webp' : '/banners/drinks_studio_desktop.webp'}
                alt={type === 'sweets' ? 'Assorted desserts' : 'Freshly prepared colourful drinks'} />
            </picture>
            <div className="bev-stage-copy">
              <span className="bev-overline">DRINKS & DESSERTS</span>
              <h1 id="bev-page-heading">Sips <em>&</em><br />sweets.</h1>
            </div>
            <div className="bev-hero-switch" role="group" aria-label="Choose Drinks or Desserts">
              <button type="button" className={`bev-hero-option${type !== 'sweets' ? ' is-active' : ''}`}
                aria-pressed={type !== 'sweets'} onClick={() => chooseType('drinks', false)}>Drinks</button>
              <button type="button" className={`bev-hero-option${type === 'sweets' ? ' is-active' : ''}`}
                aria-pressed={type === 'sweets'} onClick={() => chooseType('sweets', false)}>Sweets</button>
            </div>
          </div>
        </div>
      </section>

      <section className="bev-catalog" id="bev-results" ref={resultsRef} aria-label="Browse drinks and desserts">
        <div className="bev-wrap">
          <div className="bev-toolbar">
            <div className="bev-toolbar-head">Pick your favourite.</div>
            <div className="bev-type-tabs" aria-label="Collection">
              {[['all', 'All'], ['drinks', 'Drinks'], ['sweets', 'Desserts']].map(([key, label]) => (
                <button key={key} type="button" className={`bev-type-tab${type === key ? ' active' : ''}`}
                  aria-pressed={type === key} onClick={() => chooseType(key)}>{label}</button>
              ))}
            </div>
            <label className="bev-search"><Search size={17} aria-hidden="true" />
              <input type="search" aria-label="Search drinks and sweet recipes" placeholder="Search recipes" value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(isMobile ? 6 : 12) }} />
            </label>
            <button type="button" className="bev-filters-button" onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} aria-controls="bev-filters">
              <Menu size={18} aria-hidden="true" /> Filters {activeFilterCount > 0 && <span className="bev-filter-count">{activeFilterCount}</span>}
            </button>
          </div>

          {error && <p className="bev-error" role="alert">{error}</p>}
          {loading ? (
            <div className="bev-empty" role="status"><GlassWater size={29} aria-hidden="true" /><h3>Loading recipes…</h3></div>
          ) : displayed.length === 0 ? (
            <div className="bev-empty"><Coffee size={30} aria-hidden="true" /><h3>No matching recipes</h3>
              <p>Try another search or filter.</p>
              <button className="bev-clear" type="button" onClick={() => { setFilters(EMPTY_FILTERS); setType('all'); setQuery(''); setVisibleCount(isMobile ? 6 : 12) }}>Clear filters</button>
            </div>
          ) : (
            <div className="bev-shelves">
              {groups.filter((group) => group.items.length > 0).map((group) => (
                <section key={group.id} data-kind={group.id} className="bev-shelf" aria-labelledby={`bev-${group.id}-title`}>
                  <div className="bev-shelf-title">
                    <span className="bev-shelf-index">{group.id === 'drinks' ? '01' : '02'}</span>
                    <h2 id={`bev-${group.id}-title`}>{group.id === 'drinks' ? 'Drinks.' : 'Desserts.'}</h2>
                    <div className="bev-shelf-accent" aria-hidden="true" />
                  </div>
                  <div className="bev-gallery">
                    {group.items.map((item) => <BevCard key={item.id} item={item} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
          {!loading && (visible.length < displayed.length || hasMore) && (
            <div className="bev-more-actions">
              <button type="button" className="bev-more" disabled={loadingMore}
                onClick={revealMore} aria-label={`View ${isMobile ? 4 : 8} more recipes`}>
                {loadingMore ? 'Loading…' : 'View all'}
                {!loadingMore && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>
      </section>

      {drawerOpen && createPortal(
        <div className="bev-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false) }}>
          <aside id="bev-filters" className="bev-filter-panel" role="dialog" aria-modal="true" aria-labelledby="bev-filter-title">
            <div className="bev-panel-header"><h2 id="bev-filter-title">Filters</h2>
              <button type="button" ref={closeRef} className="bev-panel-close" aria-label="Close filters" onClick={() => setDrawerOpen(false)}><X size={19} /></button>
            </div>
            <div className="bev-panel-body">
              <Dropdown label="Collection" value={type} onChange={chooseType} options={[{ value: 'all', label: 'All' }, { value: 'drinks', label: 'Drinks' }, { value: 'sweets', label: 'Sweets' }]} />
              <Dropdown label="Country / cuisine" value={filters.origin} onChange={(value) => setFilter('origin', value)} options={[{ value: 'all', label: 'All countries & cuisines' }, ...originOptions.map((label) => ({ value: label, label }))]} />
              <Dropdown label="Cooking time" value={filters.time} onChange={(value) => setFilter('time', value)} options={[{ value: 'all', label: 'Any time' }, { value: '15', label: '15 minutes or less' }, { value: '30', label: '30 minutes or less' }, { value: '60', label: '1 hour or less' }, { value: 'over', label: 'Over 1 hour' }]} />
              <Dropdown label="Food preference" value={filters.diet} onChange={(value) => setFilter('diet', value)} options={[{ value: 'all', label: 'All types' }, { value: 'veg', label: 'Vegetarian' }, { value: 'nonveg', label: 'Non-vegetarian' }]} />
              <Dropdown label="From" value={filters.source} onChange={(value) => setFilter('source', value)} options={[{ value: 'all', label: 'All sources' }, { value: 'epantry', label: 'EPANTRY recipes' }, { value: 'host', label: 'Host recipes' }]} />
              <Dropdown label="Sort by" value={filters.sort} onChange={(value) => setFilter('sort', value)} options={[{ value: 'recommended', label: 'Default order' }, { value: 'az', label: 'Name A to Z' }, { value: 'time', label: 'Shortest cooking time' }, { value: 'latest', label: 'Latest' }]} />
            </div>
            <div className="bev-panel-bottom">
              <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setType('all'); setVisibleCount(isMobile ? 6 : 12) }}>Reset</button>
              <button type="button" onClick={() => setDrawerOpen(false)}>Show {displayed.length} results <ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          </aside>
        </div>, document.body
      )}
    </main>
  )
}
