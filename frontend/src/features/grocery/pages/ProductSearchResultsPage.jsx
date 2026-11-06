import {
  ArrowLeft,
  ArrowRight,
  CookingPot,
  MapPin,
  Package,
  Search,
  Store,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
  useSearchParams,
} from 'react-router-dom'

import {
  getCatalogCategoryProducts,
  getCatalogProduct,
  getCatalogProducts,
} from '../services/catalog.service'

import {
  getSearchErrorMessage,
  runSmartSearch,
} from '../../search/services/search.service'

import {
  openAvailabilityNotifyModal,
} from '../../notifications/components/AvailabilityNotifyModal'

import SponsoredCampaignSlot from '../../retailMedia/components/SponsoredCampaignSlot'
import { getPublicPackOffers } from '../../marketplace/services/marketplace.service'
import { useLocationStore } from '../../location/store/location.store'

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeCompareValue(value) {
  return normalizeString(value).toLowerCase()
}

function extractProductSlug(path) {
  const normalizedPath = normalizeString(path)
  const prefix = '/grocery/product/'

  if (!normalizedPath.startsWith(prefix)) {
    return ''
  }

  const encodedSlug = normalizedPath
    .slice(prefix.length)
    .split(/[?#]/)[0]

  if (!encodedSlug) {
    return ''
  }

  try {
    return decodeURIComponent(encodedSlug)
  } catch {
    return encodedSlug
  }
}

function getProductKey(product) {
  return normalizeString(
    product?.productVersionId ||
      product?.id ||
      product?.slug,
  )
}

function getProductPath(product) {
  const slug = normalizeString(product?.slug)

  if (!slug) {
    return '/grocery'
  }

  return `/grocery/product/${encodeURIComponent(slug)}`
}

function formatQuantity(quantity) {
  if (
    !quantity ||
    quantity.value === undefined ||
    quantity.value === null
  ) {
    return ''
  }

  return `${quantity.value} ${quantity.unit || ''}`.trim()
}

function getCanonicalPackId(product) {
  return normalizeString(
    product?.pack?.id ||
      product?.pack?._id ||
      product?.packId ||
      product?.canonicalPackId,
  )
}

function readVerifiedPin(location) {
  const postcode = normalizeString(location?.postcode).replace(/\s/g, '')
  return /^\d{6}$/.test(postcode) ? postcode : ''
}

function getEffectivePriceMinor(offer) {
  const amount = offer?.price?.effectiveAmountMinor
  const numeric = Number(amount)
  return amount !== null && amount !== undefined && Number.isFinite(numeric) && numeric >= 0
    ? numeric
    : null
}

function sortEligibleOffers(offers) {
  return (Array.isArray(offers) ? offers : [])
    .filter((offer) => offer?.id && getEffectivePriceMinor(offer) !== null)
    .sort((left, right) => {
      const priceDifference = getEffectivePriceMinor(left) - getEffectivePriceMinor(right)
      if (priceDifference !== 0) return priceDifference
      return normalizeString(left?.seller?.name).localeCompare(normalizeString(right?.seller?.name))
    })
}

function formatOfferPrice(offer) {
  const amount = getEffectivePriceMinor(offer)
  if (amount === null) return ''
  const currency = normalizeString(offer?.price?.currency || 'INR')
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(amount / 100)
  } catch {
    return `₹${(amount / 100).toFixed(2)}`
  }
}

function mergeUniqueProducts({
  primaryProduct,
  groups,
  limit = 9,
}) {
  const primaryKey = getProductKey(primaryProduct)
  const seen = new Set()

  if (primaryKey) {
    seen.add(primaryKey)
  }

  const merged = []

  for (const group of groups) {
    for (const product of group || []) {
      const key = getProductKey(product)

      if (!key || seen.has(key)) {
        continue
      }

      seen.add(key)
      merged.push(product)

      if (merged.length >= limit) {
        return merged
      }
    }
  }

  return merged
}

function choosePrimaryResult(results, query) {
  if (!Array.isArray(results) || results.length === 0) {
    return null
  }

  const normalizedQuery = normalizeCompareValue(query)

  const exactMatch = results.find(
    (result) =>
      normalizeCompareValue(result?.displayName) === normalizedQuery,
  )

  if (exactMatch) {
    return exactMatch
  }

  const startsWithMatch = results.find(
    (result) =>
      normalizeCompareValue(result?.displayName).startsWith(normalizedQuery),
  )

  return startsWithMatch || results[0]
}

function getResultKey(result) {
  return `${normalizeString(result?.type)}:${normalizeString(
    result?.id || result?.path || result?.displayName,
  )}`
}

function getResultVisual(type) {
  if (type === 'recipe') {
    return {
      Icon: CookingPot,
      surface: 'bg-[#FFF1A8]',
      iconSurface: 'bg-[#F7D9C4] text-[#713C17]',
      label: 'Recipe',
    }
  }

  if (type === 'brand') {
    return {
      Icon: Store,
      surface: 'bg-[#E9E1FF]',
      iconSurface: 'bg-[#DDEEFF] text-[#173F35]',
      label: 'Brand',
    }
  }

  return {
    Icon: Package,
    surface: 'bg-[#DCE0CF]',
    iconSurface: 'bg-[#F7F6F2] text-[#173F35]',
    label: 'Product',
  }
}

const SEARCH_STEPS = [
  ['01', 'Closest match'],
  ['02', 'Compare Hosts'],
  ['03', 'Explore products'],
  ['04', 'View details'],
]

function SearchJourney() {
  return (
    <ol
      aria-label="Search results guide"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[#DCE3DA] py-3 sm:gap-x-8"
    >
      {SEARCH_STEPS.map(([number, label]) => (
        <li key={number} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[13px] font-bold tabular-nums text-[#A75F40]">{number}</span>
          <span className="text-[13px] font-semibold text-[#365447] sm:text-[14px]">{label}</span>
        </li>
      ))}
    </ol>
  )
}

function RelatedResultRow({ result }) {
  const visual = getResultVisual(result?.type)
  const Icon = visual.Icon
  const name = result?.displayName || 'EPANTRY item'

  return (
    <article className="group min-w-0 border-b border-[#DCE3DA] transition-colors hover:bg-[#F0F4ED] focus-within:bg-[#F0F4ED]">
      <Link
        to={result?.path || '/'}
        aria-label={`View details for ${name}`}
        className="focus-ring flex min-h-[96px] items-center gap-3 px-2 py-3 sm:px-3"
      >
        <span className="grid size-[70px] shrink-0 place-items-center bg-[#E8EEE5] text-[#173F35] sm:size-[78px]">
          <Icon size={33} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[13px] font-medium text-[#6A776E]">{visual.label}</span>
          <span className="line-clamp-2 text-[16px] font-bold leading-[1.35] text-[#202421]">{name}</span>
          {result?.subtitle ? <span className="line-clamp-1 text-[13px] text-[#617166]">{result.subtitle}</span> : null}
        </span>
        <ArrowRight size={18} strokeWidth={1.8} className="shrink-0 text-[#173F35] transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
      </Link>
    </article>
  )
}

function SimilarProductRow({ product }) {
  const imageUrl = normalizeString(product?.image?.url)
  const name = product?.displayName || 'Unnamed product'
  const quantity = formatQuantity(product?.netQuantity)
  const path = getProductPath(product)

  return (
    <article className="group min-w-0 border-b border-[#DCE3DA] transition-colors hover:bg-[#F0F4ED] focus-within:bg-[#F0F4ED]">
      <Link
        to={path}
        aria-label={`View ${name}`}
        className="focus-ring flex min-h-[96px] items-center gap-3 px-2 py-3 sm:px-3"
      >
        <span className="flex size-[74px] shrink-0 items-center justify-center bg-[#E8EEE5] p-1.5 sm:size-[84px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product?.image?.alt || name}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
            />
          ) : (
            <Package size={32} strokeWidth={1.5} className="text-[#486759]" aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-1 text-[13px] font-medium text-[#65746A]">{product?.brand?.name || 'Fresh produce'}</span>
          <span className="line-clamp-2 text-[16px] font-bold leading-[1.35] text-[#202421]">{name}</span>
          {product?.category?.name || quantity ? (
            <span className="line-clamp-1 text-[13px] text-[#617166]">
              {[product?.category?.name, quantity].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </span>
        <ArrowRight size={18} strokeWidth={1.8} className="shrink-0 text-[#173F35] transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
      </Link>
    </article>
  )
}

export default function ProductSearchResultsPage() {
  const [searchParams] = useSearchParams()

  const query = normalizeString(searchParams.get('q'))

  const [primaryResult, setPrimaryResult] = useState(null)
  const [primaryProduct, setPrimaryProduct] = useState(null)
  const [relatedResults, setRelatedResults] = useState([])
  const [similarProducts, setSimilarProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const currentLocation = useLocationStore((state) => state.currentLocation)
  const detectedPin = readVerifiedPin(currentLocation)
  const [manualPinDraft, setManualPinDraft] = useState('')
  const [manualPin, setManualPin] = useState('')
  const [pinError, setPinError] = useState('')
  const deliveryPin = manualPin || detectedPin
  const [offerState, setOfferState] = useState({ status: 'idle', offers: [], error: '' })

  useEffect(
    () => {
      let active = true

      async function loadSearchResult() {
        setLoading(true)
        setError('')
        setPrimaryResult(null)
        setPrimaryProduct(null)
        setRelatedResults([])
        setSimilarProducts([])

        if (query.length < 2) {
          setError('Enter at least 2 characters to search EPANTRY.')
          setLoading(false)
          return
        }

        try {
          const searchData = await runSmartSearch({
            query,
            mode: 'all',
          })

          const results = Array.isArray(searchData?.results)
            ? searchData.results.filter(
                (result) =>
                  Boolean(result?.path) &&
                  !String(result.path).startsWith('/search'),
              )
            : []

          const bestMatch = choosePrimaryResult(results, query)

          if (!bestMatch) {
            if (active) {
              setError('No matching product, recipe or brand was found.')

              openAvailabilityNotifyModal({
                query,
                displayName:
                  query,
                source:
                  'search',
              })
            }
            return
          }

          if (!active) {
            return
          }

          setPrimaryResult(bestMatch)

          const bestKey = getResultKey(bestMatch)

          const sameTypeResults = results.filter(
            (result) =>
              getResultKey(result) !== bestKey &&
              result?.type === bestMatch?.type,
          )

          const otherResults = results.filter(
            (result) =>
              getResultKey(result) !== bestKey &&
              result?.type !== bestMatch?.type,
          )

          setRelatedResults(
            [...sameTypeResults, ...otherResults].slice(0, 12),
          )

          if (
            bestMatch?.type !== 'product' ||
            !normalizeString(bestMatch?.path).startsWith('/grocery/product/')
          ) {
            return
          }

          const resolvedSlug = extractProductSlug(bestMatch.path)

          if (!resolvedSlug) {
            return
          }

          const productResult = await getCatalogProduct(resolvedSlug)
          const product = productResult?.product || null

          if (!active || !product) {
            return
          }

          setPrimaryProduct(product)

          const categorySlug = normalizeString(product?.category?.slug)
          const categoryName = normalizeCompareValue(product?.category?.name)
          const brandName = normalizeCompareValue(product?.brand?.name)

          const [
            categorySettled,
            querySettled,
            catalogSettled,
          ] = await Promise.allSettled([
            categorySlug
              ? getCatalogCategoryProducts({
                  categorySlug,
                  page: 1,
                  limit: 18,
                })
              : Promise.resolve({ products: [] }),
            getCatalogProducts({
              page: 1,
              limit: 18,
              search: query,
            }),
            getCatalogProducts({
              page: 1,
              limit: 36,
            }),
          ])

          if (!active) {
            return
          }

          const categoryProducts =
            categorySettled.status === 'fulfilled'
              ? categorySettled.value?.products || []
              : []

          const queryProducts =
            querySettled.status === 'fulfilled'
              ? querySettled.value?.products || []
              : []

          const catalogProducts =
            catalogSettled.status === 'fulfilled'
              ? catalogSettled.value?.products || []
              : []

          const sameCategoryFallback = categoryName
            ? catalogProducts.filter(
                (item) =>
                  normalizeCompareValue(item?.category?.name) === categoryName,
              )
            : []

          const sameBrandFallback = brandName
            ? catalogProducts.filter(
                (item) =>
                  normalizeCompareValue(item?.brand?.name) === brandName,
              )
            : []

          setSimilarProducts(
            mergeUniqueProducts({
              primaryProduct: product,
              groups: [
                categoryProducts,
                queryProducts,
                sameCategoryFallback,
                sameBrandFallback,
                catalogProducts,
              ],
              limit: 9,
            }),
          )
        } catch (nextError) {
          if (active) {
            setError(
              getSearchErrorMessage(
                nextError,
                'Unable to load search results right now.',
              ),
            )
          }
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      }

      void loadSearchResult()

      return () => {
        active = false
      }
    },
    [query],
  )

  const canonicalPackId = getCanonicalPackId(primaryProduct)
  const fulfillmentType = primaryProduct?.isHostListing &&
    primaryProduct?.hostSubmission?.fulfillmentType === 'pickup'
    ? 'pickup'
    : 'delivery'

  // Pricing is based on this exact canonical pack and an eligible Host offer,
  // not on matching product names or unchecked Host-declared prices.
  useEffect(() => {
    let active = true

    if (!canonicalPackId) {
      setOfferState({ status: 'idle', offers: [], error: '' })
      return () => { active = false }
    }

    if (!/^\d{6}$/.test(deliveryPin)) {
      setOfferState({ status: 'pin_required', offers: [], error: '' })
      return () => { active = false }
    }

    setOfferState({ status: 'loading', offers: [], error: '' })
    getPublicPackOffers({
      packId: canonicalPackId,
      pincode: deliveryPin,
      fulfillmentType,
    }).then((data) => {
      if (!active) return
      setOfferState({
        status: 'ready',
        offers: sortEligibleOffers(data?.offers),
        error: '',
      })
    }).catch(() => {
      if (!active) return
      setOfferState({
        status: 'error',
        offers: [],
        error: 'Host prices could not be checked. Try another PIN or check the product page.',
      })
    })

    return () => { active = false }
  }, [canonicalPackId, deliveryPin, fulfillmentType])

  function handlePinSubmit(event) {
    event.preventDefault()
    const entered = normalizeString(manualPinDraft).replace(/\s/g, '')
    if (!/^\d{6}$/.test(entered)) {
      setPinError('Enter a valid 6-digit PIN code.')
      return
    }
    setPinError('')
    setManualPin(entered)
  }

  const priceOffers = offerState.status === 'ready' ? offerState.offers : []
  const cheapestOffer = priceOffers[0] || null
  const otherHostOffers = priceOffers.slice(1)

  const primaryQuantity = useMemo(
    () => formatQuantity(primaryProduct?.netQuantity),
    [primaryProduct?.netQuantity],
  )

  const primaryVisual = getResultVisual(primaryResult?.type)
  const PrimaryIcon = primaryVisual.Icon

  const primaryTitle =
    primaryProduct?.displayName ||
    primaryResult?.displayName ||
    'EPANTRY result'

  const primarySubtitle =
    primaryProduct?.brand?.name ||
    primaryResult?.subtitle ||
    ''

  const primaryPath = primaryResult?.path || '/grocery'

  const showProductSimilarity =
    primaryResult?.type === 'product' && similarProducts.length > 0

  if (loading) {
    return (
      <main className="bg-[#F7F6F2] px-4 py-6 sm:px-7" aria-busy="true">
        <div className="mx-auto max-w-[1320px] animate-pulse">
          <div className="h-8 w-52 bg-[#DCE0CF]" />
          <div className="mt-6 h-8 w-80 max-w-full bg-[#E5EBE2]" />
          <div className="mt-6 grid min-h-[250px] gap-px bg-[#E2E6DD] md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
            <div className="bg-[#E8EEE5]" />
            <div className="bg-[#F4F4EE]" />
          </div>
          <div className="mt-6 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="mb-2 h-24 bg-[#E8EEE5]" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (error || !primaryResult) {
    return (
      <main className="bg-[#F7F6F2] px-4 py-8 sm:px-7" style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}>
        <section className="mx-auto max-w-[920px] border-t-[3px] border-[#173F35] bg-[#EDF1E9] px-5 py-8 sm:px-9">
          <Search size={29} strokeWidth={1.6} className="text-[#173F35]" aria-hidden="true" />
          <h1 className="mt-3 !text-[26px] !font-bold !leading-[1.2] text-[#173F35] sm:!text-[32px]">We couldn't find a close match</h1>
          <p className="mt-2 text-[15px] leading-[1.55] text-[#435649] sm:text-[16px]">{error || 'Try another product, recipe or brand name.'}</p>
          <Link to="/grocery" className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 bg-[#173F35] px-5 text-[15px] font-bold text-[#F7F6F2] hover:bg-[#245547]">
            <ArrowLeft size={17} aria-hidden="true" /> Explore grocery
          </Link>
        </section>
      </main>
    )
  }

  const primaryActionLabel =
    primaryResult?.type === 'recipe'
      ? 'View recipe'
      : primaryResult?.type === 'brand'
        ? 'View brand'
        : 'View product'

  const alternativeCount = showProductSimilarity
    ? similarProducts.length
    : relatedResults.length

  return (
    <main
      className="bg-[#F7F6F2] pb-8 pt-2 text-[#202421] sm:pb-10"
      style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-7 lg:px-9">
        <nav className="flex min-h-11 items-center justify-between gap-3 border-b border-[#DCE3DA]" aria-label="Search results navigation">
          <Link to="/" className="focus-ring inline-flex min-h-10 items-center gap-2 text-[14px] font-semibold text-[#173F35] hover:text-[#A75F40]">
            <ArrowLeft size={17} aria-hidden="true" /> Back
          </Link>
          <span className="max-w-[60%] truncate text-right text-[13px] text-[#617166]">Results for <strong className="font-semibold text-[#173F35]">{query}</strong></span>
        </nav>

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3 pt-5 sm:pt-6">
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-semibold text-[#A75F40]">Search results</span>
            <h1 className="mt-1 break-words !text-[28px] !font-bold !leading-[1.16] text-[#173F35] sm:!text-[35px]">{query}</h1>
          </div>
          <p className="text-[14px] text-[#5C6C61]">{alternativeCount} more {alternativeCount === 1 ? 'result' : 'results'} to explore</p>
        </header>

        <SearchJourney />
        <SponsoredCampaignSlot placement="search" slotKey="search_top" embedded />

        <section className="mt-5 sm:mt-6" aria-labelledby="ep-search-best-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="!text-[22px] !font-bold !leading-[1.25] text-[#173F35] sm:!text-[25px]">Best match</h2>
            <span className="text-[13px] font-medium text-[#6C7A6F]">Closest result for your search</span>
          </div>

          <div className="grid grid-cols-[minmax(118px,0.78fr)_minmax(0,1.22fr)] overflow-hidden border-y border-[#DCE3DA] bg-[#FBFAF6] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(270px,0.85fr)]">
            <div className="relative flex min-h-[190px] items-center justify-center bg-[#E8EEE5] px-3 py-4 sm:min-h-[244px] sm:px-5 lg:min-h-[260px]">
              <span className="absolute left-3 top-2 text-[12px] font-semibold sm:left-4 sm:top-3 sm:text-[13px] text-[#365447]">Top result</span>
              {primaryProduct?.image?.url ? (
                <img
                  src={primaryProduct.image.url}
                  alt={primaryProduct?.image?.alt || primaryTitle}
                  className="max-h-[153px] w-full max-w-[315px] object-contain sm:max-h-[226px] lg:max-h-[240px]"
                />
              ) : (
                <span className="grid size-24 place-items-center text-[#173F35]">
                  <PrimaryIcon size={49} strokeWidth={1.5} aria-hidden="true" />
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-col justify-center px-3 py-4 sm:px-7 sm:py-5 lg:py-6">
              <span className="text-[13px] font-medium text-[#A75F40]">{primaryProduct?.category?.name || primaryVisual.label}</span>
              <h3 id="ep-search-best-title" className="mt-1 break-words !text-[22px] !font-bold !leading-[1.17] text-[#173F35] sm:!text-[32px]">{primaryTitle}</h3>
              {primaryQuantity || primarySubtitle ? (
                <p className="mt-3 text-[14px] leading-[1.5] text-[#536558]">
                  {[primaryQuantity ? `Pack ${primaryQuantity}` : '', primarySubtitle].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              <p className="mt-3 hidden max-w-sm text-[14px] leading-[1.5] text-[#586A5D] sm:block">{primaryResult?.type === 'product' ? 'Compare available Hosts and choose what works for you.' : 'Explore full details before you decide.'}</p>
            </div>

            <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-[#DCE3DA] px-4 py-4 sm:px-7 lg:col-span-1 lg:flex-col lg:items-start lg:justify-center lg:border-l lg:border-t-0 lg:py-6">
              {cheapestOffer ? (
                <div className="min-w-0 flex-1 lg:flex-none">
                  <span className="text-[13px] font-semibold text-[#536558]">Lowest available Host price</span>
                  <strong className="mt-1 block text-[34px] font-bold leading-[1.15] tabular-nums text-[#173F35] sm:text-[40px]">{formatOfferPrice(cheapestOffer)}</strong>
                  <p className="mt-1 text-[14px] font-semibold text-[#202421]">{cheapestOffer.seller?.name || 'Marketplace Host'}</p>
                  <p className="mt-1 text-[13px] text-[#677569]">Available for PIN {deliveryPin}</p>
                </div>
              ) : (
                <div className="min-w-0 flex-1 lg:flex-none">
                  <span className="text-[13px] font-semibold text-[#536558]">Availability</span>
                  <p className="mt-2 text-[15px] leading-[1.5] text-[#43574B]" role={offerState.status === 'loading' || offerState.status === 'error' ? 'status' : undefined}>
                    {primaryResult.type === 'product' && canonicalPackId
                      ? offerState.status === 'pin_required'
                        ? 'Enter your delivery PIN to compare Host prices.'
                        : offerState.status === 'loading'
                          ? `Checking available Hosts for ${deliveryPin}…`
                          : offerState.status === 'error'
                            ? offerState.error
                            : offerState.status === 'ready'
                              ? `No eligible ${fulfillmentType} offers for PIN ${deliveryPin}.`
                              : 'See the full product information.'
                      : 'Open the full details to learn more.'}
                  </p>
                </div>
              )}
              <Link to={primaryPath} className="focus-ring inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-[#173F35] lg:mt-4 px-5 text-[14px] font-bold text-[#F7F6F2] transition-colors hover:bg-[#285747]">
                {primaryActionLabel} <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {primaryResult.type === 'product' && canonicalPackId ? (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[#DCE3DA] bg-[#F1F4EE] px-3 py-2.5 sm:px-5">
              <p className="inline-flex items-center gap-2 text-[13px] font-medium text-[#425A4C]">
                <MapPin size={16} aria-hidden="true" />
                {deliveryPin ? `Delivery PIN ${deliveryPin}` : 'Set a delivery PIN to check offers'}
                {offerState.status === 'ready' ? ` · ${priceOffers.length} eligible ${priceOffers.length === 1 ? 'Host' : 'Hosts'}` : ''}
              </p>
              <form onSubmit={handlePinSubmit} className="flex min-w-0 flex-wrap items-center gap-2">
                <label htmlFor="search-offer-pin" className="text-[13px] font-semibold text-[#173F35]">Change PIN</label>
                <input
                  id="search-offer-pin"
                  value={manualPinDraft}
                  onChange={(event) => {
                    setManualPinDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 6))
                    setPinError('')
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  placeholder={deliveryPin || '6-digit PIN'}
                  aria-invalid={Boolean(pinError)}
                  aria-describedby={pinError ? 'search-offer-pin-error' : undefined}
                  className="min-h-11 w-[110px] border border-[#BCCBBE] bg-[#FBFAF6] px-3 text-[14px] text-[#173F35] placeholder:text-[#718073]"
                />
                <button type="submit" className="focus-ring min-h-11 bg-[#173F35] px-4 text-[14px] font-bold text-[#F7F6F2] hover:bg-[#285747]">Update</button>
                {pinError ? <span id="search-offer-pin-error" className="basis-full text-[13px] text-[#A34B35]" role="alert">{pinError}</span> : null}
              </form>
            </div>
          ) : null}
        </section>

        {otherHostOffers.length > 0 ? (
          <section className="mt-6 sm:mt-7" aria-labelledby="ep-search-other-hosts-title">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-[#A75F40]">Compare sellers</p>
                <h2 id="ep-search-other-hosts-title" className="mt-1 !text-[22px] !font-bold !leading-[1.25] text-[#173F35] sm:!text-[25px]">Same product, more Hosts</h2>
              </div>
              <span className="text-[13px] text-[#617166]">{otherHostOffers.length} more {otherHostOffers.length === 1 ? 'offer' : 'offers'} · lowest price first</span>
            </div>
            <div className="border-t border-[#D3DDD2]">
              {otherHostOffers.map((offer) => (
                <div key={offer.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#D3DDD2] px-3 py-3 transition-colors hover:bg-[#F0F4ED] sm:px-4">
                  <span className="grid size-10 shrink-0 place-items-center bg-[#E8EEE5] text-[#173F35]"><Store size={20} strokeWidth={1.6} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold text-[#202421]">{offer.seller?.name || 'Marketplace Host'}</p>
                    <p className="mt-0.5 text-[13px] text-[#617166]">{primaryTitle}{primaryQuantity ? ` · ${primaryQuantity}` : ''}</p>
                  </div>
                  <strong className="text-[21px] font-bold tabular-nums text-[#173F35]">{formatOfferPrice(offer)}</strong>
                  <Link to={primaryPath} className="focus-ring inline-flex min-h-11 items-center gap-2 text-[14px] font-bold text-[#173F35] hover:text-[#A75F40]">
                    View offer <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-[#617166]">Offers depend on delivery eligibility. Final seller selection happens on the product page.</p>
          </section>
        ) : null}

        <SponsoredCampaignSlot placement="search" slotKey="search_best_match" embedded />
        <SponsoredCampaignSlot placement="search" slotKey="search_more_options" embedded />

        <section className="mt-6 sm:mt-8" aria-labelledby="ep-search-alternatives-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[#A75F40]">More to explore</p>
              <h2 id="ep-search-alternatives-title" className="mt-1 !text-[23px] !font-bold !leading-[1.25] text-[#173F35] sm:!text-[27px]">
                {showProductSimilarity ? 'Other products' : 'More search results'}
              </h2>
            </div>
            <span className="text-[14px] font-medium text-[#526558]">{alternativeCount} {alternativeCount === 1 ? 'result' : 'results'}</span>
          </div>

          {showProductSimilarity ? (
            <div className="grid gap-x-7 border-t border-[#CAD6CC] sm:grid-cols-2 xl:grid-cols-3">
              {similarProducts.map((product) => (
                <SimilarProductRow key={getProductKey(product)} product={product} />
              ))}
            </div>
          ) : relatedResults.length > 0 ? (
            <div className="grid gap-x-7 border-t border-[#CAD6CC] sm:grid-cols-2 xl:grid-cols-3">
              {relatedResults.map((result) => (
                <RelatedResultRow key={getResultKey(result)} result={result} />
              ))}
            </div>
          ) : (
            <div className="border-t border-[#CAD6CC] bg-[#F0F4ED] px-4 py-5">
              <p className="text-[16px] font-semibold text-[#173F35]">No other products found right now.</p>
              <Link to={primaryPath} className="focus-ring mt-2 inline-flex min-h-11 items-center gap-2 text-[14px] font-bold text-[#173F35]">
                {primaryActionLabel} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
