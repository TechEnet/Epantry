import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
  Globe2, Leaf, MapPin, Search, ShoppingBag, SlidersHorizontal, Sprout,
} from 'lucide-react'
import { getIngredientKnowledge } from '../services/ingredientKnowledge.service'

function IngredientSectionHeading({ eyebrow, title, count, note, end }) {
  return (
    <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-[#CFD9CE] pb-3 sm:pb-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[.1em] text-[#B45E3B]">{eyebrow}</p> : null}
        <h2 className="font-serif text-[22px] font-semibold leading-[1.2] tracking-[-.035em] text-[#173F35] sm:text-[28px]">
          {title}
          {typeof count === 'number' && count > 0 ? <span className="ml-2 align-middle font-sans text-[13px] font-semibold tracking-normal text-[#657769]">({count})</span> : null}
        </h2>
        {note ? <p className="mt-1.5 max-w-3xl text-[14px] leading-6 text-[#607065]">{note}</p> : null}
      </div>
      {end}
    </div>
  )
}

function EmptyLine({ children, tint = 'sage' }) {
  return (
    <div className={`mt-4 border-l-[3px] px-4 py-3 text-[14px] leading-6 ${tint === 'peach' ? 'border-[#C86C42] bg-[#FFF1E8] text-[#765444]' : 'border-[#4B8966] bg-[#E6F4ED] text-[#466853]'}`}>
      {children}
    </div>
  )
}

function MediaFrame({ imageUrl, alt, icon: Icon = Leaf, tone = 'green' }) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-[11px] ${tone === 'peach' ? 'bg-[#F7D9C4]' : tone === 'blue' ? 'bg-[#DCEAF7]' : 'bg-[#DDF3E7]'}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transition-none" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-[#42745A]">
          <Icon size={33} strokeWidth={1.4} aria-hidden="true" />
          <span className="line-clamp-2 text-[14px] font-semibold">{alt}</span>
        </div>
      )}
    </div>
  )
}

function LocationTile({ place, number }) {
  return (
    <article className="group min-w-0">
      <div className="relative">
        <MediaFrame imageUrl={place.imageUrl} alt={place.name} icon={Globe2} tone="blue" />
        <span className="absolute left-2 top-2 rounded-full bg-[#F7F6F2]/95 px-2.5 py-1 text-[12px] font-semibold text-[#173F35]">{String(number).padStart(2, '0')}</span>
      </div>
      <div className="pt-3">
        <h3 className="text-[17px] font-semibold text-[#173F35]">{place.name}</h3>
        {place.region ? <p className="mt-0.5 flex items-center gap-1 text-[13px] text-[#536D5C]"><MapPin size={12} aria-hidden="true" /> {place.region}</p> : null}
        {place.description ? <p className="mt-1 text-[13px] leading-5 text-[#647167]">{place.description}</p> : null}
        {place.sourceUrl ? <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-[#A55735] hover:underline">View source <ArrowUpRight size={13} aria-hidden="true" /></a> : null}
      </div>
    </article>
  )
}

function VarietyTile({ item, number }) {
  return (
    <Link to={`/ingredients/${encodeURIComponent(item.id || item.slug)}`} className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35]">
      <div className="relative">
        <MediaFrame imageUrl={item.imageUrl} alt={item.name} icon={Sprout} tone="green" />
        <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-md bg-[#F7F6F2] px-1 text-[13px] font-bold text-[#173F35]">{number}</span>
        <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#173F35]"><ArrowUpRight size={15} aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-[13px] font-medium text-[#9A614B]">EPANTRY ingredient</p>
      <h3 className="mt-0.5 text-[16px] font-semibold leading-5 text-[#173F35] group-hover:underline group-hover:underline-offset-2">{item.name}</h3>
      {item.country ? <p className="mt-1 flex items-start gap-1 text-[13px] leading-5 text-[#607065]"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{item.country}{item.region ? ` · ${item.region}` : ''}</p> : null}
    </Link>
  )
}

function ProductTile({ item }) {
  return (
    <Link to={item.path} className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35]">
      <div className="relative">
        <MediaFrame imageUrl={item.imageUrl} alt={item.name} icon={ShoppingBag} tone="peach" />
        <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#173F35]"><ArrowUpRight size={15} aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-[13px] text-[#965942]">Approved EPANTRY Host</p>
      <h3 className="mt-0.5 line-clamp-2 text-[16px] font-semibold leading-5 text-[#173F35] group-hover:underline group-hover:underline-offset-2">{item.name}</h3>
      {item.category ? <p className="mt-1 text-[13px] capitalize text-[#657469]">{String(item.category).replaceAll('_', ' ')}</p> : null}
    </Link>
  )
}

function DishTile({ item, isHost }) {
  const dish = item?.dish || {}
  const recipe = item?.recipe || {}
  const name = isHost ? item.name : dish.name || recipe.title || 'Recipe'
  const href = isHost ? item.path : item?.path || `/recipes/${encodeURIComponent(dish.slug || '')}`
  const image = isHost ? item.imageUrl : dish.heroImageUrl
  const time = !isHost ? Number(recipe.preparationTimeMinutes || 0) + Number(recipe.cookingTimeMinutes || 0) : 0
  const kind = isHost ? 'Host food' : dish.course || 'Recipe'
  return (
    <Link to={href} className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35]">
      <div className="relative">
        <MediaFrame imageUrl={image} alt={name} icon={Leaf} tone="green" />
        <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#173F35]"><ArrowUpRight size={15} aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-[13px] font-medium text-[#A65C40]">{kind}</p>
      <h3 className="mt-0.5 line-clamp-2 text-[16px] font-semibold leading-[1.35] text-[#173F35] group-hover:underline group-hover:underline-offset-2">{name}</h3>
      {!isHost && dish.cuisine ? <p className="mt-1 text-[13px] text-[#617166]">{dish.cuisine}</p> : null}
      {time > 0 ? <p className="mt-1 text-[13px] text-[#617166]">{time} min</p> : null}
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
  const hasSource = Boolean(data?.sources?.length)
  const sectionIndex = {
    locations: 1,
    varieties: 1 + Number(locations.length > 0),
    products: 1 + Number(locations.length > 0) + Number(varieties.length > 0),
    dishes: 1 + Number(locations.length > 0) + Number(varieties.length > 0) + Number(products.length > 0),
  }
  const stepLabel = number => String(number).padStart(2, '0')

  return (
    <main className="min-h-screen bg-[#F6F4EE] text-[#202421]">
      <div className="page-shell max-w-[1400px] pb-12 pt-4 sm:pt-6">
        <Link to={listingId ? `/explore/host-listings?item=${encodeURIComponent(listingId)}` : '/recipes'} className="inline-flex min-h-9 items-center gap-2 text-[14px] font-semibold text-[#173F35] transition hover:text-[#B45E3B]">
          <ArrowLeft size={16} aria-hidden="true" /> {listingId ? 'Back to Host listing' : 'Back to recipes'}
        </Link>

        {loading ? (
          <div className="mt-6 space-y-6" role="status" aria-label="Loading ingredient information">
            <div className="h-32 max-w-lg animate-pulse rounded-lg bg-[#DDF3E7]" />
            <div className="h-36 animate-pulse rounded-lg bg-[#E9E1FF]/50" />
          </div>
        ) : error ? (
          <section role="alert" className="mt-7 border-l-4 border-[#C86C42] bg-[#FFE0CF] p-5">
            <h1 className="text-2xl font-bold text-[#173F35]">Ingredient unavailable</h1>
            <p className="mt-2 text-[15px]">{error}</p>
          </section>
        ) : data ? (
          <>
            <header className="mt-5 border-b border-[#CAD6CA] pb-7 sm:mt-7 sm:pb-9">
              <p className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.09em] text-[#B45E3B]"><Sprout size={16} aria-hidden="true" /> EPANTRY · Ingredient Atlas</p>
              <div className={`mt-3 grid gap-5 ${ingredient.imageUrl ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(250px,.6fr)] lg:items-center' : ''}`}>
                <div className="min-w-0">
                  <h1 className="break-words font-serif text-[28px] font-semibold leading-[1.1] sm:text-[34px] tracking-[-.045em] text-[#173F35]">{name}</h1>
                  {ingredient.aliases?.length ? <p className="mt-2 text-[14px] text-[#647168]">Also called: {ingredient.aliases.slice(0, 5).join(' · ')}</p> : null}
                  {data.overview ? (
                    <p className="mt-3 max-w-[80ch] text-[15px] leading-[1.65] text-[#415A49] sm:text-[16px]">{data.overview}</p>
                  ) : <p className="mt-3 text-[15px] leading-6 text-[#607266]">Verified background information is not available for this ingredient yet.</p>}
                  {hasSource ? <div className="mt-4 flex flex-wrap gap-2">{data.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#B7C8B9] bg-[#E6F4ED] px-3 py-1.5 text-[13px] font-semibold text-[#173F35] hover:border-[#173F35]"><BookOpen size={14} aria-hidden="true" />{source.name}<ArrowUpRight size={13} aria-hidden="true" /></a>)}</div> : null}
                </div>
                {ingredient.imageUrl ? <figure className="overflow-hidden rounded-[14px] bg-[#DDF3E7]"><img src={ingredient.imageUrl} alt={name} className="aspect-[5/3] w-full object-cover lg:aspect-[4/3]" /><figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px] text-[#52685B]"><span>{ingredient.imageSource || 'Approved ingredient image'}{ingredient.imageCredit ? ` · ${ingredient.imageCredit}` : ''}</span>{ingredient.imageCreditUrl ? <a href={ingredient.imageCreditUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{ingredient.imageLicense || 'Image credit'} <ArrowUpRight size={12} className="inline" /></a> : null}</figcaption></figure> : null}
              </div>
              {!ingredient.catalogMatched ? <p className="mt-3 text-[13px] text-[#825A45]">This ingredient is not yet matched to an active EPANTRY catalog item. Recipe associations cannot be confirmed.</p> : null}
            </header>

            {locations.length ? <section className="py-7 sm:py-9" aria-label="Ingredient geography and dishes">
              <IngredientSectionHeading eyebrow={`${stepLabel(sectionIndex.locations)} / Locations & cooking traditions`} title="Places connected to this ingredient" count={locations.length} note="Documented ingredient origins and locations of approved EPANTRY dishes are identified separately. Not worldwide rankings." end={locationRows.length > 4 ? <div className="flex gap-2"><button type="button" onClick={() => setLocationIndex(index => Math.max(0, index - 1))} disabled={locationIndex === 0} className="grid h-9 w-9 place-items-center rounded-full border border-[#B8CCBB] bg-white text-[#173F35] disabled:opacity-40" aria-label="Previous locations"><ChevronLeft size={18} /></button><button type="button" onClick={() => setLocationIndex(index => Math.min(locationRows.length - 4, index + 1))} disabled={locationIndex >= locationRows.length - 4} className="grid h-9 w-9 place-items-center rounded-full border border-[#B8CCBB] bg-white text-[#173F35] disabled:opacity-40" aria-label="Next locations"><ChevronRight size={18} /></button></div> : null} />
              {locations.length ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setLocationView('countries'); setLocationIndex(0) }} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${locationView === 'countries' ? 'bg-[#173F35] text-white' : 'border border-[#B9CEBC] bg-white text-[#173F35]'}`}>Countries ({countryLocations.length})</button>{regionLocations.length > 0 ? <button type="button" onClick={() => { setLocationView('regions'); setLocationIndex(0) }} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${locationView === 'regions' ? 'bg-[#173F35] text-white' : 'border border-[#B9CEBC] bg-white text-[#173F35]'}`}>Regions ({regionLocations.length})</button> : null}</div> : null}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{visibleLocations.map((place, index) => <LocationTile key={`${place.name}-${place.region || ''}`} place={place} number={locationIndex + index + 1} />)}</div>
            </section> : null}

            {varieties.length ? <section className="border-t border-[#D5DED3] bg-[#FFF1E8]/50 px-4 py-7 sm:px-6 sm:py-9" aria-label="Ingredient types">
              <IngredientSectionHeading eyebrow={`${stepLabel(sectionIndex.varieties)} / Ingredient varieties`} title={`${name} Types in the World`} count={varieties.length} note="Explore actual active ingredient varieties from the EPANTRY catalog. No invented global rankings or ratings." />
              {varieties.length ? (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <label className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#617265]" /><input type="search" value={varietySearch} onChange={event => setVarietySearch(event.target.value)} placeholder="Find a variety" aria-label="Find an ingredient variety" className="h-10 w-full rounded-full border border-[#BDCCBC] bg-white pl-9 pr-3 text-[14px] text-[#173F35] outline-none focus:border-[#173F35]" /></label>
                    <div className="flex items-center gap-1 rounded-full bg-[#E6F4ED] p-1"><SlidersHorizontal size={15} className="ml-2 text-[#44735A]" /><button type="button" onClick={() => setVarietySort('catalog')} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${varietySort === 'catalog' ? 'bg-[#173F35] text-white' : 'text-[#173F35]'}`}>Catalog</button><button type="button" onClick={() => setVarietySort('az')} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${varietySort === 'az' ? 'bg-[#173F35] text-white' : 'text-[#173F35]'}`}>A–Z</button></div>
                  </div>
                  {filteredVarieties.length ? <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-4">{filteredVarieties.map((item, index) => <VarietyTile key={item.id} item={item} number={index + 1} />)}</div> : <EmptyLine>No varieties match this search.</EmptyLine>}
                </>
              ) : null}
            </section> : null}

            {products.length ? <section className="border-t border-[#D5DED3] py-7 sm:py-9" aria-label="Ingredient products">
              <IngredientSectionHeading eyebrow={`${stepLabel(sectionIndex.products)} / Approved marketplace`} title={`${name} Products`} count={products.length} note="Real approved grocery listings from EPANTRY Hosts. Prices and ratings are not estimated." />
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-4">{products.map(item => <ProductTile key={item.id} item={item} />)}</div>
            </section> : null}

            <section className="border-t border-[#D5DED3] bg-[#E6F4ED]/55 px-4 py-7 sm:px-6 sm:py-9" aria-label="Dishes with ingredient">
              <IngredientSectionHeading eyebrow={`${stepLabel(sectionIndex.dishes)} / Cook with it`} title={`Dishes with ${name}`} count={dishes.length} note="Only recipes and food listings published on EPANTRY with a matching canonical ingredient." />
              {dishes.length ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      ['all', `All (${dishes.length})`],
                      ['recipe', `Recipes (${relatedRecipes.length})`],
                      ['host', `Host dishes (${relatedHostDishes.length})`],
                    ].filter(([value]) => value === 'all' || (value === 'recipe' ? relatedRecipes.length > 0 : relatedHostDishes.length > 0)).map(([value, label]) => <button key={value} type="button" onClick={() => { setDishFilter(value); setShowAllDishes(false) }} className={`min-h-9 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${dishFilter === value ? 'bg-[#173F35] text-white' : 'border border-[#BFCDBF] bg-[#E6F4ED] text-[#173F35] hover:bg-[#D2E9D8]'}`}>{label}</button>)}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-4">
                    {(showAllDishes ? filteredDishes : filteredDishes.slice(0, 8)).map(({ item, type }) => <DishTile key={type === 'host' ? `host-${item.id}` : `recipe-${item.recipe?.id || item.dish?.id}`} item={item} isHost={type === 'host'} />)}
                  </div>
                  {filteredDishes.length > 8 ? <div className="mt-7 text-center"><button type="button" onClick={() => setShowAllDishes(current => !current)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#B8CAB9] bg-white px-6 py-2 text-[14px] font-semibold text-[#173F35] transition hover:border-[#173F35]">{showAllDishes ? 'Show less' : 'View all'} <ArrowRight size={15} aria-hidden="true" /></button></div> : null}
                </>
              ) : <EmptyLine>No published EPANTRY dishes with this ingredient are available yet.</EmptyLine>}
            </section>

            <p className="border-t border-[#D5DED3] pb-3 pt-5 text-[13px] leading-5 text-[#647168]">Variety and product collections appear only when approved catalog records are linked to this ingredient. Origin and descriptions appear only where documented. Locations and catalog products do not represent worldwide rankings. EPANTRY dish links are based on approved records, and encyclopedia references are not nutrition or food-safety claims.</p>
          </>
        ) : null}
      </div>
    </main>
  )
}
