import {
  useMemo,
  useState,
} from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  RefreshCw,
  Scale,
  ShoppingBasket,
  Store,
} from 'lucide-react'

import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  createCommerceIdempotencyKey,
  createMarketplaceCart,
  getCommerceErrorMessage,
  optimizeBasket,
} from '../services/commerce.service'

const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

function saveFloatingMarketplaceCart({
  cartId,
  items,
}) {
  try {
    window.sessionStorage.setItem(
      FLOATING_MARKETPLACE_CART_KEY,
      JSON.stringify({
        cartId,
        items,
        updatedAt:
          new Date().toISOString(),
      }),
    )
    window.sessionStorage.removeItem(
      'epantry-floating-cart-hidden',
    )
  } catch {
    // Session persistence is best-effort UX state only.
  }

  window.dispatchEvent(
    new CustomEvent(
      'epantry-cart-updated',
      {
        detail: {
          show: true,
        },
      },
    ),
  )
}

function notifyFloatingCartFly({
  name,
  sourceElement,
}) {
  const rect =
    sourceElement
      ?.getBoundingClientRect?.()

  window.dispatchEvent(
    new CustomEvent(
      'epantry-cart-fly',
      {
        detail: {
          name,
          startRect:
            rect
              ? {
                  left:
                    rect.left +
                    rect.width /
                      2,
                  top:
                    rect.top +
                    rect.height /
                      2,
                }
              : null,
        },
      },
    ),
  )
}

const OBJECTIVES =
  Object.freeze([
    {
      key:
        'best_value',

      label:
        'Best Value',

      description:
        'Lowest known item total per requirement, with pack surplus as a deterministic tie-breaker.',
    },

    {
      key:
        'minimum_waste',

      label:
        'Minimum Waste',

      description:
        'Prioritizes lower surplus quantity before known item price.',
    },

    {
      key:
        'one_retailer',

      label:
        'One Retailer',

      description:
        'Uses one Host organization only when it can cover every requirement.',
    },
  ])

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    !Number.isInteger(
      Number(
        amountMinor,
      ),
    )
  ) {
    return 'Not available'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number(
      amountMinor,
    ) /
      100,
  )
}

function formatQuantity(
  quantity,
  unit,
) {
  if (
    !Number.isFinite(
      Number(
        quantity,
      ),
    )
  ) {
    return '—'
  }

  return `${Number(
    quantity,
  )} ${unit || ''}`.trim()
}

function formatObservedAt(
  value,
) {
  if (
    !value
  ) {
    return 'Timestamp unavailable'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Timestamp unavailable'
  }

  return date.toLocaleString()
}

function OptionCard({
  option,
  selected,
  onSelect,
}) {
  const matchedRequirementCount =
    Math.max(
      0,
      Number(
        option.matchedRequirementCount,
      ) || 0,
    )

  const totalRequirementCount =
    Math.max(
      0,
      Number(
        option.totalRequirementCount,
      ) || 0,
    )

  const hasRequirements =
    totalRequirementCount >
    0

  const hasMatches =
    matchedRequirementCount >
    0

  const fullCoverage =
    hasRequirements &&
    matchedRequirementCount ===
      totalRequirementCount

  const objectiveSatisfied =
    option.objectiveSatisfied ===
    true

  const coverageLabel =
    !hasRequirements
      ? 'No purchase requirements'
      : fullCoverage
        ? 'Full coverage'
        : hasMatches
          ? 'Partial coverage'
          : 'No coverage'

  const objectiveLabel =
    !hasRequirements
      ? 'Nothing to optimize'
      : !hasMatches
        ? 'No eligible matches'
        : fullCoverage &&
            objectiveSatisfied
          ? 'Objective satisfied'
          : objectiveSatisfied
            ? 'Ranking applied'
            : 'Objective unavailable'

  return (
    <button
      type="button"
      onClick={() =>
        onSelect(
          option.optionKey,
        )
      }
      className={[
        'w-full rounded-[24px] border p-5 text-left transition',

        selected &&
        fullCoverage
          ? 'border-emerald-600 bg-emerald-50 shadow-sm'
          : selected
            ? 'border-amber-400 bg-amber-50 shadow-sm'
            : 'border-stone-200 bg-white hover:border-stone-300',
      ].join(
        ' ',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-stone-950">
            {option.label}
          </p>

          <p className="mt-1 text-xs font-bold text-stone-500">
            {option.sellerCount} seller
            {option.sellerCount ===
            1
              ? ''
              : 's'}
            {' · '}
            {matchedRequirementCount}/{totalRequirementCount} matched
          </p>
        </div>

        {selected && (
          <span
            className={[
              'grid h-8 w-8 shrink-0 place-items-center rounded-full text-white',

              fullCoverage
                ? 'bg-emerald-700'
                : 'bg-amber-600',
            ].join(
              ' ',
            )}
          >
            {fullCoverage
              ? (
                <Check
                  size={16}
                  aria-hidden="true"
                />
              )
              : (
                <AlertTriangle
                  size={16}
                  aria-hidden="true"
                />
              )}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-stone-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
          Known item subtotal
        </p>

        <p className="mt-1 text-xl font-black text-stone-950">
          {hasMatches
            ? formatMoney(
                option.itemSubtotalMinor,
                option.currency,
              )
            : 'No matched items'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.08em]">
        <span
          className={[
            'rounded-full px-2.5 py-1',

            fullCoverage
              ? 'bg-emerald-100 text-emerald-800'
              : hasMatches
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800',
          ].join(
            ' ',
          )}
        >
          {coverageLabel}
        </span>

        <span
          className={[
            'rounded-full px-2.5 py-1',

            fullCoverage &&
            objectiveSatisfied
              ? 'bg-emerald-100 text-emerald-800'
              : hasMatches &&
                  objectiveSatisfied
                ? 'bg-stone-100 text-stone-700'
                : 'bg-rose-100 text-rose-800',
          ].join(
            ' ',
          )}
        >
          {objectiveLabel}
        </span>
      </div>
    </button>
  )
}

export default function FulfillmentComparePage() {
  const {
    planId,
  } =
    useParams()

  const location =
    useLocation()

  const navigate =
    useNavigate()

  const [
    pincode,
    setPincode,
  ] =
    useState(
      () =>
        String(
          location.state
            ?.pincode ||
            '',
        )
          .replace(
            /\D/g,
            '',
          )
          .slice(
            0,
            6,
          ),
    )

  const [
    fulfillmentType,
    setFulfillmentType,
  ] =
    useState(
      () =>
        location.state
          ?.fulfillmentType ||
        'delivery',
    )

  const [
    objective,
    setObjective,
  ] =
    useState(
      () =>
        location.state
          ?.objective ||
        'best_value',
    )

  const [
    quoteData,
    setQuoteData,
  ] =
    useState(
      () =>
        location.state
          ?.quoteData ||
        null,
    )

  const [
    selectedOptionKey,
    setSelectedOptionKey,
  ] =
    useState(
      () =>
        location.state
          ?.quoteData
          ?.quote
          ?.recommendedOptionKey ||
        location.state
          ?.objective ||
        'best_value',
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    )

  const [
    cartCreating,
    setCartCreating,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const selectedOption =
    useMemo(
      () =>
        (
          quoteData?.options ||
          []
        ).find(
          (
            option,
          ) =>
            option.optionKey ===
            selectedOptionKey,
        ) ||
        null,
      [
        quoteData,
        selectedOptionKey,
      ],
    )

  const matchedRequirementCount =
    selectedOption
      ? Math.max(
          0,
          Number(
            selectedOption
              .matchedRequirementCount,
          ) || 0,
        )
      : 0

  const totalRequirementCount =
    selectedOption
      ? Math.max(
          0,
          Number(
            selectedOption
              .totalRequirementCount,
          ) || 0,
        )
      : 0

  const hasRequirements =
    totalRequirementCount >
    0

  const hasAnyCoverage =
    matchedRequirementCount >
    0

  const fullCoverage =
    Boolean(
      selectedOption,
    ) &&
    hasRequirements &&
    matchedRequirementCount ===
      totalRequirementCount

  const oneRetailerUnavailable =
    selectedOption?.optionKey ===
      'one_retailer' &&
    selectedOption?.objectiveSatisfied !==
      true

  async function handleCompare(
    event,
  ) {
    event.preventDefault()

    if (
      !/^\d{6}$/.test(
        pincode.replace(
          /\s+/g,
          '',
        ),
      )
    ) {
      setError(
        'Enter a valid 6-digit pincode.',
      )

      return
    }

    setLoading(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await optimizeBasket({
          outcomePlanId:
            planId,

          pincode,
          objective,
          fulfillmentType,

          idempotencyKey:
            createCommerceIdempotencyKey(
              'basket-compare',
            ),
        })

      setQuoteData(
        result,
      )

      setSelectedOptionKey(
        result?.quote
          ?.recommendedOptionKey ||
          objective,
      )
    } catch (
      compareError
    ) {
      setError(
        getCommerceErrorMessage(
          compareError,
          'Unable to compare fulfillment right now.',
        ),
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  async function handleCreateCart(
    sourceElement,
  ) {
    if (
      !quoteData?.quote?.id ||
      !selectedOption ||
      !fullCoverage ||
      oneRetailerUnavailable ||
      cartCreating
    ) {
      return
    }

    setCartCreating(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await createMarketplaceCart({
          basketQuoteId:
            quoteData.quote.id,

          optionKey:
            selectedOption.optionKey,

          idempotencyKey:
            createCommerceIdempotencyKey(
              'marketplace-cart',
            ),
        })

      const cartId =
        result?.cart?.id

      if (
        !cartId
      ) {
        throw new Error(
          'Marketplace Cart identity was not returned.',
        )
      }

      const floatingItems =
        (selectedOption.selections || []).map(
          (selection) => ({
            id:
              selection.id,
            name:
              selection.requirementLabel ||
              'Cart item',
            quantity:
              selection.packCount ||
              1,
          }),
        )

      saveFloatingMarketplaceCart({
        cartId,
        items:
          floatingItems,
      })

      notifyFloatingCartFly({
        name:
          floatingItems.length ===
          1
            ? floatingItems[0].name
            : `${floatingItems.length} items`,
        sourceElement,
      })

      navigate(
        `/cart/${cartId}`,
      )
    } catch (
      cartError
    ) {
      setError(
        getCommerceErrorMessage(
          cartError,
          'Unable to create the Marketplace Cart.',
        ),
      )
    } finally {
      setCartCreating(
        false,
      )
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="page-shell py-6 sm:py-9">
        <Link
          to={`/outcome-plans/${planId}/basket`}
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 hover:text-stone-950"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Back to Requirement Basket
        </Link>

        <section className="mt-3 overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <Scale
                  size={18}
                  aria-hidden="true"
                />

                <p className="text-xs font-black uppercase tracking-[0.14em]">
                  P19 · Fulfillment Compare
                </p>
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                Compare real Marketplace coverage
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">
                EPANTRY matches M10 genuine shortages to active Packs and serviceable Host offers. Ranking stays deterministic and unmatched requirements remain visible.
              </p>
            </div>

            <form
              onSubmit={
                handleCompare
              }
              className="rounded-[24px] border border-stone-200 bg-stone-50 p-4"
            >
              <label className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                Pincode

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength="7"
                  value={
                    pincode
                  }
                  onChange={(
                    event,
                  ) => {
                    setPincode(
                      event.target.value,
                    )

                    setQuoteData(
                      null,
                    )

                    setError(
                      '',
                    )
                  }}
                  placeholder="110001"
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-black outline-none transition focus:border-emerald-600"
                />
              </label>

              <label className="mt-3 block text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                Fulfillment

                <select
                  value={
                    fulfillmentType
                  }
                  onChange={(
                    event,
                  ) => {
                    setFulfillmentType(
                      event.target.value,
                    )

                    setQuoteData(
                      null,
                    )

                    setError(
                      '',
                    )
                  }}
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-black outline-none transition focus:border-emerald-600"
                >
                  <option value="delivery">
                    Delivery
                  </option>

                  <option value="pickup">
                    Pickup
                  </option>
                </select>
              </label>

              <button
                type="submit"
                disabled={
                  loading
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-black text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? 'animate-spin'
                      : ''
                  }
                  aria-hidden="true"
                />

                {loading
                  ? 'Comparing…'
                  : 'Compare offers'}
              </button>
            </form>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-stone-500">
            Ranking objective
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {OBJECTIVES.map(
              (
                item,
              ) => (
                <button
                  key={
                    item.key
                  }
                  type="button"
                  onClick={() => {
                    setObjective(
                      item.key,
                    )

                    if (
                      quoteData
                    ) {
                      setSelectedOptionKey(
                        item.key,
                      )
                    }
                  }}
                  className={[
                    'rounded-[20px] border p-4 text-left transition',

                    objective ===
                    item.key
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-stone-200 bg-stone-50 hover:bg-white',
                  ].join(
                    ' ',
                  )}
                >
                  <p className="font-black text-stone-950">
                    {item.label}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {item.description}
                  </p>
                </button>
              ),
            )}
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {quoteData && (
          <>
            <section className="mt-5 grid gap-4 lg:grid-cols-3">
              {(quoteData.options || []).map(
                (
                  option,
                ) => (
                  <OptionCard
                    key={
                      option.optionKey
                    }
                    option={
                      option
                    }
                    selected={
                      option.optionKey ===
                      selectedOptionKey
                    }
                    onSelect={
                      setSelectedOptionKey
                    }
                  />
                ),
              )}
            </section>

            {selectedOption &&
              hasRequirements && (
              <section
                className={[
                  'mt-5 rounded-[24px] border p-5',

                  fullCoverage
                    ? 'border-emerald-200 bg-emerald-50'
                    : hasAnyCoverage
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-rose-200 bg-rose-50',
                ].join(
                  ' ',
                )}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p
                      className={[
                        'text-xs font-black uppercase tracking-[0.12em]',

                        fullCoverage
                          ? 'text-emerald-700'
                          : hasAnyCoverage
                            ? 'text-amber-700'
                            : 'text-rose-700',
                      ].join(
                        ' ',
                      )}
                    >
                      Marketplace coverage
                    </p>

                    <h2 className="mt-1 text-xl font-black text-stone-950">
                      {fullCoverage
                        ? 'Every purchase requirement has an eligible match'
                        : hasAnyCoverage
                          ? 'Marketplace coverage is partial'
                          : 'No eligible Marketplace match was found'}
                    </h2>

                    <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-700">
                      {fullCoverage
                        ? 'The selected comparison can proceed to an EPANTRY Cart. Price and inventory are revalidated again when the Cart is created.'
                        : hasAnyCoverage
                          ? 'Only the matched requirements can be ranked. Unmatched requirements stay explicit and cannot silently disappear into a Cart.'
                          : 'For this pincode and fulfillment type, none of the purchase requirements currently has a trustworthy Product Pack + active Host Offer match. This is a genuine coverage gap, not a ₹0 basket.'}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-2xl bg-white/80 px-4 py-3 text-right shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Requirements matched
                    </p>

                    <p className="mt-1 text-2xl font-black text-stone-950">
                      {matchedRequirementCount}/{totalRequirementCount}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {selectedOption && (
              <section className="mt-5 rounded-[28px] border border-stone-200 bg-white shadow-sm">
                <header className="border-b border-stone-200 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-stone-600">
                        <Store
                          size={18}
                          aria-hidden="true"
                        />

                        <p className="text-xs font-black uppercase tracking-[0.13em]">
                          Selected comparison
                        </p>
                      </div>

                      <h2 className="mt-2 text-2xl font-black text-stone-950">
                        {selectedOption.label}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={(event) =>
                        handleCreateCart(
                          event.currentTarget,
                        )
                      }
                      disabled={
                        !fullCoverage ||
                        oneRetailerUnavailable ||
                        cartCreating
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingBasket
                        size={17}
                        aria-hidden="true"
                      />

                      {cartCreating
                        ? 'Creating Cart…'
                        : fullCoverage
                          ? 'Create EPANTRY Cart'
                          : 'Full coverage required'}
                    </button>
                  </div>

                  {!fullCoverage && (
                    <p className="mt-3 text-sm font-semibold text-amber-800">
                      {hasAnyCoverage
                        ? 'EPANTRY Cart requires full trustworthy Marketplace coverage. Unmatched requirements remain visible for an explicit external retailer handoff instead of silently disappearing.'
                        : 'EPANTRY Cart is unavailable because this comparison has zero eligible Marketplace matches. Add or activate governed Product Pack + Offer coverage for these requirements, or use the explicit external handoff.'}
                    </p>
                  )}

                  {oneRetailerUnavailable &&
                    hasAnyCoverage && (
                    <p className="mt-3 text-sm font-semibold text-rose-800">
                      One Retailer is not available for all requirements. Choose Best Value or Minimum Waste to keep the seller split explicit.
                    </p>
                  )}
                </header>

                {hasAnyCoverage ? (
                  <div className="divide-y divide-stone-200">
                    {(selectedOption.selections || []).map(
                      (
                        selection,
                      ) => (
                      <article
                        key={
                          selection.id
                        }
                        className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                      >
                        <div>
                          <p className="font-black text-stone-950">
                            {selection.requirementLabel ||
                              'Canonical ingredient'}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-stone-600">
                            {selection.sellerName}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
                            <span>
                              Need{' '}
                              <strong className="text-stone-700">
                                {formatQuantity(
                                  selection.requirementQuantity,
                                  selection.requirementUnit,
                                )}
                              </strong>
                            </span>

                            <span>
                              Buy{' '}
                              <strong className="text-stone-700">
                                {selection.packCount} ×{' '}
                                {formatQuantity(
                                  selection.packQuantity,
                                  selection.packUnit,
                                )}
                              </strong>
                            </span>

                            <span>
                              Surplus{' '}
                              <strong className="text-stone-700">
                                {formatQuantity(
                                  selection.surplusQuantity,
                                  selection.requirementUnit,
                                )}
                              </strong>
                            </span>
                          </div>

                          <p className="mt-3 text-[11px] font-semibold text-stone-400">
                            Price observed:{' '}
                            {formatObservedAt(
                              selection.priceRecordedAt,
                            )}
                            {' · '}
                            Inventory observed:{' '}
                            {formatObservedAt(
                              selection.inventoryObservedAt,
                            )}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-stone-50 px-4 py-3 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">
                            Line item total
                          </p>

                          <p className="mt-1 text-lg font-black text-stone-950">
                            {formatMoney(
                              selection.lineTotal?.amountMinor,
                              selection.lineTotal?.currency,
                            )}
                          </p>
                        </div>
                      </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="p-5 sm:p-6">
                    <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-5">
                      <h3 className="font-black text-rose-950">
                        Why this comparison has no Marketplace items
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-rose-800">
                        A requirement is matched only when EPANTRY can prove a conservative canonical Product match and a currently eligible commercial path. At least one requirement needs all of these conditions at the same time:
                      </p>

                      <div className="mt-4 grid gap-2 text-sm font-semibold text-stone-700 sm:grid-cols-2">
                        <p className="rounded-xl bg-white px-3 py-2">Published canonical Product Version mapped to the Ingredient</p>
                        <p className="rounded-xl bg-white px-3 py-2">Active Pack with a usable net quantity and compatible unit</p>
                        <p className="rounded-xl bg-white px-3 py-2">Active Host Offer with a current governed item price</p>
                        <p className="rounded-xl bg-white px-3 py-2">Service Area covers this pincode and selected fulfillment type</p>
                        <p className="rounded-xl bg-white px-3 py-2">Serviceable Inventory Node has sellable availability</p>
                        <p className="rounded-xl bg-white px-3 py-2">No unresolved governed product constraint blocks matching</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {(quoteData.unmatchedRequirementLineIds || []).length >
              0 && (
              <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={20}
                    className="mt-0.5 shrink-0 text-amber-700"
                    aria-hidden="true"
                  />

                  <div>
                    <h2 className="font-black text-amber-950">
                      {hasAnyCoverage
                        ? 'Some requirements remain unmatched'
                        : 'No requirements matched Marketplace coverage'}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-amber-800">
                      {quoteData.unmatchedRequirementLineIds.length} requirement
                      {quoteData.unmatchedRequirementLineIds.length ===
                      1
                        ? ''
                        : 's'} do not currently have a trustworthy deterministic Pack + Offer match. EPANTRY will not use fuzzy guessing to hide that gap.
                    </p>

                    <Link
                      to={`/outcome-plans/${planId}/handoff/${quoteData.quote.id}`}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-800"
                    >
                      Continue with external handoff
                    </Link>
                  </div>
                </div>
              </section>
            )}

            <section className="mt-5 rounded-[24px] border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-900">
              <strong>
                Cost transparency:
              </strong>{' '}
              {hasAnyCoverage
                ? 'the comparison currently shows known Marketplace item prices. Delivery fees are not yet governed at the comparison stage, so total landed cost is intentionally not claimed.'
                : 'no known Marketplace item subtotal exists because no items matched. EPANTRY does not present an empty selection as a ₹0 basket, and total landed cost is intentionally not claimed.'}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
