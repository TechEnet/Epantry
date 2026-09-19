import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Trash2,
  Truck,
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
  getMarketplaceCart,
  optimizeBasket,
  updateDirectMarketplaceCartItem,
} from '../services/commerce.service'

import {
  getDefaultDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

import {
  createOutcomePlanIdempotencyKey,
  createRecipeOutcomePlan,
  getOutcomePlanErrorMessage,
} from '../../outcomes/services/outcomePlan.service'

const RECIPE_CART_PENDING_KEY =
  'epantry-pending-recipe-cart'

const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

function notifyFloatingCartUpdated() {
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
}

function readRecipeCart() {
  try {
    const raw =
      window.sessionStorage.getItem(
        RECIPE_CART_PENDING_KEY,
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(raw)

    if (
      Array.isArray(
        parsed?.items,
      )
    ) {
      return parsed
    }

    const ingredientIds =
      Array.isArray(
        parsed?.ingredientIds,
      )
        ? parsed.ingredientIds
        : []

    const displayNames =
      Array.isArray(
        parsed?.displayNames,
      )
        ? parsed.displayNames
        : []

    if (
      ingredientIds.length >
      0
    ) {
      return {
        ...parsed,
        items:
          ingredientIds.map(
            (canonicalIngredientId, index) => ({
              canonicalIngredientId,
              name:
                displayNames[index] ||
                'Ingredient',
              quantity:
                null,
              unit:
                '',
            }),
          ),
      }
    }

    return parsed
  } catch {
    return null
  }
}

function clearRecipeCart() {
  try {
    window.sessionStorage.removeItem(
      RECIPE_CART_PENDING_KEY,
    )
  } catch {
    // Session persistence is best-effort UX state only.
  }
}

function writeRecipeCart(
  cart,
) {
  try {
    if (
      !cart ||
      !Array.isArray(cart.items) ||
      cart.items.length === 0
    ) {
      window.sessionStorage.removeItem(
        RECIPE_CART_PENDING_KEY,
      )
      return
    }

    window.sessionStorage.setItem(
      RECIPE_CART_PENDING_KEY,
      JSON.stringify(cart),
    )
  } catch {
    // Session persistence is best-effort UX state only.
  }
}

function formatRecipeQuantity(
  item,
) {
  const quantity =
    item?.quantity

  const unit =
    String(
      item?.unit ||
        '',
    ).trim()

  if (
    quantity ===
      null ||
    quantity ===
      undefined ||
    quantity ===
      ''
  ) {
    return 'Selected ingredient'
  }

  return `${quantity}${unit ? ` ${unit}` : ''}`
}

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

export default function MarketplaceCartPage() {
  const {
    cartId,
  } =
    useParams()

  const navigate =
    useNavigate()

  const location =
    useLocation()

  const isRecipeCart =
    cartId ===
    'recipe'

  const recipeCheckoutHandledRef =
    useRef(false)

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    refreshing,
    setRefreshing,
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

  const [
    recipeCart,
    setRecipeCart,
  ] =
    useState(
      () =>
        isRecipeCart
          ? readRecipeCart()
          : null,
    )

  const [
    placingRecipeOrder,
    setPlacingRecipeOrder,
  ] =
    useState(
      false,
    )

  const [
    recipeCoverageIssue,
    setRecipeCoverageIssue,
  ] =
    useState(
      null,
    )

  const [
    updatingCartItemId,
    setUpdatingCartItemId,
  ] =
    useState(
      '',
    )

  const loadCart =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (
          isRecipeCart
        ) {
          setRecipeCart(
            readRecipeCart(),
          )
          setLoading(false)
          setRefreshing(false)
          return
        }

        if (
          !cartId
        ) {
          setError(
            'Marketplace Cart ID is missing.',
          )

          setLoading(
            false,
          )

          return
        }

        if (
          refresh
        ) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(
            true,
          )
        }

        setError(
          '',
        )

        try {
          setData(
            await getMarketplaceCart(
              cartId,
            ),
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load this Marketplace Cart.',
            ),
          )
        } finally {
          setLoading(
            false,
          )

          setRefreshing(
            false,
          )
        }
      },
      [
        cartId,
        isRecipeCart,
      ],
    )

  useEffect(
    () => {
      loadCart()
    },
    [
      loadCart,
    ],
  )

  useEffect(
    () => {
      if (
        isRecipeCart ||
        !cartId
      ) {
        return undefined
      }

      const handleFloatingCartUpdated =
        () => {
          loadCart({
            refresh: true,
          })
        }

      window.addEventListener(
        'epantry-cart-updated',
        handleFloatingCartUpdated,
      )

      return () => {
        window.removeEventListener(
          'epantry-cart-updated',
          handleFloatingCartUpdated,
        )
      }
    },
    [
      cartId,
      isRecipeCart,
      loadCart,
    ],
  )

  const sellerGroups =
    useMemo(
      () => {
        const groups =
          new Map()

        for (
          const item
          of data?.items ||
          []
        ) {
          const key =
            String(
              item.organizationId ||
                '',
            )

          if (
            !groups.has(
              key,
            )
          ) {
            groups.set(
              key,
              {
                organizationId:
                  item.organizationId,

                sellerName:
                  item.sellerName,

                items:
                  [],

                subtotalMinor:
                  0,
              },
            )
          }

          const group =
            groups.get(
              key,
            )

          group.items.push(
            item,
          )

          group.subtotalMinor +=
            Number(
              item.lineTotal?.amountMinor ||
                0,
            )
        }

        return [
          ...groups.values(),
        ]
      },
      [
        data?.items,
      ],
    )

  const recipeItems =
    Array.isArray(
      recipeCart?.items,
    )
      ? recipeCart.items
      : []

  const finalizeRecipeOrder =
    useCallback(
      async () => {
        if (
          !isRecipeCart ||
          placingRecipeOrder ||
          recipeItems.length ===
            0
        ) {
          return
        }

        setPlacingRecipeOrder(true)
        setError('')
        setRecipeCoverageIssue(null)

        try {
          const addressResult =
            await getDefaultDeliveryAddress()

          const address =
            addressResult?.address ||
            null

          const normalizedPincode =
            String(
              address?.postalCode ||
                '',
            )
              .trim()
              .toUpperCase()

          if (
            !/^\d{6}$/.test(
              normalizedPincode,
            )
          ) {
            throw new Error(
              'Your selected delivery address does not contain a valid 6-digit pincode. Please update the address and try again.',
            )
          }

          const selectedIngredientIds =
            [
              ...new Set(
                recipeItems
                  .map(
                    (item) =>
                      String(
                        item?.canonicalIngredientId ||
                          '',
                      ).trim(),
                  )
                  .filter(Boolean),
              ),
            ]

          if (
            selectedIngredientIds.length ===
            0
          ) {
            throw new Error(
              'This Recipe Cart does not contain Marketplace-matchable ingredients yet.',
            )
          }

          const outcome =
            await createRecipeOutcomePlan(
              recipeCart.slug,
              {
                targetServings:
                  Number(
                    recipeCart.servings ||
                      1,
                  ),

                purchaseMode:
                  'full_recipe',

                selectedCanonicalIngredientIds:
                  selectedIngredientIds,

                idempotencyKey:
                  createOutcomePlanIdempotencyKey(
                    'recipe-cart-place-order',
                  ),
              },
            )

          const planId =
            outcome?.plan?.id

          if (!planId) {
            throw new Error(
              'Recipe shopping plan identity was not returned.',
            )
          }

          const quoteData =
            await optimizeBasket({
              outcomePlanId:
                planId,

              pincode:
                normalizedPincode,

              objective:
                'best_value',

              fulfillmentType:
                'delivery',

              idempotencyKey:
                createCommerceIdempotencyKey(
                  'recipe-cart-place-order-compare',
                ),
            })

          const preferredOptionKey =
            quoteData?.quote
              ?.recommendedOptionKey ||
            'best_value'

          const selectedOption =
            (
              quoteData?.options ||
              []
            ).find(
              (option) =>
                option.optionKey ===
                preferredOptionKey,
            ) ||
            (
              quoteData?.options ||
              []
            ).find(
              (option) =>
                option.optionKey ===
                'best_value',
            ) ||
            null

          const totalRequirementCount =
            Number(
              selectedOption
                ?.totalRequirementCount ||
                0,
            )

          const matchedRequirementCount =
            Number(
              selectedOption
                ?.matchedRequirementCount ||
                0,
            )

          const hasFullCoverage =
            totalRequirementCount >
              0 &&
            matchedRequirementCount ===
              totalRequirementCount

          if (
            !selectedOption ||
            !hasFullCoverage
          ) {
            const unmatchedLineIds =
              new Set(
                (
                  quoteData
                    ?.unmatchedRequirementLineIds ||
                  []
                ).map(
                  (value) =>
                    String(
                      value || '',
                    ),
                ),
              )

            const unmatchedRequirements =
              (
                outcome?.requirements ||
                []
              ).filter(
                (requirement) =>
                  unmatchedLineIds.has(
                    String(
                      requirement?.id ||
                        '',
                    ),
                  ),
              )

            const unmatchedCanonicalIngredientIds =
              [
                ...new Set(
                  unmatchedRequirements
                    .map(
                      (requirement) =>
                        String(
                          requirement
                            ?.canonicalIngredientId ||
                            '',
                        ),
                    )
                    .filter(Boolean),
                ),
              ]

            const unmatchedNames =
              [
                ...new Set(
                  unmatchedRequirements
                    .map(
                      (requirement) =>
                        String(
                          requirement?.label ||
                            '',
                        ).trim(),
                    )
                    .filter(Boolean),
                ),
              ]

            if (
              unmatchedNames.length ===
                0
            ) {
              for (
                const item
                of recipeItems
              ) {
                if (
                  unmatchedCanonicalIngredientIds.includes(
                    String(
                      item?.canonicalIngredientId ||
                        '',
                    ),
                  )
                ) {
                  unmatchedNames.push(
                    item?.name ||
                      'Recipe ingredient',
                  )
                }
              }
            }

            setRecipeCoverageIssue({
              pincode:
                normalizedPincode,
              matchedRequirementCount,
              totalRequirementCount,
              unmatchedCanonicalIngredientIds,
              unmatchedNames,
            })

            return
          }

          const cartResult =
            await createMarketplaceCart({
              basketQuoteId:
                quoteData.quote.id,

              optionKey:
                selectedOption.optionKey,

              idempotencyKey:
                createCommerceIdempotencyKey(
                  'recipe-marketplace-cart',
                ),
            })

          const marketplaceCartId =
            cartResult?.cart?.id

          if (!marketplaceCartId) {
            throw new Error(
              'Marketplace Cart identity was not returned.',
            )
          }

          saveFloatingMarketplaceCart({
            cartId:
              marketplaceCartId,
            items:
              recipeItems.map(
                (item) => ({
                  id:
                    item.canonicalIngredientId,
                  packId:
                    item.canonicalIngredientId,
                  name:
                    item.name ||
                    'Ingredient',
                  quantity:
                    item.quantity,
                }),
              ),
          })

          clearRecipeCart()
          notifyFloatingCartUpdated()

          navigate(
            `/checkout/${marketplaceCartId}`,
            {
              replace:
                true,
            },
          )
        } catch (
          recipeOrderError
        ) {
          setError(
            getCommerceErrorMessage(
              recipeOrderError,
              getOutcomePlanErrorMessage(
                recipeOrderError,
                'Unable to prepare this Recipe Cart for checkout.',
              ),
            ),
          )
        } finally {
          setPlacingRecipeOrder(false)
        }
      },
      [
        isRecipeCart,
        navigate,
        placingRecipeOrder,
        recipeCart,
        recipeItems,
      ],
    )

  useEffect(
    () => {
      if (
        !isRecipeCart ||
        location.state
          ?.recipeCartCheckout !==
          true ||
        location.state
          ?.deliveryAddressSaved !==
          true ||
        recipeCheckoutHandledRef.current
      ) {
        return
      }

      recipeCheckoutHandledRef.current =
        true

      finalizeRecipeOrder()
    },
    [
      finalizeRecipeOrder,
      isRecipeCart,
      location.state,
    ],
  )

  function handlePlaceRecipeOrder() {
    if (
      placingRecipeOrder ||
      recipeItems.length ===
        0
    ) {
      return
    }

    setError('')
    setRecipeCoverageIssue(null)

    navigate(
      `/delivery-addresses?returnTo=${encodeURIComponent(
        '/cart/recipe',
      )}`,
      {
        state: {
          recipeCartCheckout:
            true,
        },
      },
    )
  }

  function handleRemoveRecipeItem(
    canonicalIngredientId,
  ) {
    if (!canonicalIngredientId) {
      return
    }

    setError('')
    setRecipeCoverageIssue(null)

    setRecipeCart(
      (currentCart) => {
        if (!currentCart) {
          return currentCart
        }

        const nextCart = {
          ...currentCart,
          items: (
            currentCart.items ||
            []
          ).filter(
            (item) =>
              String(
                item?.canonicalIngredientId ||
                  '',
              ) !==
              String(
                canonicalIngredientId,
              ),
          ),
        }

        writeRecipeCart(
          nextCart,
        )

        notifyFloatingCartUpdated()

        return nextCart
      },
    )
  }

  if (isRecipeCart) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-5 sm:py-7 lg:py-8">
          <Link
            to={
              recipeCart?.slug
                ? `/recipes/${recipeCart.slug}`
                : '/recipes'
            }
            className="focus-ring inline-flex items-center gap-2 rounded-full px-1 py-2 text-sm font-black text-stone-600 transition hover:text-emerald-800"
          >
            <ArrowLeft
              size={17}
              aria-hidden="true"
            />
            Back to Recipe
          </Link>

          <section className="relative mt-3 overflow-hidden rounded-[30px] border border-emerald-200/80 bg-white shadow-[0_18px_55px_rgba(28,25,23,0.06)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(236,253,245,0.92)_0%,rgba(255,255,255,0.96)_48%,rgba(209,250,229,0.62)_100%)]" />
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-200/55 blur-3xl" />
            <div className="relative px-6 py-7 sm:px-8 lg:px-10 lg:py-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white/75 px-3 py-1.5 text-emerald-800 shadow-sm backdrop-blur-xl">
                    <ShoppingBasket
                      size={15}
                      aria-hidden="true"
                    />
                    <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                      Recipe Cart
                    </p>
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                    Review selected ingredients
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                    Keep only what you need, then continue to delivery address and eligible Host offers.
                  </p>
                </div>

                <div className="flex w-fit items-center gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                    <Package
                      size={18}
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                      Selected
                    </p>
                    <p className="text-lg font-black text-stone-950">
                      {recipeItems.length} ingredient{recipeItems.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          {recipeCoverageIssue && (
            <section className="mt-4 overflow-hidden rounded-[24px] border border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_55%,#fdf2f8_100%)] shadow-[0_12px_32px_rgba(159,18,57,0.08)]">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700">
                    <AlertTriangle
                      size={19}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">
                      Delivery coverage needed
                    </p>
                    <h2 className="mt-1 text-lg font-black text-stone-950">
                      {recipeCoverageIssue.unmatchedNames.length > 0
                        ? `${recipeCoverageIssue.unmatchedNames.join(', ')} ${recipeCoverageIssue.unmatchedNames.length === 1 ? 'is' : 'are'} not deliverable to this address yet.`
                        : 'Some Recipe items are not deliverable to this address yet.'}
                    </h2>
                    <p className="mt-1.5 max-w-3xl text-sm leading-6 text-stone-600">
                      EPANTRY checked active Host offers for pincode <span className="font-black text-stone-800">{recipeCoverageIssue.pincode}</span>. Try another delivery address, or remove the unavailable item before placing the order.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePlaceRecipeOrder}
                  className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-900/10 transition hover:bg-rose-800"
                >
                  <MapPin
                    size={16}
                    aria-hidden="true"
                  />
                  Change delivery address
                </button>
              </div>
            </section>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:grid-cols-[minmax(0,1fr)_370px]">
            <section className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_10px_35px_rgba(28,25,23,0.05)]">
              <header className="flex items-center justify-between gap-4 border-b border-stone-100 bg-gradient-to-r from-emerald-50/90 via-white to-white p-5 sm:p-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700">
                    Selected items
                  </p>
                  <h2 className="mt-1 text-xl font-black text-stone-950">
                    Your Recipe Cart
                  </h2>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
                  {recipeItems.length} item{recipeItems.length === 1 ? '' : 's'}
                </span>
              </header>

              {recipeItems.length > 0 ? (
                <div className="grid gap-3 p-4 sm:p-5">
                  {recipeItems.map(
                    (item, index) => (
                      <article
                        key={item.canonicalIngredientId}
                        className="group grid gap-4 rounded-[22px] border border-stone-200 bg-gradient-to-r from-white via-white to-stone-50/70 p-4 transition hover:border-emerald-200 hover:shadow-[0_10px_28px_rgba(5,150,105,0.08)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5"
                      >
                        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                          <span className="text-sm font-black">
                            {index + 1}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-black text-stone-950">
                              {item.name || 'Ingredient'}
                            </p>
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-rose-700">
                              Missing
                            </span>
                            {recipeCoverageIssue?.unmatchedCanonicalIngredientIds?.includes(
                              String(
                                item?.canonicalIngredientId ||
                                  '',
                              ),
                            ) && (
                              <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-fuchsia-700">
                                Not deliverable here
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-semibold text-stone-500">
                            Selected from this Recipe requirement
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="rounded-full bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">
                            {formatRecipeQuantity(item)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveRecipeItem(
                                item.canonicalIngredientId,
                              )
                            }
                            className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50"
                            aria-label={`Remove ${item.name || 'ingredient'} from Recipe Cart`}
                          >
                            <Trash2
                              size={14}
                              aria-hidden="true"
                            />
                            Remove
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              ) : (
                <div className="p-8 text-center sm:p-10">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <ShoppingBasket
                      size={22}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-4 font-black text-stone-950">
                    Your Recipe Cart is empty
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    Add missing ingredients from a Recipe first.
                  </p>
                </div>
              )}
            </section>

            <aside className="lg:sticky lg:top-24">
              <section className="overflow-hidden rounded-[26px] border border-emerald-200 bg-[linear-gradient(145deg,#ffffff_0%,#f0fdf4_100%)] shadow-[0_16px_45px_rgba(6,78,59,0.09)]">
                <div className="border-b border-emerald-100 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-800 text-white shadow-lg shadow-emerald-900/15">
                      <ReceiptText
                        size={19}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700">
                        Next step
                      </p>
                      <h2 className="text-lg font-black text-stone-950">
                        Place your order
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5 sm:p-6">
                  <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-stone-600">
                        Recipe items
                      </span>
                      <span className="grid min-w-8 place-items-center rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-black text-emerald-900">
                        {recipeItems.length}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePlaceRecipeOrder}
                    disabled={
                      placingRecipeOrder ||
                      recipeItems.length === 0
                    }
                    className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      recipeCoverageIssue
                        ? 'bg-rose-700 shadow-rose-900/15 hover:bg-rose-800'
                        : 'bg-emerald-800 shadow-emerald-900/15 hover:bg-emerald-900'
                    }`}
                  >
                    {placingRecipeOrder
                      ? 'Preparing order…'
                      : recipeCoverageIssue
                        ? 'Try another delivery address'
                        : 'Place your order'}
                    <ArrowRight
                      size={17}
                      aria-hidden="true"
                    />
                  </button>

                  <div className="grid gap-2.5 border-t border-emerald-100 pt-4 text-xs font-semibold text-stone-600">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck
                        size={15}
                        className="mt-0.5 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>
                        {recipeCoverageIssue
                          ? 'Choose another saved address or add a new delivery address.'
                          : 'Choose or add your delivery address next.'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Truck
                        size={15}
                        className="mt-0.5 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>Eligible Host offers are resolved for that address.</span>
                    </div>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    )
  }

  async function mutateDirectCartItem(
    item,
    operation,
    quantity,
  ) {
    const itemId =
      String(
        item?.id ||
          item?.packId ||
          '',
      ).trim()

    if (
      !cartId ||
      !itemId ||
      updatingCartItemId
    ) {
      return
    }

    setError('')
    setUpdatingCartItemId(
      itemId,
    )

    try {
      const result =
        await updateDirectMarketplaceCartItem({
          cartId,
          itemId,
          operation,
          ...(quantity === undefined
            ? {}
            : {
                quantity,
              }),
        })

      setData(
        result,
      )

      const nextItems =
        Array.isArray(
          result?.items,
        )
          ? result.items.map(
              (
                cartItem,
              ) => ({
                id:
                  cartItem.id ||
                  cartItem.packId ||
                  cartItem.displayName,

                packId:
                  cartItem.packId ||
                  '',

                name:
                  cartItem.displayName ||
                  'Product',

                quantity:
                  Number(
                    cartItem.packCount ||
                      1,
                  ),
              }),
            )
          : []

      try {
        if (
          nextItems.length ===
          0
        ) {
          window.sessionStorage.removeItem(
            FLOATING_MARKETPLACE_CART_KEY,
          )
        } else {
          window.sessionStorage.setItem(
            FLOATING_MARKETPLACE_CART_KEY,
            JSON.stringify({
              cartId:
                result?.cart?.id ||
                cartId,
              items:
                nextItems,
              updatedAt:
                new Date().toISOString(),
            }),
          )
        }
      } catch {
        // Session persistence is best-effort UX state only.
      }

      window.dispatchEvent(
        new CustomEvent(
          'epantry-cart-updated',
          {
            detail: {
              show: false,
            },
          },
        ),
      )
    } catch (
      mutationError
    ) {
      setError(
        getCommerceErrorMessage(
          mutationError,
          'Unable to update this Cart item.',
        ),
      )
    } finally {
      setUpdatingCartItemId(
        '',
      )
    }
  }

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-6 sm:py-8">
          <div className="h-[560px] animate-pulse rounded-[30px] border border-stone-200 bg-white" />
        </div>
      </main>
    )
  }

  const cart =
    data?.cart ||
    {}

  const isDirectProductCart =
    cart.sourceType ===
    'direct_product'

  const itemCount =
    (data?.items ||
      []).reduce(
      (
        total,
        item,
      ) =>
        total +
        Number(
          item.packCount ||
            0,
        ),
      0,
    )

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f2ea] text-stone-950">
      <style>{`
        @keyframes epCartRise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes epCartDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, 14px, 0) scale(1.05); }
        }

        @keyframes epCartSheen {
          0% { transform: translateX(-140%) skewX(-18deg); }
          55%, 100% { transform: translateX(240%) skewX(-18deg); }
        }

        .ep-cart-rise {
          animation: epCartRise 560ms cubic-bezier(.2,.7,.2,1) both;
        }

        .ep-cart-drift {
          animation: epCartDrift 8s ease-in-out infinite;
        }

        .ep-cart-sheen::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 34%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          animation: epCartSheen 4.8s ease-in-out infinite;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .ep-cart-rise,
          .ep-cart-drift,
          .ep-cart-sheen::after {
            animation: none !important;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="ep-cart-drift absolute -left-24 top-40 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="ep-cart-drift absolute -right-28 top-[34rem] h-96 w-96 rounded-full bg-lime-200/20 blur-3xl [animation-delay:-3s]" />
      </div>

      <div className="page-shell relative py-5 sm:py-7 lg:py-8">
        <div className="ep-cart-rise flex flex-wrap items-center justify-between gap-3">
          <Link
            to={
              isDirectProductCart
                ? '/grocery'
                : `/outcome-plans/${cart.outcomePlanId}/compare`
            }
            className="focus-ring group inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-2 text-sm font-black text-stone-600 transition duration-300 hover:border-emerald-200 hover:bg-white/75 hover:text-emerald-900"
          >
            <ArrowLeft
              size={17}
              className="transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />

            {isDirectProductCart
              ? 'Back to Grocery'
              : 'Back to Fulfillment Compare'}
          </Link>

          <button
            type="button"
            onClick={() =>
              loadCart({
                refresh:
                  true,
              })
            }
            disabled={
              refreshing
            }
            className="focus-ring group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/85 px-4 py-2.5 text-sm font-black text-stone-700 shadow-[0_8px_24px_rgba(28,25,23,0.07)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:text-emerald-800 hover:shadow-[0_12px_28px_rgba(6,78,59,0.10)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? 'animate-spin'
                  : 'transition-transform duration-500 group-hover:rotate-180'
              }
              aria-hidden="true"
            />

            {refreshing
              ? 'Refreshing…'
              : 'Refresh cart'}
          </button>
        </div>

        <section className="ep-cart-rise relative mt-4 overflow-hidden rounded-[34px] border border-emerald-800/20 bg-[linear-gradient(135deg,#062e25_0%,#0a4b3a_52%,#0f6a52_100%)] text-white shadow-[0_28px_80px_rgba(6,78,59,0.18)] [animation-delay:70ms]">
          <div className="pointer-events-none absolute -right-14 -top-20 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-[28%] h-64 w-64 rounded-full bg-lime-200/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_38%)]" />

          <div className="relative px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-white/10 px-3 py-1.5 text-emerald-50 backdrop-blur-xl">
                  <ShoppingBasket
                    size={15}
                    aria-hidden="true"
                  />

                  <p className="text-[11px] font-black uppercase tracking-[0.18em]">
                    Marketplace Cart
                  </p>
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl lg:text-[44px]">
                  Review your cart
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/75 sm:text-base">
                  {isDirectProductCart
                    ? 'Your selected product and Host Offer are ready for review. Price, inventory and serviceability are checked again before payment.'
                    : 'Review your selected Marketplace items and seller splits before moving to checkout.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
                <div className="group rounded-[22px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white/15">
                  <div className="flex items-center gap-2 text-emerald-100/75">
                    <Store
                      size={15}
                      aria-hidden="true"
                    />

                    <p className="text-[10px] font-black uppercase tracking-[0.13em]">
                      Sellers
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-black text-white">
                    {sellerGroups.length}
                  </p>
                </div>

                <div className="group rounded-[22px] border border-emerald-200/40 bg-emerald-100 px-4 py-4 text-emerald-950 shadow-[0_14px_32px_rgba(0,0,0,0.15)] transition duration-300 hover:-translate-y-1 hover:bg-white">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Package
                      size={15}
                      aria-hidden="true"
                    />

                    <p className="text-[10px] font-black uppercase tracking-[0.13em]">
                      Packs
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-black">
                    {itemCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {[
                ['01', 'Review', true],
                ['02', 'Checkout', false],
                ['03', 'Payment', false],
              ].map(([step, label, active]) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl transition duration-300 ${
                    active
                      ? 'border-emerald-200/45 bg-white/14 text-white'
                      : 'border-white/10 bg-black/5 text-emerald-100/55'
                  }`}
                >
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-black ${
                    active
                      ? 'bg-emerald-100 text-emerald-950'
                      : 'bg-white/10 text-emerald-100/70'
                  }`}>
                    {step}
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.12em]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="ep-cart-rise mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm [animation-delay:100ms]">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span>
              {error}
            </span>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="ep-cart-rise space-y-4 [animation-delay:140ms]">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Cart items
                </p>

                <h2 className="mt-1 text-xl font-black tracking-tight text-stone-950 sm:text-2xl">
                  Items grouped by seller
                </h2>
              </div>

              <div className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-black text-stone-500 shadow-sm backdrop-blur-lg">
                {itemCount} pack
                {itemCount ===
                1
                  ? ''
                  : 's'}
              </div>
            </div>

            {sellerGroups.map(
              (
                group,
              ) => (
                <article
                  key={
                    group.organizationId
                  }
                  className="overflow-hidden rounded-[30px] border border-stone-200/90 bg-white shadow-[0_14px_45px_rgba(28,25,23,0.06)]"
                >
                  <header className="relative overflow-hidden bg-[linear-gradient(120deg,#064e3b_0%,#065f46_55%,#047857_100%)] p-5 text-white sm:p-6">
                    <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-emerald-300/15 blur-3xl" />

                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/12 text-emerald-50 shadow-sm">
                          <Store
                            size={20}
                            aria-hidden="true"
                          />
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-emerald-200">
                            Seller / Host
                          </p>

                          <h3 className="mt-0.5 text-lg font-black text-white sm:text-xl">
                            {group.sellerName}
                          </h3>

                          <p className="mt-1 text-xs font-semibold text-emerald-100/75">
                            Fulfilling {group.items.length} product
                            {group.items.length ===
                            1
                              ? ''
                              : 's'} in this order
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm sm:min-w-[178px] sm:text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/70">
                          Seller subtotal
                        </p>

                        <p className="mt-1 text-lg font-black text-white">
                          {formatMoney(
                            group.subtotalMinor,
                            cart.currency,
                          )}
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="bg-stone-50/80 p-3 sm:p-4">
                    <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                      Products from this seller
                    </div>

                    <div className="space-y-3">
                      {group.items.map(
                        (
                          item,
                        ) => {
                          const itemId =
                            String(
                              item.id ||
                                item.packId ||
                                '',
                            )

                          const itemUpdating =
                            updatingCartItemId ===
                            itemId

                          const quantity =
                            Number(
                              item.packCount ||
                                1,
                            )

                          return (
                            <div
                              key={
                                item.id
                              }
                              className="grid gap-4 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm transition duration-300 hover:border-emerald-200 hover:shadow-[0_10px_28px_rgba(6,78,59,0.07)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5"
                            >
                              <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 sm:grid">
                                <Package
                                  size={19}
                                  aria-hidden="true"
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-black leading-5 text-stone-950 sm:text-base">
                                  {item.displayName ||
                                    (isDirectProductCart
                                      ? `Pack ${String(
                                          item.packId ||
                                            '',
                                        ).slice(-8)}`
                                      : `Requirement ${String(
                                          item.requirementLineId ||
                                            '',
                                        ).slice(-8)}`)}
                                </p>

                                {isDirectProductCart ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                                    <div className="inline-flex h-9 items-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateDirectCartItem(
                                            item,
                                            'decrement',
                                          )
                                        }
                                        disabled={
                                          quantity <=
                                            1 ||
                                          itemUpdating
                                        }
                                        className="focus-ring grid h-full w-9 place-items-center text-stone-600 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label={`Decrease ${item.displayName || 'item'} quantity`}
                                      >
                                        <Minus
                                          size={15}
                                          strokeWidth={2.6}
                                          aria-hidden="true"
                                        />
                                      </button>

                                      <span className="grid h-full min-w-[42px] place-items-center border-x border-stone-200 bg-white px-2 text-sm font-black text-stone-950">
                                        {quantity}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateDirectCartItem(
                                            item,
                                            'set_quantity',
                                            quantity +
                                              1,
                                          )
                                        }
                                        disabled={
                                          itemUpdating
                                        }
                                        className="focus-ring grid h-full w-9 place-items-center text-stone-600 transition hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label={`Increase ${item.displayName || 'item'} quantity`}
                                      >
                                        <Plus
                                          size={15}
                                          strokeWidth={2.6}
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        mutateDirectCartItem(
                                          item,
                                          'remove',
                                        )
                                      }
                                      disabled={
                                        itemUpdating
                                      }
                                      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Trash2
                                        size={13}
                                        aria-hidden="true"
                                      />
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-black text-stone-600">
                                    <Package
                                      size={12}
                                      aria-hidden="true"
                                    />

                                    {item.packCount} pack
                                    {Number(
                                      item.packCount,
                                    ) ===
                                    1
                                      ? ''
                                      : 's'}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 sm:min-w-[145px] sm:text-right">
                                <p className="text-[10px] font-black uppercase tracking-[0.11em] text-stone-400">
                                  Line total
                                </p>

                                <p className="mt-1 text-lg font-black text-stone-950">
                                  {formatMoney(
                                    item.lineTotal?.amountMinor,
                                    item.lineTotal?.currency,
                                  )}
                                </p>
                              </div>
                            </div>
                          )
                        },
                      )}
                    </div>
                  </div>
                </article>
              ),
            )}
          </section>

          <aside className="ep-cart-rise space-y-4 lg:sticky lg:top-24 [animation-delay:190ms]">
            <section className="overflow-hidden rounded-[30px] border border-emerald-200/80 bg-white/95 shadow-[0_20px_55px_rgba(6,78,59,0.10)] backdrop-blur-xl">
              <div className="bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_75%)] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-900 text-white shadow-lg shadow-emerald-950/15">
                    <ReceiptText
                      size={18}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">
                      Order summary
                    </p>

                    <h2 className="mt-0.5 text-lg font-black text-stone-950">
                      Cart subtotal
                    </h2>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-emerald-100/80 p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.11em] text-stone-500">
                      Items
                    </p>
                    <p className="mt-1.5 text-base font-black text-stone-950">
                      {itemCount} pack
                      {itemCount ===
                      1
                        ? ''
                        : 's'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.11em] text-stone-500">
                      Seller splits
                    </p>
                    <p className="mt-1.5 text-base font-black text-stone-950">
                      {sellerGroups.length}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-800">
                        Known item subtotal
                      </p>

                      <p className="mt-1 text-[11px] font-semibold leading-4 text-emerald-900/55">
                        Before delivery fees and final checkout validation
                      </p>
                    </div>

                    <p className="shrink-0 text-2xl font-black tracking-tight text-emerald-950">
                      {formatMoney(
                        cart.itemSubtotalMinor,
                        cart.currency,
                      )}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/checkout/${cartId}`}
                  className="ep-cart-sheen focus-ring group relative inline-flex w-full overflow-hidden items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#065f46_0%,#047857_100%)] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_26px_rgba(6,95,70,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(6,95,70,0.28)]"
                >
                  <span className="relative z-10">
                    Continue to Checkout
                  </span>

                  <ArrowRight
                    size={17}
                    className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>

                <div className="grid gap-2.5 pt-1 text-xs font-semibold text-stone-600">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <ShieldCheck
                        size={14}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="pt-0.5">
                      Price and inventory revalidated at checkout
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <Truck
                        size={14}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="pt-0.5">
                      Delivery fee is calculated before payment
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-amber-200/90 bg-[linear-gradient(135deg,#fffbeb_0%,#fff7ed_100%)] p-4 shadow-[0_10px_28px_rgba(120,53,15,0.05)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <AlertTriangle
                    size={17}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="text-sm font-black text-amber-950">
                    Final total comes at checkout
                  </h2>

                  <p className="mt-1.5 text-xs font-semibold leading-5 text-amber-900/70">
                    Delivery fees, cancellation terms and return terms are confirmed before payment becomes available.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200/70 bg-white/75 px-4 py-3 text-xs font-black text-emerald-800 shadow-sm backdrop-blur-xl">
              <CheckCircle2
                size={15}
                aria-hidden="true"
              />

              Marketplace selections remain seller-specific
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
