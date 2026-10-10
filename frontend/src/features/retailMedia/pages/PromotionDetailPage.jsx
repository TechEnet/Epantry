import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  CalendarClock,
  Megaphone,
  Package,
  Store,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  getPublicRetailMediaPromotion,
  getRetailMediaErrorMessage,
} from '../services/retailMedia.service'

function formatMoney(
  amountMinor,
  currency = 'INR',
) {
  const amount =
    Number(amountMinor)

  if (!Number.isFinite(amount)) {
    return 'Price unavailable'
  }

  try {
    return new Intl.NumberFormat(
      'en-IN',
      {
        style: 'currency',
        currency:
          currency || 'INR',
        maximumFractionDigits:
          amount % 100 === 0
            ? 0
            : 2,
      },
    ).format(
      amount / 100,
    )
  } catch {
    return `₹${(
      amount / 100
    ).toFixed(2)}`
  }
}

function formatDateTime(value) {
  if (!value) {
    return 'Not set'
  }

  const date =
    new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not set'
  }

  try {
    return new Intl.DateTimeFormat(
      'en-IN',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      },
    ).format(date)
  } catch {
    return date.toLocaleString()
  }
}

function formatDuration(minutes) {
  const value =
    Number(minutes)

  if (!Number.isFinite(value) || value <= 0) {
    return 'Not set'
  }

  if (value < 1440) {
    const hours =
      Math.round(
        value / 60,
      )

    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }

  const days =
    Math.round(
      value / 1440,
    )

  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function formatObjective(value) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase()

  const labels = {
    awareness:
      'Build awareness',
    consideration:
      'Help customers consider the offer',
    conversion:
      'Drive product purchases',
    sampling:
      'Introduce products to more customers',
    promotion:
      'Promote a commercial offer',
  }

  return labels[normalized] ||
    'Promote products on EPANTRY'
}

function formatQuantity(quantity) {
  if (
    !quantity ||
    quantity.value === null ||
    quantity.value === undefined
  ) {
    return ''
  }

  return `${quantity.value} ${quantity.unit || ''}`.trim()
}

function PromotionProduct({
  product,
}) {
  const price =
    product?.price || {}

  const hasDiscount =
    Number(price.discountPercent || 0) > 0 &&
    Number(price.saleAmountMinor) <
      Number(price.listAmountMinor)

  const currentAmount =
    price.saleAmountMinor ??
    price.effectiveAmountMinor ??
    price.listAmountMinor

  const productPath =
    product?.slug
      ? `/grocery/product/${encodeURIComponent(
          product.slug,
        )}`
      : '/grocery'

  const productImage =
    product?.image?.url
      ? product.image
      : Array.isArray(product?.images) &&
          product.images[0]?.url
        ? product.images[0]
        : null

  const quantity =
    formatQuantity(
      product?.netQuantity,
    )

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#dce5df] bg-white shadow-[0_10px_26px_rgba(24,53,39,0.045)] transition duration-300 hover:-translate-y-1 hover:border-[#9ebcad] hover:shadow-[0_18px_36px_rgba(24,53,39,0.12)] motion-reduce:transform-none">
      <Link
        to={productPath}
        className="focus-ring relative block aspect-[4/3] overflow-hidden border-b border-[#e4ebe6] bg-[linear-gradient(145deg,#fbfcfa_0%,#f0f4f1_100%)]"
        aria-label={`View ${product?.displayName || 'product'}`}
      >
        {productImage?.url ? (
          <img
            src={productImage.url}
            alt={productImage.alt || product.displayName || 'Product'}
            className="h-full w-full object-contain p-3.5 transition duration-500 group-hover:scale-[1.035] motion-reduce:transform-none sm:p-4"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#8fa396]">
            <Package
              size={46}
              strokeWidth={1.35}
              aria-hidden="true"
            />
          </div>
        )}

        {hasDiscount ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#0f5132] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
            <BadgePercent
              size={12}
              aria-hidden="true"
            />
            {price.discountPercent}% OFF
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        {quantity ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6c7e72]">
            {quantity}
          </p>
        ) : null}

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.55em] text-[17px] font-black leading-[1.25] tracking-[-0.02em] text-[#173c2d]">
          {product?.displayName || 'Product'}
        </h3>

        <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-[20px] font-black tracking-[-0.03em] text-stone-950">
            {formatMoney(
              currentAmount,
              price.currency,
            )}
          </span>

          {hasDiscount ? (
            <span className="pb-0.5 text-[12px] font-semibold text-stone-400 line-through decoration-stone-400">
              {formatMoney(
                price.listAmountMinor,
                price.currency,
              )}
            </span>
          ) : null}
        </div>

        <Link
          to={productPath}
          className="focus-ring mt-4 inline-flex items-center justify-between gap-3 border-t border-stone-200 pt-3 text-[12px] font-black text-[#176b57]"
        >
          View product
          <ArrowRight
            size={15}
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  )
}

export default function PromotionDetailPage() {
  const {
    campaignId,
  } =
    useParams()

  const [promotion, setPromotion] =
    useState(null)
  const [products, setProducts] =
    useState([])
  const [loading, setLoading] =
    useState(true)
  const [error, setError] =
    useState('')
  const [showAllProducts, setShowAllProducts] =
    useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setShowAllProducts(false)

      try {
        const data =
          await getPublicRetailMediaPromotion({
            campaignId,
          })

        if (!cancelled) {
          setPromotion(
            data?.promotion || null,
          )
          setProducts(
            Array.isArray(data?.products)
              ? data.products
              : [],
          )
        }
      } catch (requestError) {
        if (!cancelled) {
          setPromotion(null)
          setProducts([])
          setError(
            getRetailMediaErrorMessage(
              requestError,
              'This promotion is not available right now.',
            ),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (campaignId) {
      load()
    } else {
      setLoading(false)
      setError(
        'This promotion is not available right now.',
      )
    }

    return () => {
      cancelled = true
    }
  }, [campaignId])

  if (loading) {
    return (
      <main className="min-h-[72svh] bg-[#f6f4ee] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1380px] animate-pulse">
          <div className="h-[360px] rounded-[24px] bg-white/75" />
          <div className="mt-8 h-8 w-56 rounded bg-white/80" />
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[320px] rounded-[18px] bg-white/80"
              />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (
    error ||
    !promotion
  ) {
    return (
      <main className="min-h-[72svh] bg-[#f6f4ee] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[22px] border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
          <Megaphone
            size={34}
            className="mx-auto text-[#176b57]"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-black tracking-[-0.03em] text-stone-950">
            Promotion unavailable
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-stone-600">
            {error || 'This promotion is not available right now.'}
          </p>
          <Link
            to="/"
            className="focus-ring mt-6 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-black text-white"
          >
            <ArrowLeft
              size={15}
              aria-hidden="true"
            />
            Back to EPANTRY
          </Link>
        </div>
      </main>
    )
  }

  const sponsorName =
    promotion?.sponsor?.name ||
    'EPANTRY partner'

  const placements =
    Array.isArray(
      promotion.placements,
    )
      ? promotion.placements
      : []

  return (
    <main className="min-h-screen bg-[#f6f4ee] pb-14">
      <section className="border-b border-[#d8e3dc] bg-[linear-gradient(120deg,#dff3e8_0%,#edf5f0_52%,#e4ecf8_100%)]">
        <div className="mx-auto max-w-[1460px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Link
            to="/"
            className="focus-ring inline-flex items-center gap-2 text-[12px] font-black text-[#175339]"
          >
            <ArrowLeft
              size={15}
              aria-hidden="true"
            />
            Back to EPANTRY
          </Link>

          <div className="mt-3 grid overflow-hidden rounded-[24px] border border-[#d6e3dc] bg-white shadow-[0_18px_48px_rgba(30,60,46,0.10)] sm:mt-5 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="flex min-w-0 flex-col justify-center bg-[#fbfcf9] px-4 py-4 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bcd8cb] bg-[#edf8f2] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#176b57]">
                  <Megaphone
                    size={12}
                    aria-hidden="true"
                  />
                  {promotion?.creative?.sponsorLabel || 'Sponsored'}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-stone-600">
                  <Store
                    size={12}
                    aria-hidden="true"
                  />
                  {sponsorName}
                </span>
              </div>

              <h1 className="mt-2.5 max-w-4xl text-[26px] font-black leading-[1.02] tracking-[-0.045em] text-stone-950 sm:mt-4 sm:text-[42px] lg:text-[48px]">
                {promotion?.creative?.headline || promotion.title}
              </h1>

              {promotion?.title ? (
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#557065] sm:mt-2">
                  Campaign · {promotion.title}
                </p>
              ) : null}

              {promotion?.creative?.body ? (
                <p className="mt-2 max-w-3xl text-[14px] font-medium leading-5 text-stone-600 sm:mt-4 sm:text-[16px] sm:leading-7">
                  {promotion.creative.body}
                </p>
              ) : null}

              <div className="mt-3 border-y border-[#dbe5df] sm:mt-6">
                <div className="grid grid-cols-2 sm:grid-cols-3">
                  <div className="py-2.5 pr-2 sm:py-3.5 sm:pr-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Promoted by
                    </p>
                    <p className="mt-1 text-[13px] font-black text-stone-900">
                      {sponsorName}
                    </p>
                  </div>

                  <div className="border-l border-[#e2e8e4] py-2.5 pl-3 sm:border-t-0 sm:px-4 sm:py-3.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Purpose
                    </p>
                    <p className="mt-1 text-[13px] font-black text-stone-900">
                      {formatObjective(
                        promotion.objective,
                      )}
                    </p>
                  </div>

                  <div className="col-span-2 border-t border-[#e2e8e4] py-2.5 sm:col-span-1 sm:border-l sm:border-t-0 sm:py-3.5 sm:pl-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Runs until
                    </p>
                    <p className="mt-1 text-[13px] font-black text-stone-900">
                      {formatDateTime(
                        promotion.endsAt,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] font-bold text-stone-600 sm:mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ed] px-3 py-1.5 text-[#175339]">
                  <CalendarClock
                    size={13}
                    aria-hidden="true"
                  />
                  {formatDuration(
                    promotion.durationMinutes,
                  )}
                </span>

                {placements.map((placement) => (
                  <span
                    key={`${placement.placement}-${placement.slotKey}`}
                    className="rounded-full bg-[#eef2f7] px-3 py-1.5 text-stone-600"
                  >
                    {placement.slotLabel || placement.slotKey}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex h-[205px] min-h-0 items-center justify-center overflow-hidden border-t border-[#d6e3dc] bg-[#f4f7f4] p-2 sm:h-auto sm:min-h-[360px] sm:p-4 lg:min-h-[430px] lg:border-l lg:border-t-0 lg:p-5">
              {promotion?.creative?.imageUrl ? (
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-[#dfe7e2] bg-white">
                  <img
                    src={promotion.creative.imageUrl}
                    alt={`${sponsorName} promotion`}
                    className="h-full max-h-[190px] w-full object-contain sm:h-auto sm:max-h-[430px]"
                  />
                </div>
              ) : (
                <div className="grid h-full min-h-0 w-full place-items-center rounded-[18px] bg-[radial-gradient(circle_at_30%_30%,#d8f0e4,transparent_34%),radial-gradient(circle_at_70%_65%,#dde8fb,transparent_38%),#f3f5f1] text-[#176b57] sm:min-h-[330px] lg:min-h-[390px]">
                  <Megaphone
                    size={64}
                    strokeWidth={1.2}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1460px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="border-b border-stone-300 pb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#176b57]">
            Products in this promotion
          </p>
          <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-stone-950 sm:text-[30px]">
            Shop {sponsorName} listings
          </h2>
        </div>

        {products.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product, index) => {
                const visibilityClass =
                  showAllProducts
                    ? ''
                    : index >= 8
                      ? 'hidden'
                      : index >= 4
                        ? 'hidden lg:block'
                        : ''

                return (
                  <div
                    key={product.offerId || product.packId}
                    className={visibilityClass}
                  >
                    <PromotionProduct
                      product={product}
                    />
                  </div>
                )
              })}
            </div>

            {products.length > 4 ? (
              <div className="mt-7 flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setShowAllProducts((current) => !current)
                  }
                  className={[
                    'focus-ring inline-flex items-center gap-2 rounded-full border border-[#b8cbbf] bg-white px-5 py-2.5 text-sm font-black text-[#175339] shadow-[0_8px_20px_rgba(24,53,39,0.06)] transition hover:border-[#7fa18d] hover:bg-[#edf7f1]',
                    !showAllProducts && products.length <= 8
                      ? 'lg:hidden'
                      : '',
                  ].join(' ')}
                >
                  {showAllProducts ? 'Show less' : 'View all'}
                  <ArrowRight
                    size={15}
                    className={showAllProducts ? '-rotate-90' : 'rotate-90'}
                    aria-hidden="true"
                  />
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-6 border-y border-stone-300 bg-[#eef3ef] px-5 py-8 text-center">
            <Package
              size={32}
              className="mx-auto text-[#5f7769]"
              aria-hidden="true"
            />
            <p className="mt-3 text-base font-black text-stone-900">
              No active products are available for this promotion right now.
            </p>
            <p className="mt-1 text-sm font-medium text-stone-500">
              The promotion itself is still active, but there are no current public listings with an active price.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
