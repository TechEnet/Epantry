import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
  Globe2, Leaf, MapPin, Search, ShoppingBag, SlidersHorizontal, Sprout,
} from 'lucide-react'
import { getIngredientKnowledge } from '../services/ingredientKnowledge.service'
import { countryFlag, countryExplorePath } from '../../countries/utils/country.utils'

const C = {
  ink: '#173F35',
  body: '#394F45',
  muted: '#607268',
  clay: '#B65637',
  line: '#D6DED3',
  cream: '#F7F6F1',
}

// Explicit text colours on interactive elements protect the Atlas from global
// anchor/button styles. The original API, links and filter states are unchanged.
function FilterTab({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{ color: selected ? C.ink : C.body, WebkitTextFillColor: selected ? C.ink : C.body }}
      className={`inline-flex min-h-10 items-center justify-center rounded-[9px] border px-4 py-2 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] ${selected ? 'border-[#D28F73] bg-[#FFE0CF] shadow-[inset_0_-2px_0_#B65637]' : 'border-[#D1DCCF] bg-white hover:border-[#94B2A3] hover:bg-[#EEF4EC]'}`}
    >
      {children}
    </button>
  )
}

function SectionHeading({ index, eyebrow, title, count, note, end }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#D2DBD1] pb-4">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[.07em] text-[#B65637]">
          <span className="text-[14px]">{String(index).padStart(2, '0')}</span>
          <span className="h-px w-6 bg-[#C9876B]" aria-hidden="true" />
          <span>{eyebrow}</span>
        </div>
        <h2 className="text-[24px] font-bold leading-[1.2] tracking-[-.035em] text-[#173F35] sm:text-[29px]">
          {title}
          {typeof count === 'number' && count > 0 ? <span className="ml-2 align-middle text-[14px] font-semibold tracking-normal text-[#64756A]">({count})</span> : null}
        </h2>
        {note ? <p className="mt-2 max-w-[70ch] text-[15px] leading-[1.55] text-[#586E61]">{note}</p> : null}
      </div>
      {end}
    </div>
  )
}

function MediaFrame({ imageUrl, alt, icon: Icon = Leaf, tone = 'sage' }) {
  const background = tone === 'blue' ? 'bg-[#E1ECF2]' : tone === 'peach' ? 'bg-[#F6E2D3]' : 'bg-[#E5EEE2]'
  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-[10px] ${background}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-[#436E60]">
          <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
          <span className="line-clamp-2 text-[15px] font-semibold text-[#254E42]">{alt}</span>
        </div>
      )}
    </div>
  )
}

function LocationTile({ place, number, featured = false }) {
  const flag = countryFlag(place.name)
  return (
    <article className={`group min-w-0 ${featured ? 'sm:flex sm:items-stretch sm:gap-5' : ''}`}>
      <div className={`relative ${featured ? 'sm:w-[47%] sm:shrink-0' : ''}`}>
        <MediaFrame imageUrl={place.imageUrl} alt={place.name} icon={Globe2} tone="blue" />
        <span className="absolute left-3 top-3 rounded-md bg-[#F7F6F1] px-2.5 py-1 text-[13px] font-bold text-[#173F35] shadow-sm">{String(number).padStart(2, '0')}</span>
      </div>
      <div className={`${featured ? 'flex flex-1 flex-col justify-center pt-3 sm:py-2' : 'pt-3'}`}>
        <h3 className="text-[18px] font-bold leading-[1.3] text-[#173F35]">
          {flag ? <span aria-hidden="true" className="mr-2">{flag}</span> : null}{place.name}
        </h3>
        {place.region ? <p className="mt-1 flex items-center gap-1.5 text-[14px] text-[#526A5F]"><MapPin size={15} aria-hidden="true" />{place.region}</p> : null}
        {place.description ? <p className="mt-2 text-[14px] leading-[1.55] text-[#617369]">{place.description}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {flag ? (
            <Link to={countryExplorePath(place.name)} style={{ color: C.ink, WebkitTextFillColor: C.ink }} className="inline-flex items-center gap-1.5 text-[14px] font-bold underline decoration-[#C38467] underline-offset-4 hover:decoration-2">
              Explore foods <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          ) : null}
          {place.sourceUrl ? (
            <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.clay, WebkitTextFillColor: C.clay }} className="inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4">
              View source <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function VarietyTile({ item, number }) {
  return (
    <Link to={`/ingredients/${encodeURIComponent(item.id || item.slug)}`} className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35]">
      <div className="relative">
        <MediaFrame imageUrl={item.imageUrl} alt={item.name} icon={Sprout} />
        <span className="absolute left-2 top-2 grid h-8 min-w-8 place-items-center rounded-md bg-[#F7F6F1] px-1 text-[13px] font-bold text-[#173F35]">{number}</span>
        <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-[#F7F6F1] text-[#173F35]"><ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[#A85A3C]">EPANTRY ingredient</p>
      <h3 className="mt-0.5 text-[17px] font-bold leading-[1.3] text-[#173F35] group-hover:underline group-hover:underline-offset-2">{item.name}</h3>
      {item.country ? <p className="mt-1 flex items-start gap-1.5 text-[14px] leading-5 text-[#586F63]"><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{item.country}{item.region ? ` · ${item.region}` : ''}</p> : null}
    </Link>
  )
}

function ProductTile({ item }) {
  return (
    <Link to={item.path} className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35]">
      <div className="relative">
        <MediaFrame imageUrl={item.imageUrl} alt={item.name} icon={ShoppingBag} tone="peach" />
        <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-[#F7F6F1] text-[#173F35]"><ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[#A55E43]">EPANTRY Host</p>
      <h3 className="mt-0.5 line-clamp-2 text-[17px] font-bold leading-[1.35] text-[#173F35] group-hover:underline group-hover:underline-offset-2">{item.name}</h3>
      {item.category ? <p className="mt-1 text-[14px] capitalize text-[#607268]">{String(item.category).replaceAll('_', ' ')}</p> : null}
    </Link>
  )
}

function DishTile({ item, isHost }) {
  const dish = item?.dish || {}
  const recipe = item?.recipe || {}
  const name = isHost ? item.name : dish.name || recipe.title || 'Recipe'
  const href = isHost ? item.path : item?.path || `/recipes/${encodeURIComponent(dish.slug || '')}`
  const imageUrl = isHost ? item.imageUrl : dish.heroImageUrl
  const time = isHost ? 0 : Number(recipe.preparationTimeMinutes || 0) + Number(recipe.cookingTimeMinutes || 0)
  const type = isHost ? 'Host food' : dish.course || 'Recipe'
  return (
    <Link to={href} className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35]">
      <div className="relative">
        <MediaFrame imageUrl={imageUrl} alt={name} tone="sage" />
        <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-[#F7F6F1] text-[#173F35] shadow-sm"><ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[#A75C3E]">{type}</p>
      <h3 className="mt-0.5 line-clamp-2 text-[17px] font-bold leading-[1.32] text-[#173F35] group-hover:underline group-hover:underline-offset-2">{name}</h3>
      {!isHost && dish.cuisine ? <p className="mt-1 text-[14px] text-[#5B6D60]">{dish.cuisine}</p> : null}
      {time > 0 ? <p className="mt-1 text-[14px] text-[#5B6D60]">{time} min</p> : null}
    </Link>
  )
}

export default function IngredientKnowledgePage() {
  const { ref } = useParams()
  const [query] = useSearchParams()
  const listingId = query.get('listing') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locationIndex, setLocationIndex] = useState(0)
  const [locationView, setLocationView] = useState('countries')
  const [varietySearch, setVarietySearch] = useState('')
  const [varietySort, setVarietySort] = useState('catalog')
  const [dishFilter, setDishFilter] = useState('all')
  const [showAllDishes, setShowAllDishes] = useState(false)

  useEffect(() => {
    let alive = true
    setData(null)
    setError('')
    setLoading(true)
    setLocationIndex(0)
    setLocationView('countries')
    setVarietySearch('')
    setVarietySort('catalog')
    setDishFilter('all')
    setShowAllDishes(false)
    getIngredientKnowledge(ref, { listingId })
      .then(result => { if (alive) setData(result) })
      .catch(cause => { if (alive) setError(cause?.response?.data?.message || cause?.message || 'Ingredient details are unavailable.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ref, listingId])

  const ingredient = data?.identity || {}
  const name = ingredient.displayName || ingredient.name || 'Ingredient'
  const locations = Array.isArray(data?.topLocations) ? data.topLocations : []
  const varieties = Array.isArray(data?.varieties) ? data.varieties : []
  const products = Array.isArray(data?.topProducts) ? data.topProducts : []
  const relatedRecipes = Array.isArray(data?.relatedRecipes) ? data.relatedRecipes : []
  const relatedHostDishes = Array.isArray(data?.relatedHostDishes) ? data.relatedHostDishes : []

  const dishes = useMemo(() => [
    ...relatedRecipes.map(item => ({ item, type: 'recipe', name: item?.dish?.name || item?.recipe?.title || '' })),
    ...relatedHostDishes.map(item => ({ item, type: 'host', name: item?.name || '' })),
  ], [relatedRecipes, relatedHostDishes])
  const filteredDishes = useMemo(() => dishes.filter(item => dishFilter === 'all' || item.type === dishFilter), [dishes, dishFilter])
  const filteredVarieties = useMemo(() => {
    const rows = varieties.filter(item => item.name?.toLowerCase().includes(varietySearch.toLowerCase().trim()))
    return varietySort === 'az' ? [...rows].sort((a, b) => a.name.localeCompare(b.name)) : rows
  }, [varieties, varietySearch, varietySort])

  const countryLocations = [...new Map(locations.map(place => [place.iso3 || place.name, place])).values()]
  const regionLocations = locations.filter(place => Boolean(place.region))
  const locationRows = locationView === 'regions' ? regionLocations : countryLocations
  const visibleLocations = locationRows.slice(locationIndex, locationIndex + 4)
  const sources = (data?.sources || []).filter(source => Boolean(source?.url))
  let sectionCounter = 0
  const indexes = {
    locations: locations.length ? ++sectionCounter : null,
    varieties: varieties.length ? ++sectionCounter : null,
    products: products.length ? ++sectionCounter : null,
    dishes: ++sectionCounter,
  }

  return (
    <main className="min-h-screen bg-[#F7F6F1] text-[#173F35]">
      <div className="page-shell max-w-[1400px] pb-12 pt-4 sm:pt-6">
        <Link
          to={listingId ? `/explore/host-listings?item=${encodeURIComponent(listingId)}` : '/recipes'}
          style={{ color: C.ink, WebkitTextFillColor: C.ink }}
          className="inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold transition hover:underline hover:underline-offset-4"
        >
          <ArrowLeft size={17} aria-hidden="true" />{listingId ? 'Back to Host listing' : 'Back to recipes'}
        </Link>

        {loading ? (
          <div className="mt-6 space-y-5" role="status" aria-label="Loading ingredient information">
            <div className="h-44 animate-pulse rounded-[14px] bg-[#E6EEE4]" />
            <div className="h-40 animate-pulse rounded-[14px] bg-[#F4E6DD]" />
          </div>
        ) : error ? (
          <section role="alert" className="mt-7 border-l-4 border-[#B65637] bg-[#FFE4D7] p-5">
            <h1 className="text-[26px] font-bold text-[#173F35]">Ingredient unavailable</h1>
            <p className="mt-2 text-[15px] leading-6 text-[#394F45]">{error}</p>
          </section>
        ) : data ? (
          <>
            {/* Warm-neutral editorial hero; keeps the existing real ingredient image and sources. */}
            <header className="mt-5 overflow-hidden rounded-[15px] border border-[#E4E3DB] bg-[#FFFCF8] sm:mt-6">
              <div className={`grid ${ingredient.imageUrl ? 'lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]' : ''}`}>
                <div className="min-w-0 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
                  <p className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.075em] text-[#B65637]">
                    <Sprout size={17} aria-hidden="true" />EPANTRY · Ingredient Atlas
                  </p>
                  <h1 className="mt-4 break-words text-[37px] font-bold leading-[1.1] tracking-[-.045em] text-[#173F35] sm:text-[44px]">{name}</h1>
                  {ingredient.aliases?.length ? <p className="mt-2 text-[14px] leading-5 text-[#607268]">Also known as {ingredient.aliases.slice(0, 5).join(' · ')}</p> : null}
                  {data.overview ? (
                    <p className="mt-4 max-w-[76ch] text-[16px] leading-[1.65] text-[#394F45]">{data.overview}</p>
                  ) : (
                    <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.6] text-[#4F6559]">Discover the recipes, places and products connected to {name} on EPANTRY.</p>
                  )}
                  {sources.length ? (
                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#E1E8DE] pt-4">
                      <span className="text-[13px] font-semibold text-[#5E7266]">Read more</span>
                      {sources.map(source => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: C.ink, WebkitTextFillColor: C.ink }}
                          className="inline-flex items-center gap-1.5 text-[14px] font-bold underline decoration-[#CC8E74] underline-offset-4 hover:decoration-2"
                        >
                          <BookOpen size={15} aria-hidden="true" />
                          {source.name || (source.url?.includes('wikipedia.org') ? 'Wikipedia' : source.url?.includes('wikidata.org') ? 'Wikidata' : 'Reference')}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
                {ingredient.imageUrl ? (
                  <figure className="flex min-w-0 flex-col bg-[#E7EEE5]">
                    <div className="relative min-h-[230px] flex-1 overflow-hidden sm:min-h-[280px]">
                      <img src={ingredient.imageUrl} alt={name} className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                    <figcaption className="flex flex-wrap items-center justify-between gap-2 bg-[#E8F1E8] px-4 py-3 text-[13px] leading-5 text-[#476458]">
                      <span>{ingredient.imageSource || 'Ingredient image'}{ingredient.imageCredit ? ` · ${ingredient.imageCredit}` : ''}</span>
                      {ingredient.imageCreditUrl ? <a href={ingredient.imageCreditUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.ink }} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">{ingredient.imageLicense || 'Image credit'} <ArrowUpRight size={13} aria-hidden="true" /></a> : null}
                    </figcaption>
                  </figure>
                ) : null}
              </div>
              {!ingredient.catalogMatched ? <div className="border-t border-[#E6D1C4] bg-[#FFF0E5] px-5 py-3 text-[14px] text-[#805844] sm:px-8">This ingredient is not yet matched to an active EPANTRY catalog item.</div> : null}
            </header>

            {/* Location data remains real; a single place uses an editorial feature rather than an isolated tile. */}
            {locations.length ? (
              <section className="mt-8 rounded-[14px] border border-[#D8E3E6] bg-[#EDF4F5] px-5 py-7 sm:mt-9 sm:px-8 sm:py-8" aria-label="Ingredient geography and dishes">
                <SectionHeading
                  index={indexes.locations}
                  eyebrow="Places & cooking traditions"
                  title="Top Locations"
                  count={locations.length}
                  note="Explore places connected to published EPANTRY dishes and documented ingredient origins."
                  end={locationRows.length > 4 ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setLocationIndex(index => Math.max(0, index - 1))} disabled={locationIndex === 0} className="grid h-10 w-10 place-items-center rounded-full border border-[#B8CDD0] bg-white text-[#173F35] disabled:opacity-40" aria-label="Previous locations"><ChevronLeft size={18} /></button>
                      <button type="button" onClick={() => setLocationIndex(index => Math.min(locationRows.length - 4, index + 1))} disabled={locationIndex >= locationRows.length - 4} className="grid h-10 w-10 place-items-center rounded-full border border-[#B8CDD0] bg-white text-[#173F35] disabled:opacity-40" aria-label="Next locations"><ChevronRight size={18} /></button>
                    </div>
                  ) : null}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <FilterTab selected={locationView === 'countries'} onClick={() => { setLocationView('countries'); setLocationIndex(0) }}>Countries ({countryLocations.length})</FilterTab>
                  {regionLocations.length > 0 ? <FilterTab selected={locationView === 'regions'} onClick={() => { setLocationView('regions'); setLocationIndex(0) }}>Regions ({regionLocations.length})</FilterTab> : null}
                </div>
                <div className={visibleLocations.length === 1 ? 'mt-5 max-w-[850px] rounded-[12px] bg-[#FFFCF8] p-3 sm:p-4' : 'mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4'}>
                  {visibleLocations.map((place, index) => <LocationTile key={`${place.name}-${place.region || ''}`} place={place} number={locationIndex + index + 1} featured={visibleLocations.length === 1} />)}
                </div>
              </section>
            ) : null}

            {varieties.length ? (
              <section className="mt-8 rounded-[14px] border border-[#EFDFD3] bg-[#FFF1E8] px-5 py-7 sm:mt-9 sm:px-8 sm:py-8" aria-label="Ingredient types">
                <SectionHeading index={indexes.varieties} eyebrow="Ingredient varieties" title={`${name} Types & Varieties`} count={varieties.length} note="Explore varieties recorded in the EPANTRY ingredient catalog." />
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <label className="relative min-w-[190px] flex-1 sm:max-w-xs">
                    <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#637568]" aria-hidden="true" />
                    <input type="search" value={varietySearch} onChange={event => setVarietySearch(event.target.value)} placeholder="Find a variety" aria-label="Find an ingredient variety" className="h-11 w-full rounded-[10px] border border-[#D6CDC2] bg-white pl-10 pr-3 text-[15px] text-[#173F35] outline-none focus:border-[#B65637]" />
                  </label>
                  <div className="flex flex-wrap items-center gap-2"><SlidersHorizontal size={18} className="text-[#6F7B6D]" aria-hidden="true" /><FilterTab selected={varietySort === 'catalog'} onClick={() => setVarietySort('catalog')}>Catalog</FilterTab><FilterTab selected={varietySort === 'az'} onClick={() => setVarietySort('az')}>A–Z</FilterTab></div>
                </div>
                {filteredVarieties.length ? (
                  <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">{filteredVarieties.map((item, index) => <VarietyTile key={item.id} item={item} number={index + 1} />)}</div>
                ) : <p className="mt-5 border-l-[3px] border-[#C9876B] bg-white px-4 py-3 text-[15px] text-[#475E51]">No varieties match this search.</p>}
              </section>
            ) : null}

            {products.length ? (
              <section className="mt-8 border-y border-[#D5DED4] bg-[#F7F6F1] py-7 sm:mt-9 sm:py-8" aria-label="Ingredient products">
                <SectionHeading index={indexes.products} eyebrow="EPANTRY marketplace" title={`${name} Products`} count={products.length} note="Approved products connected to this ingredient." />
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">{products.map(item => <ProductTile key={item.id} item={item} />)}</div>
              </section>
            ) : null}

            {/* All published dishes and Host dish paths remain clickable; no invented rankings. */}
            <section className="mt-8 rounded-[14px] border border-[#DCE6D9] bg-[#E9F1E8] px-5 py-7 sm:mt-9 sm:px-8 sm:py-8" aria-label="Dishes with ingredient">
              <SectionHeading index={indexes.dishes} eyebrow="Cook with it" title={`Dishes with ${name}`} count={dishes.length} note="Recipes and approved Host dishes on EPANTRY made with this ingredient." />
              {dishes.length ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      ['all', `All (${dishes.length})`],
                      ['recipe', `Recipes (${relatedRecipes.length})`],
                      ['host', `Host dishes (${relatedHostDishes.length})`],
                    ].filter(([value]) => value === 'all' || (value === 'recipe' ? relatedRecipes.length > 0 : relatedHostDishes.length > 0)).map(([value, label]) => (
                      <FilterTab key={value} selected={dishFilter === value} onClick={() => { setDishFilter(value); setShowAllDishes(false) }}>{label}</FilterTab>
                    ))}
                  </div>
                  <div className={`mt-5 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 ${filteredDishes.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                    {(showAllDishes ? filteredDishes : filteredDishes.slice(0, 8)).map(({ item, type }) => (
                      <DishTile key={type === 'host' ? `host-${item.id}` : `recipe-${item.recipe?.id || item.dish?.id}`} item={item} isHost={type === 'host'} />
                    ))}
                  </div>
                  {filteredDishes.length > 8 ? (
                    <div className="mt-7 text-center"><button type="button" onClick={() => setShowAllDishes(current => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[#ACC4AE] bg-white px-6 py-2 text-[15px] font-semibold text-[#173F35] transition hover:border-[#173F35]">{showAllDishes ? 'Show less' : 'View all'} <ArrowRight size={17} aria-hidden="true" /></button></div>
                  ) : null}
                </>
              ) : (
                <p className="mt-5 border-l-[3px] border-[#7BA28B] bg-[#F7FCF7] px-4 py-3 text-[15px] text-[#4B6556]">No published EPANTRY dishes with this ingredient are available yet.</p>
              )}
            </section>
            <p className="mt-6 border-t border-[#D6DED3] pt-4 text-[13px] leading-5 text-[#68786D]">Information is based on linked EPANTRY records and cited public references.</p>
          </>
        ) : null}
      </div>
    </main>
  )
}
