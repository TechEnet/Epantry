import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Grid3X3,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import EmptyState from '../../../components/common/EmptyState'
import { useAuth } from '../../auth/context/AuthContext'
import { getCatalogCategories, getCatalogProducts } from '../../grocery/services/catalog.service'
import { getBrandWorld, listBrandWorlds } from '../services/brandAuthority.service'

const PAGE_SIZE = 24
const DESKTOP_BATCH = 12
const MOBILE_BATCH = 4
function errorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Unable to load the brand collection.'
}

function brandName(brand) {
  return String(brand?.displayName || brand?.name || 'Brand').trim()
}

function brandKey(brand) {
  return String(brand?.slug || brand?.id || brand?._id || '')
}

function productKey(product) {
  return String(product?.productVersionId || product?.id || product?._id || product?.slug || '')
}

function productImage(product) {
  return product?.image?.url || product?.images?.[0]?.url || ''
}

function productName(product) {
  return String(product?.displayName || 'Brand product').trim()
}

// Brand World is a second, already-public source of published packs. Some
// brand-owned packs are published there before they appear in the retail
// catalog. Only use it as a fallback for an unfiltered selected brand.
function brandWorldProducts(world) {
  const name = brandName(world?.brand)
  return (Array.isArray(world?.productFamilies) ? world.productFamilies : []).flatMap((family) =>
    (Array.isArray(family?.products) ? family.products : []).map((product) => ({
      id: product.packId,
      slug: product.productSlug || '',
      productPath: product.productPath || '',
      displayName: product.currentVersion?.displayName || product.familyName || 'Brand product',
      image: product.currentVersion?.image || null,
      category: { name: family.name || 'Grocery' },
      brand: { name },
      netQuantity: { display: product.packName || '' },
    }))
  )
}

function BrandProductTile({ product }) {
  const name = productName(product)
  const image = productImage(product)
  const brand = product?.brand?.name || ''
  const category = product?.category?.name || 'Grocery'
  const quantity = product?.netQuantity?.display || product?.netQuantity?.label || product?.pack?.name || ''
  const path = product?.productPath || (product?.slug ? `/grocery/product/${encodeURIComponent(product.slug)}` : null)
  const body = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F7F6F2] lg:aspect-[3/2]">
        {image ? (
          <img src={image} alt={product?.image?.alt || name} loading="lazy"
            className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none sm:p-4" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#DCE0CF]/45 text-[#173F35]">
            <Grid3X3 size={36} aria-label="Product image unavailable" />
          </div>
        )}
      </div>
      <div className="flex min-h-[86px] flex-1 items-center justify-between gap-2.5 border-t border-[#DCE0CF] px-3.5 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-[#173F35]">{category}</p>
          <h3 className="mt-1 line-clamp-2 text-[18px] font-bold leading-tight tracking-[-0.025em] text-[#202421]">{name}</h3>
          {(brand || quantity) && <p className="mt-1 truncate text-[14px] text-[#202421]/70">{[brand, quantity].filter(Boolean).join(' · ')}</p>}
        </div>
        {path && <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173F35] text-[#F7F6F2] transition-transform duration-200 group-hover:translate-x-0.5"><ArrowUpRight size={18} /></span>}
      </div>
    </>
  )
  const className = 'focus-ring group flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#DCE0CF] bg-[#F7F6F2] shadow-[0_8px_28px_rgba(32,36,33,0.07)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#173F35]/35 hover:shadow-[0_18px_44px_rgba(32,36,33,0.13)] focus-visible:ring-2 focus-visible:ring-[#173F35]'
  return path ? (
    <Link to={path} aria-label={`View product: ${name}`} className={className}>{body}</Link>
  ) : (
    <article className={className}>{body}</article>
  )
}

// The separate visible label prevents Safari clipping long selected names.
function AdaptiveSelect({ label, value, options, onChange, disabled = false }) {
  const selection = options.find((item) => item.value === value)
  const display = selection?.label || label
  return (
    <label className={`relative inline-flex min-h-11 w-max max-w-none shrink-0 items-center rounded-full border transition-colors duration-200 focus-within:border-[#173F35] focus-within:ring-2 focus-within:ring-[#173F35]/25 ${value ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2]' : 'border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]'}`}>
      <span aria-hidden="true" className="block whitespace-nowrap py-2.5 pl-3.5 pr-9 text-[14px] font-semibold leading-5">{display}</span>
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full border-0 opacity-0 disabled:cursor-wait">
        <option value="">{label}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
    </label>
  )
}

export default function BrandsPage() {
  const { hostEnabled } = useAuth()
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const initialBrand = searchParams.get('brand') || ''

  const collectionRef = useRef(null)
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [dictionaryLoading, setDictionaryLoading] = useState(true)
  const [dictionaryError, setDictionaryError] = useState('')
  const [reload, setReload] = useState(0)

  // Keep filter state atomic: switching brands resets the API page to 1.
  const [filters, setFilters] = useState({ brand: initialBrand, category: '', query: initialQuery, page: 1 })
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [draftSearch, setDraftSearch] = useState(initialQuery)
  const [heroSearch, setHeroSearch] = useState(initialQuery)
  const [searchFocused, setSearchFocused] = useState(false)
  const [hint, setHint] = useState('')
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  const batch = mobile ? MOBILE_BATCH : DESKTOP_BATCH
  const [visibleCount, setVisibleCount] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? MOBILE_BATCH : DESKTOP_BATCH)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    setVisibleCount((current) => Math.max(batch, Math.ceil(current / batch) * batch))
  }, [batch])

  useEffect(() => {
    let active = true
    setDictionaryLoading(true)
    setDictionaryError('')
    async function loadFilters() {
      try {
        const [firstPage, categoriesResult] = await Promise.all([
          listBrandWorlds({ page: 1, limit: 100 }),
          getCatalogCategories(),
        ])
        const collected = [...(Array.isArray(firstPage?.brands) ? firstPage.brands : [])]
        const pages = Math.max(1, Number(firstPage?.pagination?.pages) || 1)
        const seen = new Set(collected.map(brandKey))
        for (let page = 2; page <= pages && active; page += 1) {
          const result = await listBrandWorlds({ page, limit: 100 })
          const next = Array.isArray(result?.brands) ? result.brands : []
          if (!next.length) break
          let added = 0
          next.forEach((brand) => {
            const key = brandKey(brand)
            if (key && !seen.has(key)) { collected.push(brand); seen.add(key); added += 1 }
          })
          if (!added) break
        }
        if (active) {
          setBrands(collected.sort((a, b) => brandName(a).localeCompare(brandName(b))))
          setCategories(Array.isArray(categoriesResult?.categories) ? categoriesResult.categories : [])
        }
      } catch (error) {
        if (active) setDictionaryError(errorMessage(error))
      } finally {
        if (active) setDictionaryLoading(false)
      }
    }
    void loadFilters()
    return () => { active = false }
  }, [reload])

  // Fetch only one API page at a time; append further pages as View All grows.
  useEffect(() => {
    let active = true
    setProductsLoading(true)
    setProductsError('')
    if (filters.page === 1) setProducts([])
    getCatalogProducts({
      page: filters.page,
      limit: PAGE_SIZE,
      search: filters.query,
      categorySlug: filters.category,
      brandSlug: filters.brand,
      listedOnly: false,
    }).then(async (result) => {
      if (!active) return
      let incoming = Array.isArray(result?.products) ? result.products : []
      let effectivePagination = result?.pagination || { page: 1, pages: 1, total: incoming.length }
      if (filters.page === 1 && !incoming.length && filters.brand && !filters.category && !filters.query) {
        // Preserve access to real, published products that already exist in
        // the Brand World but have not entered the public retail catalog.
        try {
          const world = await getBrandWorld(filters.brand)
          if (!active) return
          incoming = brandWorldProducts(world)
          if (incoming.length) effectivePagination = { page: 1, pages: 1, total: incoming.length }
        } catch {
          // The catalog result remains the source of truth if unavailable.
        }
      }
      if (!active) return
      setProducts((previous) => {
        if (filters.page === 1) return incoming
        const seen = new Set(previous.map(productKey))
        return [...previous, ...incoming.filter((product) => {
          const key = productKey(product)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })]
      })
      setPagination(effectivePagination)
    }).catch((error) => {
      if (active) setProductsError(errorMessage(error))
    }).finally(() => {
      if (active) setProductsLoading(false)
    })
    return () => { active = false }
  }, [filters])

  const activeBrand = useMemo(() => brands.find((brand) => brandKey(brand) === filters.brand), [brands, filters.brand])
  const activeCategory = useMemo(() => categories.find((category) => category.slug === filters.category), [categories, filters.category])
  const firstBrands = brands.slice(0, 4)
  const moreBrands = brands.slice(4).map((brand) => ({ value: brandKey(brand), label: brandName(brand) }))
  const moreSelected = moreBrands.some((brand) => brand.value === filters.brand) ? filters.brand : ''
  const categoriesOptions = categories.map((category) => ({ value: category.slug, label: category.name }))
  const displayed = products.slice(0, visibleCount)
  const hasMore = visibleCount < products.length || filters.page < (Number(pagination?.pages) || 1)

  const suggestions = useMemo(() => {
    if (activeBrand) return [
      `Explore ${brandName(activeBrand)} products...`,
      `Find favourites from ${brandName(activeBrand)}...`,
      `Search within ${brandName(activeBrand)}...`,
    ]
    if (activeCategory) return [
      `Find ${activeCategory.name.toLowerCase()} from your favourite brands...`,
      `Discover ${activeCategory.name.toLowerCase()}...`,
      `Search ${activeCategory.name.toLowerCase()} by name...`,
    ]
    return ['Discover your favourite brands...', 'Search the everyday essentials...', 'Explore new products and makers...']
  }, [activeBrand, activeCategory])

  useEffect(() => {
    if (draftSearch || searchFocused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHint('')
      return undefined
    }
    let index = 0
    let position = 0
    let deleting = false
    let timer
    const tick = () => {
      const suggestion = suggestions[index]
      position = deleting ? Math.max(0, position - 1) : Math.min(suggestion.length, position + 1)
      setHint(suggestion.slice(0, position))
      let delay = deleting ? 40 : 65
      if (!deleting && position === suggestion.length) { deleting = true; delay = 1600 }
      if (deleting && position === 0) { deleting = false; index = (index + 1) % suggestions.length; delay = 260 }
      timer = window.setTimeout(tick, delay)
    }
    timer = window.setTimeout(tick, 250)
    return () => window.clearTimeout(timer)
  }, [draftSearch, searchFocused, suggestions])

  // Debounce typing so rapid keystrokes don't flood the public catalog API.
  useEffect(() => {
    const value = draftSearch.trim()
    if (value === filters.query) return undefined
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, query: value, page: 1 }))
      setVisibleCount(batch)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draftSearch, filters.query, batch])

  function chooseBrand(value) {
    setFilters((current) => ({ ...current, brand: value, page: 1 }))
    setVisibleCount(batch)
  }

  function chooseCategory(value) {
    setFilters((current) => ({ ...current, category: value, page: 1 }))
    setVisibleCount(batch)
  }

  function clearFilters() {
    setFilters({ brand: '', category: '', query: '', page: 1 })
    setDraftSearch('')
    setHeroSearch('')
    setVisibleCount(batch)
  }

  function scrollToCollection() {
    collectionRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  function submitHeroSearch(event) {
    event.preventDefault()
    setDraftSearch(heroSearch)
    setFilters((current) => ({ ...current, query: heroSearch.trim(), page: 1 }))
    setVisibleCount(batch)
    scrollToCollection()
  }

  function submitCollectionSearch(event) {
    event.preventDefault()
    setFilters((current) => ({ ...current, query: draftSearch.trim(), page: 1 }))
    setVisibleCount(batch)
  }

  function showMore() {
    if (productsLoading) return
    const next = visibleCount + batch
    setVisibleCount(next)
    if (next > products.length && filters.page < (Number(pagination?.pages) || 1)) {
      setFilters((current) => ({ ...current, page: current.page + 1 }))
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#202421]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Matching the approved Grocery / Recipes 100svh hero. */}
      <section className="relative flex h-[100svh] min-h-0 items-center overflow-hidden bg-[#F7F6F2] bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/hero/brand.png')" }} aria-labelledby="brands-hero-title">
        <div className="page-shell relative z-10 w-full">
          <div className="w-full max-w-[620px] border-l-[5px] border-[#173F35] bg-[#F7F6F2] px-5 py-6 text-[#202421] shadow-[0_14px_36px_rgba(32,36,33,0.15)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <p className="text-[14px] font-bold uppercase tracking-[0.14em] text-[#173F35]">Brands at EPANTRY</p>
            <h1 id="brands-hero-title" className="mt-3 text-[36px] font-semibold leading-[1.12] tracking-[-0.04em] text-[#202421] sm:text-[44px] lg:text-[56px]">
              A world of your favourites.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#202421]">Discover the makers behind the products you love.</p>
            <form role="search" aria-label="Search brand products" onSubmit={submitHeroSearch}
              className="mt-6 flex min-h-[52px] w-full items-center gap-2 rounded-[14px] border border-[#DCE0CF] bg-[#F7F6F2] p-1.5 focus-within:border-[#173F35]">
              <Search size={19} className="ml-2 shrink-0 text-[#173F35]" aria-hidden="true" />
              <label htmlFor="brands-hero-search" className="sr-only">Search brands and products</label>
              <input id="brands-hero-search" type="search" value={heroSearch} onChange={(event) => setHeroSearch(event.target.value)} placeholder="Search brands or products"
                className="min-w-0 flex-1 bg-transparent px-1 text-base text-[#202421] outline-none placeholder:text-[#202421]/60" />
              <button type="submit" className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[11px] bg-[#173F35] px-4 text-[15px] font-semibold text-[#F7F6F2] transition hover:bg-[#202421]">
                <span className="hidden sm:inline">Search brands</span><ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </form>
            {hostEnabled && (
              <Link to="/host/brands" className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-[#173F35] underline-offset-4 hover:underline">
                <ShieldCheck size={16} aria-hidden="true" /> Brand Authority Workspace <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        <button type="button" aria-label="Scroll down to explore brands" onClick={scrollToCollection}
          className="focus-ring absolute bottom-5 right-5 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent bg-[#F7F6F2] px-3.5 py-2.5 text-[14px] font-semibold text-[#173F35] shadow-[0_6px_22px_rgba(32,36,33,0.16)] transition-colors hover:border-[#173F35] focus-visible:border-[#173F35] sm:bottom-8 sm:right-8">
          <span className="hidden sm:inline">Scroll to explore</span><ArrowDown size={17} aria-hidden="true" />
        </button>
      </section>

      <section ref={collectionRef} className="scroll-mt-[70px] border-t border-[#DCE0CF] bg-[#F7F6F2] py-10 sm:py-14" aria-labelledby="brand-collection-heading">
        <div className="page-shell">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#173F35]">EPANTRY Brand Collection</p>
          <h2 id="brand-collection-heading" className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.04em] text-[#202421] sm:text-[36px]">Discover the makers.</h2>

          <div className="mt-7 rounded-[16px] border border-[#DCE0CF] bg-[#DCE0CF]/45 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-[#173F35]">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <h3 className="text-[15px] font-bold uppercase tracking-[0.08em]">Explore by brand</h3>
            </div>
            <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2">
              <button type="button" aria-pressed={!filters.brand} onClick={() => chooseBrand('')}
                className={`focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors ${!filters.brand ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2]' : 'border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]'}`}>All Brands</button>
              {firstBrands.map((brand) => (
                <button type="button" key={brandKey(brand)} aria-pressed={filters.brand === brandKey(brand)} onClick={() => chooseBrand(brandKey(brand))}
                  className={`focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors ${filters.brand === brandKey(brand) ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2]' : 'border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]'}`}>{brandName(brand)}</button>
              ))}
              {moreBrands.length > 0 && <AdaptiveSelect label="More brands…" value={moreSelected} options={moreBrands} onChange={chooseBrand} disabled={dictionaryLoading} />}
            </div>
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-[#173F35]/15 pt-3">
              <span className="mr-1 text-[14px] font-semibold text-[#173F35]">Product type</span>
              <AdaptiveSelect label="All categories" value={filters.category} options={categoriesOptions} onChange={chooseCategory} disabled={dictionaryLoading} />
              {(filters.brand || filters.category) && <button type="button" onClick={() => { setFilters((current) => ({ ...current, brand: '', category: '', page: 1 })); setVisibleCount(batch) }} className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border border-transparent px-3 text-[14px] font-semibold text-[#173F35] hover:border-[#173F35]"><RotateCcw size={15} aria-hidden="true" /> Reset filters</button>}
              {activeBrand && <Link to={`/brands/${encodeURIComponent(brandKey(activeBrand))}`} className="focus-ring ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-[#173F35] underline-offset-4 hover:underline">About {brandName(activeBrand)} <ArrowUpRight size={15} aria-hidden="true" /></Link>}
            </div>
          </div>

          <form role="search" aria-label="Search products in the brand collection" onSubmit={submitCollectionSearch} className="mt-4">
            <label className="flex min-h-[54px] items-center gap-3 rounded-[14px] border border-[#DCE0CF] bg-[#F7F6F2] px-4 transition-colors focus-within:border-[#173F35] focus-within:ring-2 focus-within:ring-[#173F35]/15">
              <Search size={21} className="shrink-0 text-[#173F35]" aria-hidden="true" />
              <span className="sr-only">Search products in selected brand</span>
              <input type="search" maxLength={150} value={draftSearch} onChange={(event) => { setDraftSearch(event.target.value); setVisibleCount(batch) }}
                onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder={hint || 'Search brand products...'}
                className="h-[52px] w-full min-w-0 flex-1 bg-transparent text-base text-[#202421] outline-none placeholder:text-[#202421]/60" />
              {draftSearch && <button type="button" onClick={() => { setDraftSearch(''); setHeroSearch(''); setFilters((current) => ({ ...current, query: '', page: 1 })); setVisibleCount(batch) }} aria-label="Clear brand search"
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#DCE0CF] text-[#173F35] hover:bg-[#173F35] hover:text-[#F7F6F2]"><X size={17} aria-hidden="true" /></button>}
            </label>
          </form>

          {dictionaryError && <div role="alert" className="mt-5 flex items-center gap-2 rounded-[12px] border border-[#C86C42] bg-[#F7F6F2] p-4 text-sm text-[#202421]">
            <CircleAlert size={18} className="shrink-0 text-[#C86C42]" />{dictionaryError}
            <button type="button" onClick={() => setReload((value) => value + 1)} className="ml-auto shrink-0 text-[#173F35] underline underline-offset-4">Retry</button>
          </div>}
          {productsError && <div role="alert" className="mt-5 flex items-center gap-2 rounded-[12px] border border-[#C86C42] bg-[#F7F6F2] p-4 text-sm text-[#202421]">
            <CircleAlert size={18} className="shrink-0 text-[#C86C42]" />{productsError}
            <button type="button" onClick={() => setFilters((current) => ({ ...current }))} className="ml-auto shrink-0 text-[#173F35] underline underline-offset-4">Retry</button>
          </div>}

          {productsLoading && products.length === 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5" role="status" aria-label="Loading brand products">
              {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/3] animate-pulse rounded-[16px] bg-[#DCE0CF] lg:aspect-[3/2]" />)}
            </div>
          ) : !productsError && displayed.length ? (
            <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5" aria-live="polite">
              {displayed.map((product) => <BrandProductTile key={productKey(product)} product={product} />)}
            </div>
          ) : !productsLoading && !productsError ? (
            <div className="mt-8 rounded-[16px] border border-dashed border-[#173F35]/30 bg-[#DCE0CF]/45 px-6 py-12 text-center">
              <EmptyState title="No matching products" description="Try another brand, product type or search." />
              {(filters.brand || filters.category || filters.query) && <button type="button" onClick={clearFilters} className="focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173F35] px-5 text-[15px] font-semibold text-[#F7F6F2]"><RotateCcw size={16} aria-hidden="true" /> Clear filters</button>}
            </div>
          ) : null}

          {!productsError && hasMore && <div className="mt-8 flex justify-center border-t border-[#DCE0CF] pt-7">
            <button type="button" onClick={showMore} disabled={productsLoading}
              className="focus-ring inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#173F35] px-8 text-[15px] font-bold text-[#F7F6F2] transition hover:bg-[#202421] disabled:opacity-60">
              {productsLoading ? 'Loading products…' : 'View all · Show more products'} <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>}
          {productsLoading && products.length > 0 && <p role="status" className="mt-3 text-center text-[14px] text-[#173F35]">Loading more products…</p>}
          {Number(pagination.total) > 0 && <p className="sr-only">Showing {displayed.length} of {pagination.total} published products.</p>}
        </div>
      </section>
    </main>
  )
}
