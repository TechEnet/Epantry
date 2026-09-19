import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Factory,
  Globe2,
  Images,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  X,
  ZoomIn,
} from 'lucide-react'

import {
  useMemo,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import EmptyState from '../../../components/common/EmptyState'

import {
  createCommerceIdempotencyKey,
  createDirectMarketplaceCart,
  getCommerceErrorMessage,
  updateDirectMarketplaceCartItem,
} from '../../commerce/services/commerce.service'

import {
  getPublicPackOffers,
} from '../../marketplace/services/marketplace.service'

import useProductDetail from '../hooks/useProductDetail'

function formatQuantity(
  quantity,
) {
  if (
    !quantity ||
    quantity.value ===
      undefined ||
    quantity.value ===
      null
  ) {
    return 'Not declared'
  }

  return `${quantity.value} ${quantity.unit || ''}`.trim()
}


const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

function readFloatingMarketplaceCart() {
  try {
    const raw =
      window.sessionStorage.getItem(
        FLOATING_MARKETPLACE_CART_KEY,
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(raw)

    if (
      !parsed?.cartId ||
      !Array.isArray(parsed?.items)
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function mapMarketplaceCartItems(
  result,
) {
  return (
    Array.isArray(
      result?.items,
    )
      ? result.items
      : []
  ).map(
    (
      item,
    ) => ({
      id:
        item.id ||
        item.packId ||
        item.displayName,
      packId:
        item.packId ||
        '',
      offerId:
        item.offerId ||
        '',
      organizationId:
        item.organizationId ||
        '',
      sellerName:
        item.sellerName ||
        'Marketplace Host',
      name:
        item.displayName ||
        'Product',
      quantity:
        Number(
          item.packCount ||
          1,
        ),
    }),
  )
}

function saveFloatingMarketplaceCart({
  cartId,
  items,
  pincode =
    '',
  fulfillmentType =
    'delivery',
}) {
  try {
    window.sessionStorage.setItem(
      FLOATING_MARKETPLACE_CART_KEY,
      JSON.stringify({
        cartId,
        items,
        pincode:
          String(
            pincode ||
            '',
          ).trim(),
        fulfillmentType:
          fulfillmentType ||
          'delivery',
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

function formatMoney(
  amountMinor,
  currency = 'INR',
) {
  if (
    amountMinor ===
      null ||
    amountMinor ===
      undefined
  ) {
    return 'Price unavailable'
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

function DetailCard({
  title,
  children,
  accent =
    false,
  description =
    '',
  icon: Icon =
    null,
}) {
  if (
    !Icon &&
    !description
  ) {
    return (
      <details className="group border-b border-stone-200 last:border-b-0">

        <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:px-6">

          <div>

            <h3
              className={[
                'text-sm font-black transition-colors duration-200',
                accent
                  ? 'text-emerald-800'
                  : 'text-stone-950',
                'group-open:text-emerald-900',
              ].join(' ')}
            >
              {title}
            </h3>

            <p className="mt-1 text-xs text-stone-500 group-open:hidden">
              Click to view details
            </p>

          </div>

          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition duration-200 group-hover:border-emerald-200 group-hover:text-emerald-800 group-open:border-emerald-300 group-open:bg-emerald-700 group-open:text-white">
            <ChevronDown
              size={17}
              className="transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </span>

        </summary>

        <div className="border-t border-emerald-100 bg-white px-5 py-5 sm:px-6">
          {children}
        </div>

      </details>
    )
  }

  return (
    <details className="group border-b border-stone-200 last:border-b-0">

      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:px-6">

        <div className="flex min-w-0 items-center gap-3">

          {Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
              <Icon
                size={17}
                aria-hidden="true"
              />
            </span>
          )}

          <div className="min-w-0">

            <h3
              className={[
                'text-sm font-black transition-colors duration-200',
                accent
                  ? 'text-emerald-800'
                  : 'text-stone-950',
                'group-open:text-emerald-900',
              ].join(' ')}
            >
              {title}
            </h3>

            <p className="mt-1 text-xs leading-5 text-stone-500 group-open:hidden">
              {description || 'Click to view details'}
            </p>

          </div>

        </div>

        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition duration-200 group-hover:border-emerald-200 group-hover:text-emerald-800 group-open:border-emerald-300 group-open:bg-emerald-700 group-open:text-white">
          <ChevronDown
            size={17}
            className="transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </span>

      </summary>

      <div className="border-t border-emerald-100 bg-white px-5 py-5 sm:px-6">
        {children}
      </div>

    </details>
  )
}

function MarketplaceOffers({
  product,
  onOffersResolved,
}) {
  const [
    pincode,
    setPincode,
  ] =
    useState(
      '',
    )

  const [
    offers,
    setOffers,
  ] =
    useState(
      [],
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    )

  const [
    checked,
    setChecked,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      null,
    )

  const [
    addingOfferId,
    setAddingOfferId,
  ] =
    useState(
      '',
    )

  const [
    quantityByOfferId,
    setQuantityByOfferId,
  ] =
    useState(
      {},
    )

  function getOfferQuantityBounds(
    offer,
  ) {
    const minimum =
      Math.max(
        1,
        Number(
          offer?.minimumOrderQuantity ||
            1,
        ),
      )

    const providerMaximum =
      offer?.maximumOrderQuantity ===
        null ||
      offer?.maximumOrderQuantity ===
        undefined
        ? 100000
        : Number(
            offer.maximumOrderQuantity,
          )

    const maximum =
      Math.max(
        minimum,
        Number.isFinite(
          providerMaximum,
        )
          ? Math.floor(
              providerMaximum,
            )
          : 100000,
      )

    return {
      minimum,
      maximum,
    }
  }

  function getOfferQuantity(
    offer,
  ) {
    const {
      minimum,
      maximum,
    } =
      getOfferQuantityBounds(
        offer,
      )

    const current =
      Number(
        quantityByOfferId[
          offer?.id
        ],
      )

    if (
      !Number.isInteger(
        current,
      )
    ) {
      return minimum
    }

    return Math.min(
      maximum,
      Math.max(
        minimum,
        current,
      ),
    )
  }

  function setOfferQuantity(
    offer,
    nextQuantity,
  ) {
    const offerId =
      offer?.id

    if (!offerId) {
      return
    }

    const {
      minimum,
      maximum,
    } =
      getOfferQuantityBounds(
        offer,
      )

    const parsed =
      Number(
        nextQuantity,
      )

    const normalized =
      Number.isFinite(
        parsed,
      )
        ? Math.min(
            maximum,
            Math.max(
              minimum,
              Math.floor(
                parsed,
              ),
            ),
          )
        : minimum

    setQuantityByOfferId(
      (current) => ({
        ...current,
        [offerId]:
          normalized,
      }),
    )

    return normalized
  }

  const packId =
    useMemo(
      () =>
        product?.pack
          ?.id ||
        product?.pack
          ?._id ||
        product?.packId ||
        product?.canonicalPackId ||
        null,
      [
        product,
      ],
    )

  async function syncExistingCartQuantity(
    offer,
    nextQuantity,
  ) {
    const floatingCart =
      readFloatingMarketplaceCart()

    if (
      !floatingCart?.cartId ||
      !packId
    ) {
      return
    }

    const existingItem =
      floatingCart.items.find(
        (
          item,
        ) =>
          String(
            item?.packId ||
            '',
          ) ===
            String(
              packId,
            ) &&
          (
            !item?.offerId ||
            String(
              item.offerId,
            ) ===
              String(
                offer?.id ||
                '',
              )
          ),
      )

    if (
      !existingItem?.id ||
      Number(
        existingItem.quantity ||
        0,
      ) ===
        Number(
          nextQuantity,
        )
    ) {
      return
    }

    setError(
      null,
    )

    try {
      const result =
        await updateDirectMarketplaceCartItem({
          cartId:
            floatingCart.cartId,
          itemId:
            existingItem.id,
          operation:
            'set_quantity',
          quantity:
            nextQuantity,
        })

      const nextItems =
        mapMarketplaceCartItems(
          result,
        )

      saveFloatingMarketplaceCart({
        cartId:
          result?.cart?.id ||
          floatingCart.cartId,
        items:
          nextItems.length >
          0
            ? nextItems
            : floatingCart.items,
        pincode:
          result?.cart?.pincode ||
          floatingCart.pincode ||
          pincode.trim(),
        fulfillmentType:
          result?.cart?.fulfillmentType ||
          floatingCart.fulfillmentType ||
          'delivery',
      })
    } catch (
      quantityError
    ) {
      setError(
        getCommerceErrorMessage(
          quantityError,
          'Unable to update the Marketplace Cart quantity.',
        ),
      )
    }
  }

  function handleQuantityStep(
    offer,
    nextQuantity,
  ) {
    const normalized =
      setOfferQuantity(
        offer,
        nextQuantity,
      )

    if (
      normalized !==
      undefined
    ) {
      void syncExistingCartQuantity(
        offer,
        normalized,
      )
    }
  }

  async function handleCheckOffers(
    event,
  ) {
    event.preventDefault()

    if (
      !packId
    ) {
      setError(
        'Marketplace Pack identity is unavailable for this Product.',
      )

      return
    }

    setLoading(
      true,
    )

    setChecked(
      false,
    )

    setError(
      null,
    )

    try {
      const result =
        await getPublicPackOffers({
          packId,

          pincode:
            pincode.trim(),

          fulfillmentType:
            'delivery',
        })

      const nextOffers =
        result?.offers ||
        []

      setOffers(
        nextOffers,
      )

      onOffersResolved?.({
        offer:
          nextOffers[0] ||
          null,

        pincode:
          pincode.trim(),
      })

      setQuantityByOfferId(
        (current) => {
          const next =
            {}

          const floatingCart =
            readFloatingMarketplaceCart()

          const floatingItem =
            floatingCart?.items?.find(
              (
                item,
              ) =>
                String(
                  item?.packId ||
                  '',
                ) ===
                String(
                  packId ||
                  '',
                ),
            )

          for (
            const offer
            of nextOffers
          ) {
            const {
              minimum,
              maximum,
            } =
              getOfferQuantityBounds(
                offer,
              )

            const cartQuantity =
              Number(
                floatingItem?.quantity,
              )

            const existing =
              Number.isInteger(
                cartQuantity,
              )
                ? cartQuantity
                : Number(
                    current[
                      offer.id
                    ],
                  )

            next[offer.id] =
              Number.isInteger(
                existing,
              )
                ? Math.min(
                    maximum,
                    Math.max(
                      minimum,
                      existing,
                    ),
                  )
                : minimum
          }

          return next
        },
      )

      setChecked(
        true,
      )
    } catch (nextError) {
      setOffers(
        [],
      )

      onOffersResolved?.({
        offer:
          null,

        pincode:
          pincode.trim(),
      })

      setChecked(
        true,
      )

      setError(
        nextError?.message ||
        'Unable to check Marketplace Offers.',
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  async function handleAddToCart(
    offer,
    sourceElement,
  ) {
    if (
      !packId ||
      !offer?.id ||
      !pincode.trim() ||
      addingOfferId
    ) {
      return
    }

    const quantity =
      getOfferQuantity(
        offer,
      )

    setAddingOfferId(
      offer.id,
    )

    setError(
      null,
    )

    try {
      const existingFloatingCart =
        readFloatingMarketplaceCart()

      const result =
        await createDirectMarketplaceCart({
          cartId:
            existingFloatingCart?.cartId ||
            null,

          packId,

          offerId:
            offer.id,

          quantity,

          pincode:
            pincode.trim(),

          fulfillmentType:
            'delivery',

          idempotencyKey:
            createCommerceIdempotencyKey(
              'direct-product-cart',
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

      const cartItemName =
        product?.displayName ||
        product?.name ||
        'Product'

      const mappedItems =
        mapMarketplaceCartItems(
          result,
        )

      const floatingItems =
        mappedItems.length >
          0
          ? mappedItems
          : [
              {
                id:
                  packId,
                packId,
                name:
                  cartItemName,
                quantity,
              },
            ]

      saveFloatingMarketplaceCart({
        cartId,
        items:
          floatingItems,
        pincode:
          result?.cart?.pincode ||
          pincode.trim(),
        fulfillmentType:
          result?.cart?.fulfillmentType ||
          'delivery',
      })

      notifyFloatingCartFly({
        name:
          cartItemName,
        sourceElement,
      })

    } catch (
      cartError
    ) {
      setError(
        getCommerceErrorMessage(
          cartError,
          'Unable to add this Offer to the Marketplace Cart.',
        ),
      )
    } finally {
      setAddingOfferId(
        '',
      )
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white shadow-[0_12px_34px_rgba(4,120,87,0.08)]">

      <div className="flex items-center gap-3 px-4 pb-2 pt-4">

        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
          <Store
            size={19}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <h2 className="text-sm font-black text-stone-950">
            Check price by pincode
          </h2>
          <p className="mt-0.5 text-[11px] leading-4 text-stone-500">
            See live Host price and delivery availability.
          </p>
        </div>

      </div>

      <form
        onSubmit={handleCheckOffers}
        className="grid gap-2 px-4 pb-4 pt-2 sm:grid-cols-[minmax(0,1fr)_auto]"
      >

        <div className="relative min-w-0">
          <MapPin
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />

          <input
            required
            inputMode="numeric"
            pattern="[0-9 ]{6,7}"
            value={pincode}
            onChange={(event) => setPincode(event.target.value)}
            className="focus-ring h-11 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3 text-sm font-bold text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="Enter 6-digit pincode"
          />
        </div>

        <button
          disabled={loading}
          className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(4,120,87,0.18)] transition hover:bg-emerald-800 disabled:opacity-50"
        >
          <Search
            size={15}
            aria-hidden="true"
          />
          {loading ? 'Checking...' : 'Check'}
        </button>

      </form>

      {error && (
        <p className="mx-4 mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {checked && !error && offers.length === 0 && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
          <p className="text-xs font-black text-stone-800">
            No eligible Offers for this pincode.
          </p>
          <p className="mt-1 text-[11px] leading-4 text-stone-500">
            Availability can depend on serviceability, current price and inventory.
          </p>
        </div>
      )}

      {offers.length === 0 && (
        <div className="border-t border-emerald-100 px-4 py-3">
          <button
            type="button"
            disabled
            className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-100 px-4 text-xs font-black text-stone-500"
          >
            <ShoppingCart
              size={15}
              aria-hidden="true"
            />
            {checked
              ? 'Add to Cart unavailable for this pincode'
              : 'Check pincode to unlock Add to Cart'}
          </button>
        </div>
      )}

      {offers.length > 0 && (
        <div className="space-y-3 border-t border-emerald-100 px-4 py-4">
          {offers.map((offer) => (
            <article
              key={offer.id}
              className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_10px_28px_rgba(4,120,87,0.08)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
                    {offer.seller?.name || 'Marketplace Host'}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold capitalize text-stone-500">
                    {offer.fulfillmentTypes?.join(' · ') || 'Delivery'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-800">
                  In stock
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Your price
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-3xl font-black tracking-tight text-stone-950">
                        {formatMoney(
                          offer.price?.effectiveAmountMinor,
                          offer.price?.currency || 'INR',
                        )}
                      </p>

                      {offer.price?.saleAmountMinor !== null &&
                        offer.price?.saleAmountMinor !== undefined &&
                        offer.price?.listAmountMinor !== offer.price?.saleAmountMinor && (
                          <p className="text-xs font-bold text-stone-400 line-through">
                            {formatMoney(
                              offer.price?.listAmountMinor,
                              offer.price?.currency || 'INR',
                            )}
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Quantity
                    </p>
                    <div className="inline-flex items-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-inner">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={
                          Boolean(addingOfferId) ||
                          getOfferQuantity(offer) <= getOfferQuantityBounds(offer).minimum
                        }
                        onClick={() =>
                          handleQuantityStep(offer, getOfferQuantity(offer) - 1)
                        }
                        className="focus-ring grid h-10 w-10 place-items-center text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus size={15} aria-hidden="true" />
                      </button>

                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label="Quantity"
                        min={getOfferQuantityBounds(offer).minimum}
                        max={getOfferQuantityBounds(offer).maximum}
                        value={getOfferQuantity(offer)}
                        disabled={Boolean(addingOfferId)}
                        onChange={(event) =>
                          setOfferQuantity(offer, event.target.value)
                        }
                        onBlur={() =>
                          void syncExistingCartQuantity(
                            offer,
                            getOfferQuantity(offer),
                          )
                        }
                        className="h-10 w-12 border-x border-stone-200 bg-white text-center text-sm font-black text-stone-950 outline-none disabled:opacity-50"
                      />

                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={
                          Boolean(addingOfferId) ||
                          getOfferQuantity(offer) >= getOfferQuantityBounds(offer).maximum
                        }
                        onClick={() =>
                          handleQuantityStep(offer, getOfferQuantity(offer) + 1)
                        }
                        className="focus-ring grid h-10 w-10 place-items-center text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(addingOfferId)}
                  onClick={(event) =>
                    handleAddToCart(
                      offer,
                      event.currentTarget,
                    )
                  }
                  className="focus-ring mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 px-5 text-sm font-black text-white shadow-[0_10px_22px_rgba(4,120,87,0.22)] transition hover:from-emerald-900 hover:to-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart size={17} aria-hidden="true" />
                  {addingOfferId === offer.id
                    ? 'Adding...'
                    : `Add ${getOfferQuantity(offer)} to Cart`}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

    </section>
  )

}

function productDetailLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function ProductDetailsSheet({
  product,
}) {
  const nutrients =
    Array.isArray(
      product?.nutrition
        ?.nutrients,
    )
      ? product.nutrition.nutrients
      : []

  const allergens =
    Array.isArray(
      product?.allergens,
    )
      ? product.allergens
      : []

  const detailRows = [
    [
      'Brand',
      product?.brand?.name ||
        'Not declared',
    ],
    [
      'Category',
      product?.category?.name ||
        'Not declared',
    ],
    [
      'Net quantity',
      formatQuantity(
        product?.netQuantity,
      ),
    ],
    [
      'Pack',
      product?.pack?.name ||
        product?.pack?.type ||
        'Not declared',
    ],
    [
      'GTIN',
      product?.gtin ||
        'Not declared',
    ],
    [
      'Country of origin',
      product?.countryOfOrigin ||
        'Not declared',
    ],
    [
      'Manufacturer / supplier',
      product?.manufacturerName ||
        'Not declared',
    ],
    [
      'Serving size',
      product?.nutrition
        ?.servingSize
        ? formatQuantity(
            product.nutrition.servingSize,
          )
        : 'Not declared',
    ],
  ]

  return (
    <div className="flex h-full w-full items-stretch justify-center bg-[#f4f7f2] p-4 sm:p-6 xl:p-8">
      <div className="flex h-full w-full max-w-[760px] flex-col overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-[0_18px_42px_rgba(4,120,87,0.10)]">
        <div className="border-b border-emerald-800 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-5 py-5 text-white sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
            EPANTRY · Product details sheet
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
            {product?.displayName ||
              'Product'}
          </h2>
          <p className="mt-1 text-xs font-semibold text-emerald-100/80">
            Published listing details · generated from governed product data
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {detailRows.map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={label}
                  className="border-b border-stone-100 pb-2"
                >
                  <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-400">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-xs font-black text-stone-900">
                    {value}
                  </dd>
                </div>
              ),
            )}
          </dl>

          <div className="mt-5 border-t border-stone-200 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Ingredients
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
              {product?.ingredientDeclarationText ||
                (product?.ingredients
                  ?.length
                  ? product.ingredients
                      .map(
                        (
                          ingredient,
                        ) =>
                          ingredient?.displayName,
                      )
                      .filter(
                        Boolean,
                      )
                      .join(
                        ', ',
                      )
                  : 'Not declared')}
            </p>
          </div>

          <div className="mt-4 border-t border-stone-200 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Allergens
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
              {product?.allergenStatement ||
                (allergens.length
                  ? allergens
                      .map(
                        (
                          allergen,
                        ) =>
                          `${productDetailLabel(
                            allergen?.allergenKey,
                          )} (${productDetailLabel(
                            allergen?.relationType,
                          )})`,
                      )
                      .join(
                        ', ',
                      )
                  : 'Not declared')}
            </p>
          </div>

          <div className="mt-4 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Nutrition
              </p>
              <span className="text-[10px] font-black text-stone-500">
                {product?.nutrition
                  ?.basis
                  ? productDetailLabel(
                      product.nutrition.basis,
                    )
                  : 'Declared basis'}
              </span>
            </div>

            {nutrients.length ? (
              <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">
                {nutrients.map(
                  (
                    nutrient,
                    index,
                  ) => (
                    <div
                      key={`${nutrient?.nutrientKey ||
                        'nutrient'}-${index}`}
                      className="flex items-center justify-between gap-2 border-b border-stone-100 py-1.5 text-[11px]"
                    >
                      <span className="font-bold text-stone-500">
                        {productDetailLabel(
                          nutrient?.nutrientKey,
                        )}
                      </span>
                      <span className="font-black text-stone-950">
                        {nutrient?.amount ??
                          '—'}{' '}
                        {nutrient?.unit ||
                          ''}
                      </span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-stone-500">
                Nutrition not declared.
              </p>
            )}
          </div>

          {product?.claims
            ?.length ||
          product?.certifications
            ?.length ? (
            <div className="mt-4 border-t border-stone-200 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Claims & certifications
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ...(product?.claims ||
                    []),
                  ...(product?.certifications ||
                    []),
                ].map(
                  (
                    item,
                    index,
                  ) => (
                    <span
                      key={`${item?.key ||
                        item?.label ||
                        'detail'}-${index}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800"
                    >
                      {item?.label ||
                        productDetailLabel(
                          item?.key,
                        )}
                    </span>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const {
    slug,
  } =
    useParams()

  const {
    product,
    loading,
    error,
  } =
    useProductDetail(
      slug,
    )

  const [
    zoomPreview,
    setZoomPreview,
  ] =
    useState(
      null,
    )

  const [
    showAllImages,
    setShowAllImages,
  ] =
    useState(
      false,
    )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f4ef]">

        <div className="page-shell py-10">

          <div className="h-[560px] animate-pulse rounded-[24px] border border-stone-200 bg-white" />

        </div>

      </main>
    )
  }

  if (
    error ||
    !product
  ) {
    return (
      <main className="min-h-screen bg-[#f5f4ef]">

        <div className="page-shell py-12">

          <EmptyState
            title="Product unavailable"
            description={
              error ||
              'This published product could not be found.'
            }
          />

        </div>

      </main>
    )
  }

  const productImages =
    (
      product.images
        ?.length
        ? product.images
        : product.image
          ?.url
          ? [
              product.image,
            ]
          : []
    ).filter(
      (image) =>
        Boolean(
          image?.url,
        ),
    )

  const productGalleryItems =
    productImages.length
      ? [
          {
            type:
              'image',

            image:
              productImages[0],
          },
          {
            type:
              'details',
          },
          ...productImages
            .slice(
              1,
            )
            .map(
              (
                image,
              ) => ({
                type:
                  'image',

                image,
              }),
            ),
        ]
      : [
          {
            type:
              'details',
          },
        ]

  const imageCount =
    productGalleryItems.length

  const visibleProductImages =
    productGalleryItems.slice(
      0,
      4,
    )

  const hasClaimsOrCertifications =
    product.claims
      ?.length >
      0 ||
    product.certifications
      ?.length >
      0

  return (
    <main className="min-h-screen bg-[#f5f4ef]">

      <div className="page-shell pb-10 pt-3 sm:pt-4">

        <Link
          to="/grocery"
          className="focus-ring inline-flex items-center gap-2 text-sm font-black text-emerald-800 transition hover:text-emerald-950"
        >
          <ArrowLeft
            size={16}
            aria-hidden="true"
          />

          Back to Grocery
        </Link>

        <section className="mt-3 rounded-[24px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,23,0.08)]">

          <div className="grid items-start xl:grid-cols-[minmax(0,1.04fr)_minmax(430px,0.96fr)]">

            <div className="overflow-hidden rounded-t-[24px] border-b border-stone-200 bg-[#fafafa] xl:rounded-l-[24px] xl:rounded-tr-none xl:border-b-0 xl:border-r">

              {imageCount >
              0 ? (
                <div className="bg-white">

                  {visibleProductImages.map(
                    (
                      item,
                      index,
                    ) => {
                      if (
                        item.type ===
                        'details'
                      ) {
                        return (
                          <div
                            key="product-details-sheet"
                            className="relative h-[480px] overflow-hidden bg-white sm:h-[580px] lg:h-[660px] xl:h-[720px]"
                          >
                            <ProductDetailsSheet
                              product={
                                product
                              }
                            />

                            {imageCount >
                              4 &&
                              index ===
                                3 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllImages(
                                    true,
                                  )
                                }
                                className="focus-ring absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-4 py-2.5 text-xs font-black text-stone-900 shadow-lg backdrop-blur-md transition hover:border-emerald-300 hover:text-emerald-800"
                              >
                                <Images
                                  size={16}
                                  aria-hidden="true"
                                />
                                View all images ({imageCount})
                              </button>
                            ) : null}
                          </div>
                        )
                      }

                      const image =
                        item.image

                      return (
                        <div
                          key={`${image.url}-${index}`}
                          className="relative flex h-[480px] items-center justify-center overflow-hidden bg-white sm:h-[580px] lg:h-[660px] xl:h-[720px]"
                          onMouseMove={(
                            event,
                          ) => {
                            const bounds =
                              event.currentTarget.getBoundingClientRect()

                            const x =
                              Math.max(
                                0,
                                Math.min(
                                  100,
                                  ((event.clientX - bounds.left) / bounds.width) * 100,
                                ),
                              )

                            const y =
                              Math.max(
                                0,
                                Math.min(
                                  100,
                                  ((event.clientY - bounds.top) / bounds.height) * 100,
                                ),
                              )

                            setZoomPreview({
                              url:
                                image.url,
                              alt:
                                image.alt ||
                                product.displayName,
                              x,
                              y,
                            })
                          }}
                          onMouseLeave={() =>
                            setZoomPreview(
                              null,
                            )
                          }
                        >

                          <img
                            src={
                              image.url
                            }
                            alt={
                              image.alt ||
                              product.displayName
                            }
                            className="h-full w-full object-contain p-5 sm:p-8 xl:p-10"
                          />

                          {zoomPreview?.url ===
                            image.url && (
                            <div
                              className="pointer-events-none absolute hidden h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-emerald-600 bg-emerald-100/15 shadow-[0_10px_30px_rgba(5,150,105,0.2)] backdrop-blur-[1px] xl:block"
                              style={{
                                left: `${zoomPreview.x}%`,
                                top: `${zoomPreview.y}%`,
                              }}
                              aria-hidden="true"
                            />
                          )}

                          {imageCount >
                            4 &&
                            index ===
                              3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllImages(
                                    true,
                                  )
                                }
                                className="focus-ring absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-4 py-2.5 text-xs font-black text-stone-900 shadow-lg backdrop-blur-md transition hover:border-emerald-300 hover:text-emerald-800"
                              >
                                <Images
                                  size={16}
                                  aria-hidden="true"
                                />
                                View all images ({imageCount})
                              </button>
                            )}

                        </div>
                      )
                    },
                  )}

                </div>
              ) : (
                <div className="grid h-[480px] place-items-center bg-white text-stone-300 sm:h-[580px] lg:h-[660px] xl:h-[720px]">

                  <Package
                    size={64}
                    strokeWidth={1.4}
                    aria-hidden="true"
                  />

                </div>
              )}

            </div>

            <div className="relative bg-white p-6 sm:p-8 xl:sticky xl:top-24 xl:min-h-[720px] xl:rounded-r-[24px] xl:p-8">

              {zoomPreview && (
                <div
                  className="pointer-events-none absolute inset-x-4 top-4 z-40 hidden h-[520px] overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_26px_70px_rgba(28,25,23,0.24)] xl:block"
                  aria-label={`Zoomed preview of ${zoomPreview.alt}`}
                >
                  <div
                    className="h-full w-full bg-white bg-no-repeat"
                    style={{
                      backgroundImage: `url(${zoomPreview.url})`,
                      backgroundPosition: `${zoomPreview.x}% ${zoomPreview.y}%`,
                      backgroundSize:
                        '255%',
                    }}
                  />

                  <div className="absolute left-3 top-3 rounded-full bg-stone-950/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                    Zoom preview
                  </div>
                </div>
              )}

              <p className="text-sm font-black text-emerald-700">
                {
                  product.brand
                    ?.name
                }
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-stone-950 sm:text-4xl xl:text-[42px] xl:leading-[1.02]">
                {
                  product.displayName
                }
              </h1>

              <p className="mt-4 text-sm font-bold text-stone-600">
                Net quantity{' '}
                <span className="font-black text-stone-950">
                  {
                    formatQuantity(
                      product.netQuantity,
                    )
                  }
                </span>
              </p>

              <details className="group mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">

                <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 bg-stone-50/80 px-4 py-4 text-sm font-black text-stone-950 transition hover:bg-stone-100">
                  <span>
                    Product details
                  </span>

                  <ChevronDown
                    size={18}
                    className="transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>

                <dl className="divide-y divide-stone-200 border-t border-stone-200">

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      Net quantity
                    </dt>
                    <dd className="text-sm font-black text-stone-950">
                      {
                        formatQuantity(
                          product.netQuantity,
                        )
                      }
                    </dd>
                  </div>

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      Pack
                    </dt>
                    <dd className="overflow-x-auto whitespace-nowrap pb-0.5 text-sm font-black capitalize text-stone-950">
                      {
                        product.pack
                          ?.name ||
                        product.pack
                          ?.type ||
                        'Not declared'
                      }
                    </dd>
                  </div>

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      Category
                    </dt>
                    <dd className="text-sm font-black text-stone-950">
                      {
                        product.category
                          ?.name ||
                        'Not declared'
                      }
                    </dd>
                  </div>

                  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 px-4 py-3">
                    <dt className="text-xs font-bold text-stone-500">
                      GTIN
                    </dt>
                    <dd className="break-all text-sm font-black text-stone-950">
                      {
                        product.gtin ||
                        'Not declared'
                      }
                    </dd>
                  </div>

                </dl>

              </details>

              <div className="mt-5">
                <MarketplaceOffers
                  product={
                    product
                  }
                />
              </div>

            </div>

          </div>

        </section>

        {showAllImages && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/65 p-4 backdrop-blur-sm sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="All product images"
            onClick={() =>
              setShowAllImages(
                false,
              )
            }
          >
            <div
              className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-[#f7f7f5] shadow-2xl"
              onClick={(
                event,
              ) =>
                event.stopPropagation()
              }
            >

              <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Product gallery
                  </p>
                  <h2 className="mt-1 text-lg font-black text-stone-950">
                    All images ({imageCount})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAllImages(
                      false,
                    )
                  }
                  className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100"
                  aria-label="Close product gallery"
                >
                  <X
                    size={19}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="max-h-[calc(90vh-76px)] overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {productGalleryItems.map(
                    (
                      item,
                      index,
                    ) =>
                      item.type ===
                      'details' ? (
                        <div
                          key="all-product-details-sheet"
                          className="min-h-[430px] overflow-hidden rounded-2xl border border-emerald-200 bg-white"
                        >
                          <ProductDetailsSheet
                            product={
                              product
                            }
                          />
                        </div>
                      ) : (
                        <div
                          key={`all-${item.image.url}-${index}`}
                          className="flex min-h-[330px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white sm:min-h-[430px]"
                        >
                          <img
                            src={
                              item.image.url
                            }
                            alt={
                              item.image.alt ||
                              product.displayName
                            }
                            className="h-full max-h-[520px] w-full object-contain p-5"
                          />
                        </div>
                      ),
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        <section className="mt-6 grid gap-5 xl:grid-cols-2 xl:items-stretch">

          <section className="h-full overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_12px_34px_rgba(28,25,23,0.06)]">

            <div className="border-b border-stone-200 bg-stone-50/70 px-5 py-5 sm:px-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                Product information
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">
                About this product
              </h2>
            </div>

            <div className="divide-y divide-stone-200">

              <DetailCard
                title="Ingredients"
                icon={Package}
                description="Reviewed ingredient declaration and recognized ingredients"
              >
                <div className="space-y-4">
                  {product.ingredientDeclarationText && (
                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-4 shadow-[0_8px_20px_rgba(4,120,87,0.06)]">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-white">
                          <Package
                            size={15}
                            aria-hidden="true"
                          />
                        </span>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                            Reviewed ingredient declaration
                          </p>
                          <p className="mt-0.5 text-[10px] text-stone-500">
                            Published from the approved product record
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-sm font-semibold leading-6 text-stone-800">
                        {product.ingredientDeclarationText}
                      </p>
                    </div>
                  )}

                  {product.ingredients?.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                          Recognized ingredients
                        </p>
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
                          {product.ingredients.length} mapped
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {product.ingredients.map((ingredient, index) => (
                          <span
                            key={`${ingredient.ingredientId || 'ingredient'}-${index}`}
                            className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm"
                          >
                            {ingredient.displayName || 'Canonical ingredient'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                      <p className="text-xs leading-5 text-stone-500">
                        {product.ingredientDeclarationText
                          ? 'Canonical ingredient mapping is still pending. The reviewed package declaration is shown above.'
                          : 'Ingredient information has not been published for this product.'}
                      </p>
                    </div>
                  )}
                </div>
              </DetailCard>

              <div id="product-dietary-intelligence-slot" />

              <DetailCard
                title="Product origin"
                icon={Globe2}
                description="Where this product comes from and who made or packed it"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-4 shadow-[0_8px_20px_rgba(4,120,87,0.05)]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
                        <Globe2
                          size={18}
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          Country of origin
                        </p>
                        <p className="mt-1.5 break-words text-sm font-black leading-5 text-stone-900">
                          {product.countryOfOrigin || 'Not declared'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 via-white to-white p-4 shadow-[0_8px_20px_rgba(28,25,23,0.04)]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-900 text-white shadow-sm">
                        <Factory
                          size={18}
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-500">
                          Manufacturer / packer
                        </p>
                        <p className="mt-1.5 break-words text-sm font-black leading-5 text-stone-900">
                          {product.manufacturerName || 'Not declared'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </DetailCard>

              {hasClaimsOrCertifications && (
                <DetailCard title="Published claims & certifications">
                  <div className="flex flex-wrap gap-2">
                    {product.claims?.map((claim, index) => (
                      <span
                        key={`${claim.key}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800"
                      >
                        <ShieldCheck size={13} aria-hidden="true" />
                        {claim.label || claim.key}
                      </span>
                    ))}

                    {product.certifications?.map((certification, index) => (
                      <span
                        key={`${certification.key}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-700"
                      >
                        <BadgeCheck
                          size={13}
                          className="text-emerald-700"
                          aria-hidden="true"
                        />
                        {certification.label || certification.key}
                      </span>
                    ))}
                  </div>
                </DetailCard>
              )}

              <DetailCard
                title="Allergens"
                icon={ShieldCheck}
                description="Reviewed allergen declaration and governed relationships"
              >
                <div className="space-y-4">
                  {product.allergenStatement ? (
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-4 shadow-[0_8px_20px_rgba(180,83,9,0.05)]">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
                          <ShieldCheck
                            size={16}
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">
                            Reviewed package declaration
                          </p>
                          <p className="mt-1.5 text-sm font-bold leading-5 text-stone-900">
                            {product.allergenStatement}
                          </p>
                          <p className="mt-2 text-[10px] leading-4 text-stone-500">
                            A missing positive allergen relationship is not treated as an allergen-free claim.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {product.allergens?.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                          Published allergen relationships
                        </p>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[9px] font-black text-stone-600">
                          {product.allergens.length} recorded
                        </span>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {product.allergens.map((allergen, index) => (
                          <div
                            key={`${allergen.allergenKey}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-3"
                          >
                            <span className="text-xs font-black capitalize text-stone-800">
                              {allergen.allergenKey}
                            </span>
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-500 shadow-sm">
                              {allergen.relationType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                      <p className="text-xs leading-5 text-stone-500">
                        {product.allergenStatement
                          ? 'No positive governed allergen relationship is published beyond the reviewed package declaration above.'
                          : 'Allergen data is currently unknown or not published. EPANTRY does not infer missing safety facts.'}
                      </p>
                    </div>
                  )}

                  <div id="product-allergen-intelligence-slot" />
                </div>
              </DetailCard>

              <div id="product-lineage-intelligence-slot" />

              <div id="product-food-intelligence-slot" />


            </div>

          </section>

          <section className="h-full overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-[0_14px_38px_rgba(4,120,87,0.09)] ring-1 ring-emerald-100">

            <div className="border-b border-emerald-800 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-5 py-5 text-white sm:px-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Governed nutrition
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Nutrition
              </h2>
              <p className="mt-1 text-xs leading-5 text-emerald-50/80">
                Published values from the current approved product record.
              </p>
            </div>

            <div className="p-5 sm:p-6">
              {product.nutrition?.nutrients?.length > 0 ? (
                <div className="divide-y divide-stone-200">
                  {product.nutrition.nutrients.map((nutrient, index) => (
                    <div
                      key={`${nutrient.nutrientKey}-${index}`}
                      className="flex items-center justify-between gap-4 py-3.5 text-sm"
                    >
                      <span className="font-bold capitalize text-stone-600">
                        {nutrient.nutrientKey}
                      </span>
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-black text-emerald-950">
                        {nutrient.amount} {nutrient.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  Nutrition facts are not currently published.
                </p>
              )}

              <div id="product-nutrition-intelligence-slot" className="mt-5" />
            </div>

          </section>

        </section>

      </div>

    </main>
  )
}
