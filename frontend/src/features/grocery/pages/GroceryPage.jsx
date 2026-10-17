import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Grid3X3,
  Leaf,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import EmptyState from '../../../components/common/EmptyState'
import { openAvailabilityNotifyModal } from '../../notifications/components/AvailabilityNotifyModal'
import { recordCustomerSearchDemand } from '../../search/services/search.service'
import useGroceryCatalog from '../hooks/useGroceryCatalog'

const INITIAL_BATCH = 24
const DESKTOP_REVEAL = 12
const MOBILE_REVEAL = 4

function productKey(product) {
  return String(product?.productVersionId || product?.id || product?._id || product?.slug || '')
}

function productName(product) {
  return String(product?.displayName || 'Grocery product').trim()
}

function productImage(product) {
  return product?.image?.url || product?.images?.[0]?.url || ''
}

function productPath(product) {
  return `/grocery/product/${encodeURIComponent(product?.slug || '')}`
}

function GroceryTile({ product }) {
  const title = productName(product)
  const category = product?.category?.name || 'Grocery'
  const brand = product?.brand?.name || ''
  const quantity = product?.netQuantity?.display || product?.netQuantity?.label || product?.pack?.name || ''
  const image = productImage(product)

  return (
    <Link
      to={productPath(product)}
      aria-label={`View grocery product: ${title}`}
      className="focus-ring group flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#DCE0CF] bg-[#F7F6F2] shadow-[0_8px_28px_rgba(32,36,33,0.07)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#173F35]/35 hover:shadow-[0_18px_44px_rgba(32,36,33,0.13)] focus-visible:ring-2 focus-visible:ring-[#173F35]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F7F6F2] lg:aspect-[3/2]">
        {image ? (
          <img
            src={image}
            alt={product?.image?.alt || title}
            loading="lazy"
            className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none sm:p-4"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#DCE0CF]/50 text-[#173F35]">
            <Grid3X3 size={38} aria-label="Product image unavailable" />
          </div>
        )}
      </div>
      <div className="flex min-h-[86px] flex-1 items-center justify-between gap-2.5 border-t border-[#DCE0CF] px-3.5 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-[#173F35]">{category}</p>
          <h3 className="mt-1 line-clamp-2 text-[18px] font-bold leading-tight tracking-[-0.025em] text-[#202421]">{title}</h3>
          {(brand || quantity) && (
            <p className="mt-1 truncate text-[14px] text-[#202421]/70">
              {[brand, quantity].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173F35] text-[#F7F6F2] transition-transform duration-200 group-hover:translate-x-0.5">
          <ArrowUpRight size={18} />
        </span>
      </div>
    </Link>
  )
}

// The native select remains keyboard-accessible. Its selected text is drawn
// separately to prevent long category/brand names being clipped by Safari.
function AdaptiveSelect({ label, value, options, onChange, disabled = false }) {
  const selection = options.find((option) => option.value === value)
  const shown = selection?.label || label
  return (
    <label className={`focus-within:ring-2 focus-within:ring-[#173F35]/25 relative inline-flex min-h-11 w-max max-w-none shrink-0 items-center rounded-full border transition-colors duration-200 focus-within:border-[#173F35] ${value ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2]' : 'border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]'}`}>
      <span aria-hidden="true" className="block whitespace-nowrap py-2.5 pl-3.5 pr-9 text-[14px] font-semibold leading-5">{shown}</span>
      <select
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full border-0 opacity-0 disabled:cursor-wait"
      >
        <option value="">{label}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
    </label>
  )
}

export default function GroceryPage() {
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const {
    products,
    categories,
    brands,
    search,
    categorySlug,
    brandSlug,
    page,
    pagination,
    loading,
    filtersLoading,
    error,
    setSearch,
    setCategorySlug,
    setBrandSlug,
    setPage,
    resetFilters,
  } = useGroceryCatalog({
    initialSearch: initialQuery,
    initialCategorySlug: searchParams.get('category') || '',
    initialBrandSlug: searchParams.get('brand') || '',
    initialLimit: INITIAL_BATCH,
    appendPages: true,
  })

  const collectionRef = useRef(null)
  const unavailableSearchRef = useRef('')
  const [heroSearch, setHeroSearch] = useState(initialQuery)
  const [collectionQuery, setCollectionQuery] = useState(initialQuery)
  const [searchFocused, setSearchFocused] = useState(false)
  const [visibleCount, setVisibleCount] = useState(DESKTOP_REVEAL)
  const [smallViewport, setSmallViewport] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ))
  const [hint, setHint] = useState('')

  const revealSize = smallViewport ? MOBILE_REVEAL : DESKTOP_REVEAL

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setSmallViewport(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  // One card batch at a time; changing filters starts from the first batch.
  const filterSignature = `${categorySlug}\u0001${brandSlug}`
  useEffect(() => { setVisibleCount(revealSize) }, [filterSignature, revealSize])

  // The collection input searches the server's real category/brand-filtered
  // catalog; it never creates made-up products or client-only fake results.
  useEffect(() => {
    if (collectionQuery.trim() === search) return undefined
    const timer = window.setTimeout(() => {
      setSearch(collectionQuery.trim())
      setVisibleCount(revealSize)
    }, 360)
    return () => window.clearTimeout(timer)
  }, [collectionQuery, search, revealSize, setSearch])

  const primaryCategories = categories.slice(0, 4)
  const extraCategories = categories.slice(4).map((category) => ({
    value: category.slug,
    label: category.name,
  }))
  const brandOptions = brands.map((brand) => ({ value: brand.slug, label: brand.name }))
  const extraSelected = extraCategories.some((item) => item.value === categorySlug) ? categorySlug : ''
  const chosenCategory = categories.find((item) => item.slug === categorySlug)
  const chosenBrand = brands.find((item) => item.slug === brandSlug)
  const searchScope = chosenCategory?.name || (chosenBrand?.name ? `${chosenBrand.name} products` : 'groceries')

  const suggestions = useMemo(() => {
    if (chosenCategory?.name) return [
      `Explore ${chosenCategory.name.toLowerCase()}...`,
      `Find fresh ${chosenCategory.name.toLowerCase()}...`,
      `Search ${chosenCategory.name.toLowerCase()} by name...`,
    ]
    if (chosenBrand?.name) return [
      `Find ${chosenBrand.name} favourites...`,
      `Search ${chosenBrand.name} products...`,
      `Discover more from ${chosenBrand.name}...`,
    ]
    return ['Fresh fruit and vegetables...', 'Everyday pantry essentials...', 'Search groceries and brands...']
  }, [chosenCategory?.name, chosenBrand?.name])

  useEffect(() => {
    if (collectionQuery || searchFocused) { setHint(''); return undefined }
    let index = 0
    let position = 0
    let deleting = false
    let timer
    const tick = () => {
      const word = suggestions[index]
      position = deleting ? Math.max(0, position - 1) : Math.min(word.length, position + 1)
      setHint(word.slice(0, position))
      let delay = deleting ? 40 : 65
      if (!deleting && position === word.length) { deleting = true; delay = 1600 }
      if (deleting && position === 0) { deleting = false; index = (index + 1) % suggestions.length; delay = 240 }
      timer = window.setTimeout(tick, delay)
    }
    timer = window.setTimeout(tick, 250)
    return () => window.clearTimeout(timer)
  }, [suggestions, collectionQuery, searchFocused])

  useEffect(() => {
    const query = search.trim().toLowerCase()
    if (loading || error || query.length < 2 || products.length || categorySlug || brandSlug) {
      if (products.length || !query) unavailableSearchRef.current = ''
      return
    }
    if (unavailableSearchRef.current === query) return
    unavailableSearchRef.current = query
    openAvailabilityNotifyModal({ query, displayName: search.trim(), source: 'search' })
  }, [loading, error, search, products.length, categorySlug, brandSlug])

  function scrollToCollection() {
    collectionRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  function handleHeroSearch(event) {
    event.preventDefault()
    const value = heroSearch.trim()
    if (value.length >= 2) void recordCustomerSearchDemand({ query: value, surface: 'grocery' })
    setCollectionQuery(value)
    setSearch(value)
    setVisibleCount(revealSize)
    scrollToCollection()
  }

  function handleCollectionSearch(event) {
    event.preventDefault()
    const value = collectionQuery.trim()
    if (value.length >= 2) void recordCustomerSearchDemand({ query: value, surface: 'grocery' })
    setSearch(value)
  }

  function chooseCategory(value) {
    setCategorySlug(value)
    setVisibleCount(revealSize)
  }

  function chooseBrand(value) {
    setBrandSlug(value)
    setVisibleCount(revealSize)
  }

  function clearEverything() {
    resetFilters()
    setHeroSearch('')
    setCollectionQuery('')
    setVisibleCount(revealSize)
  }

  const total = Number(pagination?.total) || 0
  const totalPages = Number(pagination?.pages) || 0
  const visibleProducts = products.slice(0, visibleCount)
  const canViewMore = visibleCount < products.length || (page < totalPages)

  function handleViewMore() {
    if (loading) return
    const nextCount = visibleCount + revealSize
    setVisibleCount(nextCount)
    if (nextCount > products.length && page < totalPages) setPage(page + 1)
  }

  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#202421]">
      {/* Match the approved Recipes 100svh hero and typography while keeping
          the existing genuine Grocery hero photograph and Grocery copy. */}
      <section
        className="relative flex h-[100svh] min-h-0 items-center overflow-hidden bg-[#F7F6F2] bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/hero/grocery.png')" }}
        aria-labelledby="grocery-page-title"
      >
        <div className="page-shell relative z-10 w-full">
          <div className="w-full max-w-[620px] border-l-[5px] border-[#173F35] bg-[#F7F6F2] px-5 py-6 text-[#202421] shadow-[0_14px_36px_rgba(32,36,33,0.15)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <p className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.14em] text-[#173F35]">
              <Leaf size={16} aria-hidden="true" /> EPANTRY Grocery
            </p>
            <h1 id="grocery-page-title" className="mt-3 text-[36px] font-semibold leading-[1.12] tracking-[-0.04em] text-[#202421] sm:text-[44px] lg:text-[56px]">
              Groceries made easier to discover.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#202421]">Fresh groceries, easier to find.</p>
            <form role="search" aria-label="Search groceries" onSubmit={handleHeroSearch} className="mt-6 flex min-h-[52px] w-full items-center gap-2 rounded-[14px] border border-[#DCE0CF] bg-[#F7F6F2] p-1.5 focus-within:border-[#173F35]">
              <Search size={19} className="ml-2 shrink-0 text-[#173F35]" aria-hidden="true" />
              <label htmlFor="grocery-hero-search" className="sr-only">Search groceries or brands</label>
              <input id="grocery-hero-search" type="search" value={heroSearch} onChange={(event) => setHeroSearch(event.target.value)} placeholder="Search groceries or brands" className="min-w-0 flex-1 bg-transparent px-1 text-base text-[#202421] outline-none placeholder:text-[#202421]/60" />
              <button type="submit" className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[11px] bg-[#173F35] px-4 text-[15px] font-semibold text-[#F7F6F2] transition hover:bg-[#202421]">
                <span className="hidden sm:inline">Search groceries</span><ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
        <button type="button" onClick={scrollToCollection} aria-label="Scroll down to explore groceries"
          className="focus-ring absolute bottom-5 right-5 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent bg-[#F7F6F2] px-3.5 py-2.5 text-[14px] font-semibold text-[#173F35] shadow-[0_6px_22px_rgba(32,36,33,0.16)] transition-colors hover:border-[#173F35] focus-visible:border-[#173F35] sm:bottom-8 sm:right-8">
          <span className="hidden sm:inline">Scroll to explore</span><ArrowDown size={17} aria-hidden="true" />
        </button>
      </section>

      <section ref={collectionRef} className="scroll-mt-[70px] border-t border-[#DCE0CF] bg-[#F7F6F2] py-10 sm:py-14" aria-labelledby="grocery-collection-heading">
        <div className="page-shell">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#173F35]">EPANTRY Grocery Collection</p>
          <h2 id="grocery-collection-heading" className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.04em] text-[#202421] sm:text-[36px]">Find something good.</h2>

          {/* Recipe-style category discovery, using real published catalog
              categories instead of invented non-functional Grocery types. */}
          <div className="mt-7 rounded-[16px] border border-[#DCE0CF] bg-[#DCE0CF]/45 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-[#173F35]">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <h3 className="text-[15px] font-bold uppercase tracking-[0.08em]">Explore by type</h3>
            </div>
            <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2">
              <button type="button" aria-pressed={!categorySlug} onClick={() => chooseCategory('')}
                className={`focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors ${!categorySlug ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2]' : 'border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]'}`}>All Groceries</button>
              {primaryCategories.map((category) => (
                <button key={category.slug || category.id} type="button" aria-pressed={categorySlug === category.slug} onClick={() => chooseCategory(category.slug)}
                  className={`focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors ${categorySlug === category.slug ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2]' : 'border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]'}`}>{category.name}</button>
              ))}
              {extraCategories.length > 0 && <AdaptiveSelect label="More types…" value={extraSelected} options={extraCategories} onChange={chooseCategory} disabled={filtersLoading} />}
            </div>
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-[#173F35]/15 pt-3">
              <span className="mr-1 text-[14px] font-semibold text-[#173F35]">Brand</span>
              <AdaptiveSelect label="All brands" value={brandSlug} options={brandOptions} onChange={chooseBrand} disabled={filtersLoading} />
              {(categorySlug || brandSlug) && <button type="button" onClick={() => { chooseCategory(''); chooseBrand('') }} className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border border-transparent px-3 text-[14px] font-semibold text-[#173F35] hover:border-[#173F35]"><RotateCcw size={15} aria-hidden="true" /> Reset filters</button>}
            </div>
          </div>

          <form role="search" aria-label="Search in grocery collection" onSubmit={handleCollectionSearch} className="mt-4">
            <label className="flex min-h-[54px] items-center gap-3 rounded-[14px] border border-[#DCE0CF] bg-[#F7F6F2] px-4 transition-colors focus-within:border-[#173F35] focus-within:ring-2 focus-within:ring-[#173F35]/15">
              <Search size={21} className="shrink-0 text-[#173F35]" aria-hidden="true" />
              <span className="sr-only">Search {searchScope}</span>
              <input type="search" value={collectionQuery} maxLength={150}
                onChange={(event) => { setCollectionQuery(event.target.value); setVisibleCount(revealSize) }}
                onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                placeholder={hint || `Search ${searchScope.toLowerCase()}...`}
                className="h-[52px] w-full min-w-0 flex-1 bg-transparent text-base text-[#202421] outline-none placeholder:text-[#202421]/60" />
              {collectionQuery && <button type="button" onClick={() => { setCollectionQuery(''); setHeroSearch(''); setSearch(''); setVisibleCount(revealSize) }} aria-label="Clear grocery search" className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#DCE0CF] text-[#173F35] hover:bg-[#173F35] hover:text-[#F7F6F2]"><X size={17} aria-hidden="true" /></button>}
            </label>
          </form>

          {error && <div role="alert" className="mt-5 rounded-[12px] border border-[#C86C42] bg-[#F7F6F2] p-4 text-sm text-[#202421]"><CircleAlert size={18} aria-hidden="true" className="mr-2 inline" />{error}</div>}
          {loading && products.length === 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5" role="status" aria-label="Loading groceries">
              {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/3] animate-pulse rounded-[16px] bg-[#DCE0CF] lg:aspect-[3/2]" />)}
            </div>
          ) : !error && visibleProducts.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5" aria-live="polite">
              {visibleProducts.map((product) => <GroceryTile key={productKey(product)} product={product} />)}
            </div>
          ) : !error && !loading ? (
            <div className="mt-8 rounded-[16px] border border-dashed border-[#173F35]/30 bg-[#DCE0CF]/45 px-6 py-12 text-center">
              <EmptyState title="No matching groceries" description="Try another search, category or brand." />
              {(search || categorySlug || brandSlug) && <button type="button" onClick={clearEverything} className="focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173F35] px-5 text-[15px] font-semibold text-[#F7F6F2]"><RotateCcw size={16} /> Clear filters</button>}
            </div>
          ) : null}

          {!error && canViewMore && (
            <div className="mt-8 flex justify-center border-t border-[#DCE0CF] pt-7">
              <button type="button" onClick={handleViewMore} disabled={loading} className="focus-ring inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#173F35] px-8 text-[15px] font-bold text-[#F7F6F2] transition hover:bg-[#202421] disabled:opacity-60">
                {loading ? 'Loading groceries…' : 'View all · Show more groceries'}<ChevronRight size={19} aria-hidden="true" />
              </button>
            </div>
          )}
          {loading && products.length > 0 && <p role="status" className="mt-3 text-center text-[14px] text-[#173F35]">Updating groceries…</p>}
          {total > 0 && visibleProducts.length > 0 && <p className="sr-only">Showing {visibleProducts.length} of {total} published grocery products.</p>}
        </div>
      </section>
    </main>
  )
}
