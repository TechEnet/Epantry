import {
  ArrowLeft,
  ArrowRight,
  CircleCheckBig,
  CookingPot,
  Layers3,
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
      surface: 'bg-[#fff5e8]',
      iconSurface: 'bg-[#f7c98f] text-[#713c17]',
      badge: 'bg-[#7c421d] text-white',
      border: 'border-[#ebcfaa]',
    }
  }

  if (type === 'brand') {
    return {
      Icon: Store,
      surface: 'bg-[#f0f2ff]',
      iconSurface: 'bg-[#d9ddff] text-[#354b82]',
      badge: 'bg-[#405b91] text-white',
      border: 'border-[#d5daf0]',
    }
  }

  return {
    Icon: Package,
    surface: 'bg-[#eef7ea]',
    iconSurface: 'bg-[#d4ead2] text-[#175339]',
    badge: 'bg-[#175339] text-white',
    border: 'border-[#cddfc9]',
  }
}

function SearchStepCard({
  number,
  Icon,
  title,
  description,
  surface,
}) {
  return (
    <div
      className={`flex min-h-[78px] flex-col rounded-[16px] border border-white/70 ${surface} p-2.5 shadow-[0_6px_16px_rgba(31,41,55,0.045)] sm:min-h-[88px] sm:rounded-[18px] sm:p-3`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-white/90 text-[9px] font-black text-stone-700 shadow-sm sm:size-7 sm:text-[10px]">
          {number}
        </span>

        <Icon
          size={14}
          aria-hidden="true"
          className="text-stone-600 sm:size-4"
        />
      </div>

      <p className="mt-2 text-[10px] font-black leading-[1.12] tracking-[-0.015em] text-stone-950 sm:text-[11px]">
        {title}
      </p>

      <p className="mt-1 line-clamp-2 text-[8px] font-semibold leading-[1.35] text-stone-600 sm:text-[9px]">
        {description}
      </p>
    </div>
  )
}

function RelatedResultCard({ result }) {
  const visual = getResultVisual(result?.type)
  const Icon = visual.Icon

  return (
    <Link
      to={result?.path || '/'}
      className={`focus-ring group flex min-h-[142px] flex-col rounded-[18px] border ${visual.border} ${visual.surface} p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(28,25,23,0.07)] motion-reduce:transform-none sm:min-h-[158px] sm:rounded-[20px] sm:p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`grid size-8 shrink-0 place-items-center rounded-xl ${visual.iconSurface} sm:size-9`}>
          <Icon size={16} aria-hidden="true" />
        </div>

        <span className={`rounded-full px-2 py-1 text-[7px] font-black uppercase tracking-[0.11em] sm:text-[8px] ${visual.badge}`}>
          {result?.type || 'item'}
        </span>
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="line-clamp-2 text-[12px] font-black leading-[1.18] tracking-[-0.02em] text-stone-950 sm:text-[14px]">
          {result?.displayName || 'EPANTRY item'}
        </h3>

        {result?.subtitle ? (
          <p className="mt-1.5 line-clamp-2 text-[9px] font-semibold leading-[1.45] text-stone-600 sm:text-[10px]">
            {result.subtitle}
          </p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[9px] font-black text-stone-700 transition group-hover:text-[#175339] sm:text-[10px]">
          View details
          <ArrowRight size={12} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

function SimilarProductCard({ product }) {
  const imageUrl = normalizeString(product?.image?.url)
  const productPath = getProductPath(product)
  const quantity = formatQuantity(product?.netQuantity)

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#d9e3d5] bg-[#f3f8ef] shadow-[0_8px_22px_rgba(29,70,44,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-[#a7c3a8] hover:shadow-[0_14px_30px_rgba(29,70,44,0.08)] motion-reduce:transform-none sm:rounded-[20px]">
      <Link
        to={productPath}
        className="focus-ring m-2.5 block h-[112px] overflow-hidden rounded-[14px] border border-white/80 bg-white/82 sm:m-3 sm:h-[150px] sm:rounded-[16px]"
        aria-label={`View ${product?.displayName || 'product'}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.image?.alt || product?.displayName || 'Product'}
            className="h-full w-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none sm:p-3"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#78a184]">
            <Package size={32} strokeWidth={1.4} aria-hidden="true" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-[8px] font-black uppercase tracking-[0.11em] text-[#477252] sm:text-[9px]">
            {product?.brand?.name || product?.category?.name || 'EPANTRY'}
          </p>

          {quantity ? (
            <span className="shrink-0 rounded-full bg-white/85 px-2 py-1 text-[7px] font-bold text-stone-500 sm:text-[8px]">
              {quantity}
            </span>
          ) : null}
        </div>

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.35em] text-[11px] font-black leading-[1.18] tracking-[-0.02em] text-stone-950 sm:text-[13px]">
          {product?.displayName || 'Unnamed product'}
        </h3>

        {product?.category?.name ? (
          <p className="mt-1 truncate text-[8px] font-semibold text-stone-500 sm:text-[9px]">
            {product.category.name}
          </p>
        ) : null}

        <Link
          to={productPath}
          className="focus-ring mt-3 inline-flex w-full items-center justify-between gap-2 rounded-[12px] bg-[#175339] px-3 py-2 text-[9px] font-black text-white transition hover:bg-[#0f432d] sm:text-[10px]"
        >
          View product
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
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
      <main className="min-h-[72svh] bg-[#f7f7f1] px-2 pb-7 pt-2 sm:px-4 lg:px-6">
        <div className="mx-auto max-w-[1460px]">
          <div className="h-[120px] animate-pulse rounded-[22px] bg-white shadow-sm sm:h-[132px]" />
          <div className="mt-3 h-[230px] animate-pulse rounded-[22px] bg-white shadow-sm sm:h-[260px]" />
          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[210px] animate-pulse rounded-[18px] bg-white shadow-sm sm:h-[250px]"
              />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (error || !primaryResult) {
    return (
      <main className="min-h-[72svh] bg-[#f7f7f1] px-3 pb-8 pt-2 sm:px-5 lg:px-7">
        <section className="mx-auto max-w-2xl rounded-[24px] border border-stone-200 bg-white p-5 text-center shadow-[0_14px_34px_rgba(28,25,23,0.06)] sm:p-7">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e8f4e8] text-[#1b5a3d]">
            <Search size={22} aria-hidden="true" />
          </div>

          <h1 className="mt-4 text-xl font-black tracking-[-0.03em] text-stone-950 sm:text-2xl">
            No close match found
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-stone-600 sm:text-sm">
            {error || 'Try another product, recipe or brand name.'}
          </p>

          <Link
            to="/grocery"
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-[#175339] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#0f3f2b]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Browse grocery
          </Link>
        </section>
      </main>
    )
  }

  const stepCards = [
    {
      number: '1',
      Icon: Search,
      title: 'Best match first',
      description: 'Start with the closest result.',
      surface: 'bg-[#dcf7ef]',
    },
    {
      number: '2',
      Icon: Layers3,
      title: 'Compare similar',
      description: 'See nearby choices together.',
      surface: 'bg-[#e8efff]',
    },
    {
      number: '3',
      Icon: CircleCheckBig,
      title: 'Pick the right one',
      description: 'Choose what fits your need.',
      surface: 'bg-[#fff0cf]',
    },
    {
      number: '4',
      Icon: ArrowRight,
      title: 'Open details',
      description: 'Continue only when ready.',
      surface: 'bg-[#efe8ff]',
    },
  ]

  const primaryActionLabel =
    primaryResult?.type === 'recipe'
      ? 'View recipe'
      : primaryResult?.type === 'brand'
        ? 'View brand'
        : 'View product'

  return (
    <main className="min-h-[72svh] bg-[#f7f7f1] px-2 pb-8 pt-2 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-[1460px]">
        <div className="flex items-center justify-between gap-3 py-2 sm:py-3">
          <Link
            to="/"
            className="focus-ring inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-black text-stone-700 shadow-sm transition hover:border-[#9bb6a0] hover:text-[#175339] sm:text-xs"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Back
          </Link>

          <p className="max-w-[62%] truncate text-right text-[8px] font-black uppercase tracking-[0.16em] text-stone-400 sm:text-[9px]">
            Search · {query}
          </p>
        </div>

        <section className="grid gap-3 rounded-[22px] border border-[#cfe0da] bg-[linear-gradient(120deg,#e0f7f0_0%,#e7f1ff_55%,#efebff_100%)] p-3 shadow-[0_12px_30px_rgba(25,45,39,0.06)] sm:p-4 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:p-5">
          <div className="px-1 py-1 sm:px-2">
            <p className="text-[8px] font-black uppercase tracking-[0.17em] text-[#0d735b] sm:text-[9px]">
              Search results
            </p>

            <h1 className="mt-1.5 text-[22px] font-black leading-[1.03] tracking-[-0.035em] text-stone-950 sm:text-[28px] lg:text-[32px]">
              Compare before you choose.
            </h1>

            <p className="mt-2 max-w-xl text-[10px] font-medium leading-4 text-stone-600 sm:text-[11px] sm:leading-5">
              We keep the strongest match and similar options together, so you can choose without jumping between pages.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
            {stepCards.map((step) => (
              <SearchStepCard key={step.number} {...step} />
            ))}
          </div>
        </section>

        <section className={`mt-3 overflow-hidden rounded-[22px] border ${primaryVisual.border} ${primaryVisual.surface} shadow-[0_12px_30px_rgba(23,60,45,0.055)] sm:mt-4 sm:rounded-[24px]`}>
          <div className="grid lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
            <div className="grid min-h-[170px] place-items-center border-b border-white/75 bg-white/60 p-3 lg:min-h-[240px] lg:border-b-0 lg:border-r">
              {primaryProduct?.image?.url ? (
                <img
                  src={primaryProduct.image.url}
                  alt={primaryProduct?.image?.alt || primaryTitle}
                  className="max-h-[155px] w-full object-contain sm:max-h-[180px] lg:max-h-[220px]"
                />
              ) : (
                <div className={`grid size-20 place-items-center rounded-[22px] ${primaryVisual.iconSurface} shadow-sm sm:size-24`}>
                  <PrimaryIcon
                    size={38}
                    strokeWidth={1.35}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center p-4 sm:p-5 lg:p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.13em] sm:text-[8px] ${primaryVisual.badge}`}>
                  Best match
                </span>

                <span className="rounded-full border border-black/10 bg-white/75 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.11em] text-stone-600 sm:text-[8px]">
                  {primaryResult.type}
                </span>

                {primaryProduct?.category?.name ? (
                  <span className="rounded-full border border-black/10 bg-white/75 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.11em] text-stone-600 sm:text-[8px]">
                    {primaryProduct.category.name}
                  </span>
                ) : null}
              </div>

              {primarySubtitle ? (
                <p className="mt-3 text-[8px] font-black uppercase tracking-[0.13em] text-stone-500 sm:text-[9px]">
                  {primarySubtitle}
                </p>
              ) : null}

              <h2 className="mt-1 max-w-4xl text-[25px] font-black leading-[1.03] tracking-[-0.04em] text-stone-950 sm:text-[30px] lg:text-[34px]">
                {primaryTitle}
              </h2>

              {primaryQuantity ? (
                <div className="mt-2">
                  <span className="rounded-full bg-white/82 px-2.5 py-1 text-[9px] font-bold text-stone-600 sm:text-[10px]">
                    {primaryQuantity}
                  </span>
                </div>
              ) : null}

              <p className="mt-3 max-w-2xl text-[10px] leading-4 text-stone-600 sm:text-[11px] sm:leading-5">
                Best match for “{query}”. Compare the options below, or open this result now.
              </p>

              <Link
                to={primaryPath}
                className="focus-ring mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(28,25,23,0.1)] transition hover:-translate-y-0.5 hover:bg-stone-800 motion-reduce:transform-none sm:text-[11px]"
              >
                {primaryActionLabel}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-[#dce3dc] bg-white/76 p-3 shadow-[0_10px_26px_rgba(35,43,38,0.04)] sm:rounded-[24px] sm:p-4 lg:p-5">
          <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.17em] text-[#477252] sm:text-[8px]">
                More options
              </p>

              <h2 className="mt-1 text-[19px] font-black tracking-[-0.03em] text-stone-950 sm:text-[22px]">
                {showProductSimilarity ? 'Similar products' : 'Similar choices'}
              </h2>
            </div>

            <p className="hidden max-w-md text-right text-[9px] font-medium leading-4 text-stone-500 sm:block">
              Choose any card to open its full details.
            </p>
          </div>

          {showProductSimilarity ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
              {similarProducts.map((product) => (
                <SimilarProductCard
                  key={getProductKey(product)}
                  product={product}
                />
              ))}
            </div>
          ) : relatedResults.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
              {relatedResults.map((result) => (
                <RelatedResultCard
                  key={getResultKey(result)}
                  result={result}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-[#cfd9cb] bg-[#f8faf7] px-4 py-5 text-center text-[10px] font-semibold text-stone-500 sm:text-xs">
              No similar published choices are available yet.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
