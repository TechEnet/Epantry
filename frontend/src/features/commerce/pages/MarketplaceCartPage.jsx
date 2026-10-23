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
  mergeRecipeMarketplaceCart,
  optimizeBasket,
  updateDirectMarketplaceCartItem,
} from '../services/commerce.service'

import {
  getDefaultDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

import {
  useLocationStore,
} from '../../location/store/location.store'

import {
  createOutcomePlanIdempotencyKey,
  createRecipeOutcomePlan,
  getOutcomePlanErrorMessage,
} from '../../outcomes/services/outcomePlan.service'

const RECIPE_CART_PENDING_KEY =
  'epantry-pending-recipe-cart'

const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

const RECIPE_CHECKOUT_CART_KEY =
  'epantry-recipe-checkout-cart'

const RECIPE_PENDING_MERGE_KEY =
  'epantry-recipe-pending-merge'

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
  pincode = '',
  fulfillmentType = 'delivery',
}) {
  try {
    window.sessionStorage.setItem(
      FLOATING_MARKETPLACE_CART_KEY,
      JSON.stringify({
        cartId,
        items,
        pincode,
        fulfillmentType,
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

function readFloatingMarketplaceCart() {
  try {
    const raw = window.sessionStorage.getItem(
      FLOATING_MARKETPLACE_CART_KEY,
    )
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.cartId && Array.isArray(parsed?.items)
      ? parsed
      : null
  } catch {
    return null
  }
}

function mapDirectCartItems(data) {
  return (Array.isArray(data?.items) ? data.items : []).map((item) => ({
    id: item.id || item.packId || item.displayName,
    packId: item.packId || '',
    offerId: item.offerId || '',
    organizationId: item.organizationId || '',
    sellerName: item.sellerName || 'Marketplace Host',
    name: item.displayName || 'Product',
    quantity: Number(item.packCount || 1),
  }))
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
      () => readRecipeCart(),
    )

  // Recipe ingredients live in session state, while Grocery products belong to
  // an actual Marketplace Cart. Keep both sources visible and independently
  // mutable; never replace an existing direct cart with a recipe quote cart.
  const [
    grocerySnapshot,
    setGrocerySnapshot,
  ] = useState(() => readFloatingMarketplaceCart())

  const [
    groceryCartData,
    setGroceryCartData,
  ] = useState(null)

  const [
    groceryLoading,
    setGroceryLoading,
  ] = useState(false)

  const [
    groceryError,
    setGroceryError,
  ] = useState('')

  const [
    updatingGroceryItemId,
    setUpdatingGroceryItemId,
  ] = useState('')

  const currentLocation = useLocationStore((state) => state.currentLocation)
  const detectedPincode = /^\d{6}$/.test(String(currentLocation?.postcode || '').trim())
    ? String(currentLocation.postcode).trim()
    : ''
  const [savedAddressPincode, setSavedAddressPincode] = useState('')
  const [manualRecipePincode, setManualRecipePincode] = useState(null)
  const [recipePincodeDraft, setRecipePincodeDraft] = useState('')
  const [recipePinEditorOpen, setRecipePinEditorOpen] = useState(false)
  const [recipePinError, setRecipePinError] = useState('')
  const [recipePinCoverage, setRecipePinCoverage] = useState({
    status: 'idle',
    pincode: '',
    unmatchedNames: [],
  })
  const recipeCheckSequence = useRef(0)

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
      setRecipeCart(readRecipeCart())
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
          setRecipeCart(readRecipeCart())
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

  useEffect(() => {
    if (!isRecipeCart) return undefined

    let alive = true
    const refreshGrocery = async () => {
      const snapshot = readFloatingMarketplaceCart()
      if (!alive) return
      setGrocerySnapshot(snapshot)
      setGroceryCartData(null)
      setGroceryError('')
      if (!snapshot?.cartId) {
        setGroceryLoading(false)
        return
      }

      setGroceryLoading(true)
      try {
        const response = await getMarketplaceCart(snapshot.cartId)
        if (alive) setGroceryCartData(response)
      } catch (loadError) {
        if (alive) {
          setGroceryError(getCommerceErrorMessage(
            loadError,
            'Grocery Cart could not be refreshed. Your saved items are still shown.',
          ))
        }
      } finally {
        if (alive) setGroceryLoading(false)
      }
    }

    void refreshGrocery()
    window.addEventListener('epantry-cart-updated', refreshGrocery)
    window.addEventListener('storage', refreshGrocery)
    return () => {
      alive = false
      window.removeEventListener('epantry-cart-updated', refreshGrocery)
      window.removeEventListener('storage', refreshGrocery)
    }
  }, [isRecipeCart])

  useEffect(() => {
    if (!isRecipeCart || detectedPincode) return undefined
    let cancelled = false
    getDefaultDeliveryAddress()
      .then((result) => {
        const value = String(result?.address?.postalCode || '').trim()
        if (!cancelled && /^\d{6}$/.test(value)) setSavedAddressPincode(value)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isRecipeCart, detectedPincode])

  // A live Grocery cart belongs in the same customer basket as Recipe items.
  // Keep unrelated/historic and prepared-restaurant carts on their own ID routes.
  useEffect(() => {
    if (isRecipeCart || data?.cart?.sourceType !== 'direct_product') return
    const activeGrocery = readFloatingMarketplaceCart()
    if (activeGrocery?.cartId && String(activeGrocery.cartId) === String(cartId)) {
      navigate('/cart/recipe', { replace: true })
    }
  }, [cartId, data?.cart?.sourceType, isRecipeCart, navigate])

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

  const groceryItems = isRecipeCart
    ? (Array.isArray(groceryCartData?.items)
        ? groceryCartData.items
        : grocerySnapshot?.items || [])
    : []
  const groceryCartId = groceryCartData?.cart?.id || grocerySnapshot?.cartId || ''
  const totalBasketItems = recipeItems.length + groceryItems.length
  const selectedRecipePincode = manualRecipePincode === null
    ? detectedPincode || savedAddressPincode
    : manualRecipePincode
  const recipeIngredientSignature = recipeItems
    .map((item) => String(item?.canonicalIngredientId || '').trim())
    .filter(Boolean)
    .sort()
    .join('|')

  // Use the same server-side Host-coverage optimizer as Recipe checkout.
  // It validates serviceable ZIP/PIN, current offers and inventory; a PIN
  // string match alone must never be treated as delivery availability.
  useEffect(() => {
    if (!isRecipeCart) return undefined
    const sequence = ++recipeCheckSequence.current
    const pin = selectedRecipePincode.trim()
    if (!/^\d{6}$/.test(pin) || !recipeCart?.slug || !recipeIngredientSignature) {
      setRecipePinCoverage({ status: 'idle', pincode: pin, unmatchedNames: [] })
      return undefined
    }

    let cancelled = false
    setRecipePinCoverage({ status: 'checking', pincode: pin, unmatchedNames: [] })
    const check = async () => {
      try {
        const selectedIds = [...new Set(recipeIngredientSignature.split('|'))]
        const outcome = await createRecipeOutcomePlan(recipeCart.slug, {
          targetServings: Number(recipeCart.servings || 1),
          purchaseMode: 'full_recipe',
          selectedCanonicalIngredientIds: selectedIds,
          idempotencyKey: createOutcomePlanIdempotencyKey('recipe-pin-availability'),
        })
        if (!outcome?.plan?.id) throw new Error('Unable to resolve recipe ingredients.')
        const quoteData = await optimizeBasket({
          outcomePlanId: outcome.plan.id,
          pincode: pin,
          objective: 'best_value',
          fulfillmentType: 'delivery',
          idempotencyKey: createCommerceIdempotencyKey('recipe-pin-availability'),
        })
        if (cancelled || sequence !== recipeCheckSequence.current) return
        const preferred = quoteData?.quote?.recommendedOptionKey || 'best_value'
        const options = Array.isArray(quoteData?.options) ? quoteData.options : []
        const option = options.find((item) => item.optionKey === preferred)
          || options.find((item) => item.optionKey === 'best_value')
          || null
        const required = Number(option?.totalRequirementCount || 0)
        const matched = Number(option?.matchedRequirementCount || 0)
        const unmatchedIds = new Set(
          (quoteData?.unmatchedRequirementLineIds || []).map((id) => String(id)),
        )
        const unmatchedNames = [...new Set((outcome?.requirements || [])
          .filter((item) => unmatchedIds.has(String(item?.id || '')))
          .map((item) => String(item?.label || '').trim())
          .filter(Boolean))]
        setRecipePinCoverage({
          status: required > 0
            ? (option && matched === required ? 'available' : 'unavailable')
            : 'error',
          pincode: pin,
          unmatchedNames,
        })
      } catch (checkError) {
        if (cancelled || sequence !== recipeCheckSequence.current) return
        setRecipePinCoverage({
          status: 'error',
          pincode: pin,
          unmatchedNames: [],
          message: getCommerceErrorMessage(checkError, 'Unable to check delivery right now.'),
        })
      }
    }
    void check()
    return () => { cancelled = true }
  }, [
    isRecipeCart,
    recipeCart?.slug,
    recipeCart?.servings,
    recipeIngredientSignature,
    selectedRecipePincode,
  ])

  function handleCheckRecipePincode(event) {
    event.preventDefault()
    const pin = recipePincodeDraft.replace(/\s/g, '')
    if (!/^\d{6}$/.test(pin)) {
      setRecipePinError('Enter a valid 6-digit PIN code.')
      return
    }
    setRecipePinError('')
    setManualRecipePincode(pin)
    setRecipePinEditorOpen(false)
    setRecipeCoverageIssue(null)
  }

  async function handleRemoveGroceryItem(item) {
    const itemId = String(item?.id || item?.packId || '').trim()
    if (!groceryCartId || !itemId || updatingGroceryItemId || groceryLoading || groceryError) return
    setUpdatingGroceryItemId(itemId)
    setError('')
    try {
      const result = await updateDirectMarketplaceCartItem({
        cartId: groceryCartId,
        itemId,
        operation: 'remove',
      })
      const items = mapDirectCartItems(result)
      setGroceryCartData(result)
      if (items.length) {
        saveFloatingMarketplaceCart({
          cartId: result?.cart?.id || groceryCartId,
          items,
          pincode: result?.cart?.pincode || grocerySnapshot?.pincode || '',
          fulfillmentType: result?.cart?.fulfillmentType || grocerySnapshot?.fulfillmentType || 'delivery',
        })
      } else {
        window.sessionStorage.removeItem(FLOATING_MARKETPLACE_CART_KEY)
      }
      notifyFloatingCartUpdated()
    } catch (removeError) {
      setError(getCommerceErrorMessage(removeError, 'Unable to remove this Grocery item.'))
    } finally {
      setUpdatingGroceryItemId('')
    }
  }

  const finalizeRecipeOrder =
    useCallback(
      async (targetCartId = '') => {
        if (
          (!isRecipeCart && !targetCartId) ||
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
          const mergeIntoCartId = targetCartId || (isRecipeCart ? groceryCartId : '')
          // Do not merge the same pending recipe selection again after a
          // customer returns from an unfinished combined order.
          let previousCheckout = null
          try {
            previousCheckout = JSON.parse(window.sessionStorage.getItem(RECIPE_CHECKOUT_CART_KEY) || 'null')
          } catch {
            previousCheckout = null
          }
          if (
            mergeIntoCartId &&
            String(previousCheckout?.cartId || '') === String(mergeIntoCartId)
          ) {
            if (JSON.stringify(previousCheckout?.items || []) !== JSON.stringify(recipeItems)) {
              throw new Error('This order already contains an earlier recipe selection. Review or remove those priced items from your order before adding a changed recipe selection.')
            }
            navigate(`/checkout/${mergeIntoCartId}`)
            return
          }

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

          if (mergeIntoCartId && !isRecipeCart &&
              String(data?.cart?.pincode || '') !== normalizedPincode) {
            throw new Error('Your saved delivery address must match this cart PIN. Please choose an address for the same PIN before placing the order.')
          }

          // Reuse a previously created quote cart if the merge response was
          // lost. The server also marks the source cart as merged exactly once.
          let pendingMerge = null
          try {
            pendingMerge = JSON.parse(window.sessionStorage.getItem(RECIPE_PENDING_MERGE_KEY) || 'null')
          } catch {
            pendingMerge = null
          }
          if (mergeIntoCartId && pendingMerge &&
              String(pendingMerge.cartId) === String(mergeIntoCartId) &&
              pendingMerge.pincode === normalizedPincode &&
              JSON.stringify(pendingMerge.items || []) === JSON.stringify(recipeItems) &&
              pendingMerge.recipeCartId) {
            const previouslyMerged = await mergeRecipeMarketplaceCart({
              cartId: mergeIntoCartId,
              recipeCartId: pendingMerge.recipeCartId,
            })
            const readyId = previouslyMerged?.cart?.id
            if (!readyId) throw new Error('Unable to confirm this combined order.')
            window.sessionStorage.setItem(RECIPE_CHECKOUT_CART_KEY,
              JSON.stringify({ cartId: readyId, items: recipeItems }))
            window.sessionStorage.removeItem(RECIPE_PENDING_MERGE_KEY)
            navigate(`/checkout/${readyId}`, { replace: true })
            return
          }

          if (
            !/^\d{6}$/.test(
              normalizedPincode,
            )
          ) {
            if (mergeIntoCartId) {
              navigate(`/delivery-addresses?returnTo=${encodeURIComponent(`/cart/${mergeIntoCartId}`)}`)
              return
            }
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

            if (!isRecipeCart) {
              setError(`One order cannot be prepared yet. ${unmatchedNames.length ? `${unmatchedNames.join(', ')} ${unmatchedNames.length === 1 ? 'is' : 'are'} unavailable or unpriced for PIN ${normalizedPincode}.` : 'Some recipe ingredients do not have an available Host offer and verified price.'} Please update the items or delivery PIN before continuing.`)
            }
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

          // Merge the server-priced Recipe Cart into the existing Grocery/
          // Brand cart. Only ONE Marketplace Cart proceeds to order payment.
          // The backend checks ownership, PIN, currency, prices and draft state.
          if (mergeIntoCartId) {
            try {
              window.sessionStorage.setItem(RECIPE_PENDING_MERGE_KEY,
                JSON.stringify({ cartId: mergeIntoCartId, recipeCartId: marketplaceCartId,
                  pincode: normalizedPincode, items: recipeItems }))
            } catch {
              // The server still enforces one-time merge using source cart state.
            }
          }
          const finalCartId = mergeIntoCartId
            ? (await mergeRecipeMarketplaceCart({
                cartId: mergeIntoCartId,
                recipeCartId: marketplaceCartId,
              }))?.cart?.id
            : marketplaceCartId
          if (!finalCartId) {
            throw new Error('Unable to prepare one complete order for all items.')
          }
          try {
            window.sessionStorage.removeItem(RECIPE_PENDING_MERGE_KEY)
          } catch {
            // Storage is best effort.
          }

          // Do not discard the pending ingredient selection until this EXACT
          // combined cart is verified paid by CheckoutPage.
          try {
            window.sessionStorage.setItem(
              RECIPE_CHECKOUT_CART_KEY,
              JSON.stringify({ cartId: String(finalCartId), items: recipeItems }),
            )
          } catch {
            // Server checkout remains authoritative if browser storage fails.
          }

          navigate(
            `/checkout/${finalCartId}`,
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
        groceryCartId,
        data?.cart?.pincode,
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
    const grocerySubtotal = groceryItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.lineTotal?.amountMinor || 0)),
      0,
    )
    const groceryCurrency = groceryCartData?.cart?.currency || groceryItems.find((item) => item?.lineTotal?.currency)?.lineTotal?.currency || 'INR'
    const hasRecipe = recipeItems.length > 0
    const hasGroceries = groceryItems.length > 0
    const canReviewGroceries = Boolean(groceryCartId) && hasGroceries && !groceryLoading && !groceryError
    const recipeDeliveryBusy = Boolean(selectedRecipePincode) && (
      recipePinCoverage.pincode !== selectedRecipePincode ||
      recipePinCoverage.status === 'checking' ||
      recipePinCoverage.status === 'unavailable'
    )

    return (
      <main className="ep-unified-basket w-full bg-[#F7F6F2] text-[#202421]">
        <style>{`
          .ep-unified-basket { font-family: 'Plus Jakarta Sans', Inter, sans-serif; }
          .ep-unified-basket .ep-basket-item { transition: background-color .18s ease, border-color .18s ease; }
          .ep-unified-basket .ep-basket-item:hover, .ep-unified-basket .ep-basket-item:focus-within { background: #eef1e9; border-color: #adc2b7; }
          .ep-unified-basket .ep-basket-cta { transition: background-color .18s ease, transform .18s ease; }
          .ep-unified-basket .ep-basket-cta:hover:not(:disabled) { background: #295748; transform: translateY(-1px); }
          .ep-unified-basket .ep-basket-cta:focus-visible, .ep-unified-basket button:focus-visible, .ep-unified-basket a:focus-visible, .ep-unified-basket input:focus-visible { outline: 3px solid #C56C42; outline-offset: 3px; }
          /* Only the unified customer basket on phones. Desktop styles are unchanged. */
          @media (max-width: 639px) {
            .ep-unified-basket {
              box-sizing: border-box;
              width: calc(100% + 16px);
              max-width: none;
              min-width: 0;
              margin-inline: -8px;
            }
            .ep-unified-basket .ep-basket-mobile-wrap { padding: 8px 8px 22px; }
            .ep-unified-basket .ep-basket-top-links { padding-bottom: 7px; gap: 7px; }
            .ep-unified-basket .ep-basket-top-links a { min-height: 40px; font-size: 13px; }
            .ep-unified-basket .ep-basket-hero { border-radius: 14px; }
            .ep-unified-basket .ep-basket-hero-main { padding: 17px 16px 12px; gap: 13px; }
            .ep-unified-basket h1.ep-basket-hero-title { margin-top: 0; font-size: 26px !important; line-height: 1.16 !important; }
            .ep-unified-basket .ep-basket-hero-description { margin-top: 6px; font-size: 14px; line-height: 1.45; }
            .ep-unified-basket .ep-basket-hero-stats { padding: 9px 0; }
            .ep-unified-basket .ep-basket-hero-stats > div { min-width: 0; padding-inline: 5px; }
            .ep-unified-basket .ep-basket-hero-stats > div > p:first-child { font-size: 23px; line-height: 1.15; }
            .ep-unified-basket .ep-basket-hero-stats > div > p:last-child { font-size: 12px; }
            .ep-unified-basket .ep-basket-steps > div { min-width: 0; padding: 10px 3px; font-size: 12px; line-height: 1.2; }
            .ep-unified-basket .ep-basket-main-grid { margin-top: 18px; gap: 19px; }
            .ep-unified-basket .ep-basket-left-stack > * + * { margin-top: 19px !important; }
            .ep-unified-basket .ep-basket-panel-head { padding: 14px 13px 12px; gap: 9px; align-items: center; }
            .ep-unified-basket .ep-basket-panel-head h2 { font-size: 20px !important; line-height: 1.25 !important; }
            .ep-unified-basket .ep-basket-panel-head > span { padding: 5px 9px; font-size: 12px; }
            .ep-unified-basket .ep-basket-item { padding: 12px 12px; gap: 9px; }
            .ep-unified-basket .ep-basket-item p { overflow-wrap: anywhere; }
            .ep-unified-basket .ep-basket-item button { min-height: 40px; padding-inline: 10px; }
            .ep-unified-basket .ep-basket-empty { padding: 16px 13px; }
            .ep-unified-basket .ep-basket-empty p:first-child { font-size: 15px; }
            .ep-unified-basket .ep-basket-extra-links { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; padding-top: 13px; }
            .ep-unified-basket .ep-basket-extra-links a { min-width: 0; min-height: 46px; padding-inline: 10px; font-size: 13px; gap: 5px; }
            .ep-unified-basket .ep-basket-extra-links a svg { width: 15px; flex-shrink: 0; }
            .ep-unified-basket .ep-basket-summary-head { padding: 14px 16px 12px; }
            .ep-unified-basket .ep-basket-summary-head h2 { font-size: 21px !important; line-height: 1.25 !important; }
            .ep-unified-basket .ep-basket-summary-body { padding: 14px 16px 17px; }
            .ep-unified-basket .ep-basket-summary-body > * + * { margin-top: 12px !important; }
            .ep-unified-basket .ep-basket-summary-pin { padding: 11px 12px; }
            .ep-unified-basket .ep-basket-summary-legal { padding-top: 11px; }
          }
          @media (prefers-reduced-motion: reduce) { .ep-unified-basket *, .ep-unified-basket *::before, .ep-unified-basket *::after { transition: none !important; scroll-behavior: auto !important; } }
        `}</style>
        <div className="ep-basket-mobile-wrap w-full px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12">
          <div className="ep-basket-top-links flex flex-wrap items-center justify-between gap-2 pb-4">
            <Link
              to={recipeCart?.slug ? `/recipes/${recipeCart.slug}` : '/grocery'}
              className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#173F35] hover:underline"
            >
              <ArrowLeft size={17} aria-hidden="true" />
              <span className="sm:hidden">{hasRecipe ? 'Recipe' : 'Continue shopping'}</span>
              <span className="hidden sm:inline">{hasRecipe ? 'Back to recipe' : 'Continue shopping'}</span>
            </Link>
            <Link to="/grocery" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#173F35] hover:underline">
              <span className="sm:hidden">Grocery</span><span className="hidden sm:inline">Browse grocery</span> <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          <header className="ep-basket-hero relative overflow-hidden rounded-[20px] bg-[#173F35] text-[#F7F6F2] sm:rounded-[26px]">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[#C56C42]/20 [clip-path:polygon(45%_0,100%_0,100%_100%,0_100%)]" aria-hidden="true" />
            <div className="ep-basket-hero-main relative grid gap-5 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1fr)_245px] lg:items-center">
              <div>
                <p className="hidden text-xs font-bold uppercase tracking-[0.09em] text-[#D7DDCF] sm:block">EPANTRY / Your basket</p>
                <h1 className="ep-basket-hero-title mt-2 max-w-2xl text-[30px] font-semibold leading-[1.12] tracking-[-0.04em] text-[#F7F6F2] sm:text-[42px]">
                  <span className="sm:hidden">Your basket</span><span className="hidden sm:inline">All your shopping, together.</span>
                </h1>
                <p className="ep-basket-hero-description mt-3 max-w-xl text-[15px] leading-6 text-[#F7F6F2]/85">
                  <span className="sm:hidden">Recipes and groceries, all in one place.</span>
                  <span className="hidden sm:inline">Review ingredients from recipes and products from Grocery in one place.</span>
                </p>
              </div>
              <div className="ep-basket-hero-stats grid grid-cols-3 gap-0 border-y border-white/25 py-3 text-center lg:border-y-0 lg:border-l lg:py-1">
                <div className="px-2">
                  <p className="text-[26px] font-semibold tabular-nums">{totalBasketItems}</p>
                  <p className="text-xs text-[#D7DDCF]">Total</p>
                </div>
                <div className="border-x border-white/25 px-2">
                  <p className="text-[26px] font-semibold tabular-nums">{recipeItems.length}</p>
                  <p className="text-xs text-[#D7DDCF]">Recipe</p>
                </div>
                <div className="px-2">
                  <p className="text-[26px] font-semibold tabular-nums">{groceryItems.length}</p>
                  <p className="text-xs text-[#D7DDCF]">Grocery</p>
                </div>
              </div>
            </div>
            <div className="ep-basket-steps grid grid-cols-3 gap-px bg-white/20 text-xs font-medium sm:text-sm">
              <div className="bg-[#234b3f] px-3 py-3 text-center text-white sm:px-5">01 / Review</div>
              <div className="bg-[#234b3f] px-3 py-3 text-center text-white sm:px-5">02 / Delivery</div>
              <div className="bg-[#234b3f] px-3 py-3 text-center text-white sm:px-5">03 / Checkout</div>
            </div>
          </header>

          {error && (
            <div role="alert" className="mt-5 flex gap-3 border-l-4 border-rose-700 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <AlertTriangle className="shrink-0" size={18} aria-hidden="true" /> {error}
            </div>
          )}
          {recipeCoverageIssue && (
            <section className="mt-5 border-l-4 border-rose-700 bg-rose-50 px-4 py-4 sm:px-5" aria-label="Delivery coverage issue">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-rose-950">Delivery needs your attention</h2>
                  <p className="mt-1 text-sm leading-6 text-rose-800">
                    {recipeCoverageIssue.unmatchedNames.length
                      ? `${recipeCoverageIssue.unmatchedNames.join(', ')} ${recipeCoverageIssue.unmatchedNames.length === 1 ? 'is' : 'are'} not available for PIN ${recipeCoverageIssue.pincode}.`
                      : `Some recipe items cannot currently be delivered to PIN ${recipeCoverageIssue.pincode}.`}
                  </p>
                </div>
                <button type="button" onClick={handlePlaceRecipeOrder} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800">
                  <MapPin size={15} aria-hidden="true" /> Change address
                </button>
              </div>
            </section>
          )}

          <div className="ep-basket-main-grid mt-7 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:gap-8">
            <div className="ep-basket-left-stack min-w-0 space-y-7">
              <section className="overflow-hidden border-t-[3px] border-[#C56C42] bg-white" aria-labelledby="ep-recipe-basket-title">
                <div className="ep-basket-panel-head flex flex-wrap items-end justify-between gap-3 border-b border-[#D7DDCF] px-4 py-5 sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#C56C42]">01 / From your recipes</p>
                    <h2 id="ep-recipe-basket-title" className="mt-1 text-[23px] font-semibold tracking-[-0.03em] text-[#202421] sm:text-[27px]">Ingredients to buy</h2>
                  </div>
                  <span className="rounded-full bg-[#D7DDCF] px-3 py-1 text-sm font-semibold text-[#173F35]">{recipeItems.length} items</span>
                </div>
                {hasRecipe ? (
                  <div className="divide-y divide-[#D7DDCF]/70">
                    {recipeItems.map((item, index) => (
                      <article key={item.canonicalIngredientId || index} className="ep-basket-item grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-[3px] border-transparent px-4 py-4 sm:px-6">
                        <div className="min-w-0">
                          <p className="text-[16px] font-semibold leading-6 text-[#202421]">{item.name || 'Ingredient'}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#173F35]/80">
                            <span>{formatRecipeQuantity(item)}</span>
                            <span aria-hidden="true">·</span>
                            <span>From recipe</span>
                            {recipeCoverageIssue?.unmatchedCanonicalIngredientIds?.includes(String(item?.canonicalIngredientId || '')) && (
                              <span className="font-semibold text-rose-700">Not available here</span>
                            )}
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveRecipeItem(item.canonicalIngredientId)}
                          aria-label={`Remove ${item.name || 'ingredient'} from basket`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-800 hover:bg-rose-50">
                          <Trash2 size={16} aria-hidden="true" /> <span className="hidden sm:inline">Remove</span>
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="ep-basket-empty px-5 py-6 sm:px-6">
                    <p className="text-[16px] font-semibold text-[#202421]">No recipe ingredients in your basket.</p>
                    <p className="mt-1 hidden text-sm text-[#173F35]/80 sm:block">Add missing ingredients from any recipe whenever you need them.</p>
                    <Link to="/recipes" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#173F35] underline underline-offset-4">Explore recipes <ArrowRight size={15} aria-hidden="true" /></Link>
                  </div>
                )}
              </section>

              <section className="overflow-hidden border-t-[3px] border-[#173F35] bg-[#eef1e9]" aria-labelledby="ep-grocery-basket-title">
                <div className="ep-basket-panel-head flex flex-wrap items-end justify-between gap-3 border-b border-[#c4ccbd] px-4 py-5 sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#173F35]">02 / From Grocery & Brands</p>
                    <h2 id="ep-grocery-basket-title" className="mt-1 text-[23px] font-semibold tracking-[-0.03em] text-[#202421] sm:text-[27px]">Products in your basket</h2>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#173F35]">{groceryItems.length} products</span>
                </div>
                {groceryLoading && <p role="status" className="px-5 py-4 text-sm text-[#173F35]">Checking saved grocery products...</p>}
                {groceryError && <p role="alert" className="px-5 py-4 text-sm font-medium text-rose-800">{groceryError}</p>}
                {hasGroceries ? (
                  <div className="divide-y divide-[#c4ccbd]">
                    {groceryItems.map((item, index) => (
                      <article key={`grocery-${item.id || item.packId || index}`} className="ep-basket-item flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-transparent px-4 py-4 sm:px-6">
                        <div className="min-w-0 flex-1">
                          <p className="text-[16px] font-semibold leading-6 text-[#202421]">{item.displayName || item.name || 'Grocery product'}</p>
                          <p className="mt-1 text-[13px] text-[#173F35]/85">
                            {item.sellerName || 'Grocery'} · {Number(item.packCount || item.quantity || 1)} pack{Number(item.packCount || item.quantity || 1) === 1 ? '' : 's'}
                          </p>
                          {item.lineTotal?.amountMinor !== undefined && (
                            <p className="mt-2 text-[15px] font-semibold text-[#173F35]">{formatMoney(item.lineTotal.amountMinor, item.lineTotal.currency || 'INR')}</p>
                          )}
                        </div>
                        <button type="button" onClick={() => handleRemoveGroceryItem(item)}
                          disabled={Boolean(updatingGroceryItemId) || groceryLoading || Boolean(groceryError) || groceryCartData?.cart?.sourceType !== 'direct_product'}
                          aria-label={`Remove ${item.displayName || item.name || 'grocery product'} from basket`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                          <Trash2 size={16} aria-hidden="true" /> <span>Remove</span>
                        </button>
                      </article>
                    ))}
                  </div>
                ) : !groceryLoading && !groceryError ? (
                  <div className="ep-basket-empty px-5 py-6 sm:px-6">
                    <p className="text-[16px] font-semibold text-[#202421]">No Grocery products added yet.</p>
                    <p className="mt-1 hidden text-sm text-[#173F35]/80 sm:block">Products you add from Grocery and Brands will appear here.</p>
                    <Link to="/grocery" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#173F35] underline underline-offset-4">Shop groceries <ArrowRight size={15} aria-hidden="true" /></Link>
                  </div>
                ) : null}
              </section>

              <div className="ep-basket-extra-links grid gap-3 border-t border-[#D7DDCF] pt-4 sm:grid-cols-2">
                <Link to="/recipes" className="group flex min-h-14 items-center justify-between rounded-xl border border-[#D7DDCF] bg-white px-4 text-[15px] font-semibold text-[#173F35] hover:border-[#173F35]">Add from recipes <ArrowRight size={18} aria-hidden="true" /></Link>
                <Link to="/grocery" className="group flex min-h-14 items-center justify-between rounded-xl border border-[#D7DDCF] bg-white px-4 text-[15px] font-semibold text-[#173F35] hover:border-[#173F35]">Add from Grocery <ArrowRight size={18} aria-hidden="true" /></Link>
              </div>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-24" aria-label="Basket checkout summary">
              <div className="border-t-4 border-[#C56C42] bg-white shadow-[0_14px_36px_-28px_rgba(23,63,53,0.4)]">
                <div className="ep-basket-summary-head bg-[#D7DDCF] px-5 py-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#173F35]">Your next step</p>
                  <h2 className="mt-1 text-[23px] font-semibold tracking-[-0.025em] text-[#202421]">Ready to review?</h2>
                </div>
                <div className="ep-basket-summary-body space-y-4 px-5 py-5">
                  <div className="flex items-center justify-between border-b border-[#D7DDCF] pb-3 text-sm">
                    <span className="text-[#202421]/80">Selected items</span>
                    <strong className="text-lg font-semibold text-[#173F35]">{totalBasketItems}</strong>
                  </div>
                  {hasGroceries && groceryCartData?.items?.length > 0 && (
                    <div className="border-b border-[#D7DDCF] pb-4">
                      <p className="text-xs font-medium text-[#173F35]/80">Grocery item prices so far</p>
                      <p className="mt-1 text-2xl font-semibold text-[#202421]">{formatMoney(grocerySubtotal, groceryCurrency)}</p>
                      <p className="mt-1 hidden text-xs leading-5 text-[#202421]/75 sm:block">Recipe ingredients, delivery fees and final availability are checked before checkout.</p>
                    </div>
                  )}
                  {hasRecipe && (
                    <div className="ep-basket-summary-pin rounded-xl bg-[#F7F6F2] p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#173F35]">Delivery PIN</p>
                          <p className="mt-1 text-[16px] font-semibold text-[#202421]">{selectedRecipePincode || 'Choose PIN'}
                            {manualRecipePincode === null && selectedRecipePincode && <span className="ml-1 text-xs font-normal text-[#173F35]/75">{detectedPincode ? '· Current location' : '· Saved address'}</span>}
                          </p>
                        </div>
                        <button type="button" onClick={() => { setRecipePincodeDraft(selectedRecipePincode); setRecipePinError(''); setRecipePinEditorOpen((open) => !open) }}
                          className="min-h-9 rounded-lg border border-[#D7DDCF] bg-white px-3 text-xs font-semibold text-[#173F35] hover:bg-[#D7DDCF]">
                          {recipePinEditorOpen ? 'Cancel' : 'Change PIN'}
                        </button>
                      </div>
                      {(recipePinEditorOpen || !selectedRecipePincode) && (
                        <form onSubmit={handleCheckRecipePincode} className="mt-3 space-y-2">
                          <div className="flex gap-2">
                            <input inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[0-9]{6}" value={recipePincodeDraft}
                              onChange={(event) => setRecipePincodeDraft(event.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit PIN" aria-label="Delivery PIN code"
                              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#D7DDCF] bg-white px-3 text-sm text-[#202421]" />
                            <button type="submit" className="min-h-11 rounded-lg bg-[#173F35] px-3 text-sm font-semibold text-white">Check</button>
                          </div>
                          {recipePinError && <p role="alert" className="text-xs text-rose-700">{recipePinError}</p>}
                          {detectedPincode && (
                            <button type="button" onClick={() => { setManualRecipePincode(null); setRecipePinEditorOpen(false); setRecipePinError('') }}
                              className="text-left text-xs font-semibold text-[#173F35] underline">Use current PIN {detectedPincode}</button>
                          )}
                        </form>
                      )}
                      {selectedRecipePincode && (
                        <p role="status" className={`mt-3 text-[13px] leading-5 ${recipePinCoverage.status === 'available' ? 'text-[#173F35]' : recipePinCoverage.status === 'unavailable' ? 'text-rose-700' : 'text-[#202421]/80'}`}>
                          {recipePinCoverage.pincode !== selectedRecipePincode || recipePinCoverage.status === 'checking'
                            ? `Checking Host availability for PIN ${selectedRecipePincode}...`
                            : recipePinCoverage.status === 'available'
                              ? `Recipe ingredients can be delivered to PIN ${selectedRecipePincode}.`
                              : recipePinCoverage.status === 'unavailable'
                                ? `Some ingredients are unavailable for PIN ${selectedRecipePincode}${recipePinCoverage.unmatchedNames?.length ? `: ${recipePinCoverage.unmatchedNames.join(', ')}` : ''}.`
                                : recipePinCoverage.status === 'error'
                                  ? (recipePinCoverage.message || 'Unable to check delivery right now.')
                                  : 'Enter your delivery PIN to check current Hosts.'}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => hasRecipe ? handlePlaceRecipeOrder() : navigate(`/checkout/${groceryCartId}`)}
                    disabled={hasRecipe ? (placingRecipeOrder || recipeDeliveryBusy) : !canReviewGroceries}
                    className="ep-basket-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-4 py-3 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {placingRecipeOrder ? 'Checking availability…' : hasRecipe ? 'Review delivery & checkout' : 'Review grocery checkout'}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                  {!hasRecipe && !hasGroceries && (
                    <p className="text-center text-sm leading-5 text-[#202421]/75">Add an ingredient or a product to begin.</p>
                  )}
                  <div className="ep-basket-summary-legal flex items-start gap-2 border-t border-[#D7DDCF] pt-4 text-xs leading-5 text-[#202421]/75">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#173F35]" aria-hidden="true" />
                    <span>Seller availability, delivery charges and final prices are checked before payment.</span>
                  </div>
                </div>
              </div>
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
      <main className="min-w-0 bg-[#F7F6F2]">
        <div className="w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
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

  const isRestaurantRecipeCart =
    cart.sourceType ===
    'restaurant_recipe'

  if (
    isRestaurantRecipeCart
  ) {
    const restaurantOrder =
      cart.restaurantOrder ||
      {}

    return (
      <main className="min-w-0 bg-[#fff5e8]">
        <div className="w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <Link
            to={
              restaurantOrder.recipeSlug
                ? `/recipes/${restaurantOrder.recipeSlug}`
                : '/recipes'
            }
            className="focus-ring inline-flex items-center gap-2 rounded-full px-1 py-2 text-sm font-black text-stone-600 transition hover:text-orange-900"
          >
            <ArrowLeft
              size={17}
              aria-hidden="true"
            />
            Back to Restaurant Recipe
          </Link>

          <section className="mt-3 overflow-hidden rounded-[30px] border border-orange-900/15 bg-[linear-gradient(135deg,#ffe1bc_0%,#fff7ea_50%,#ffd8c2_100%)] shadow-[0_18px_55px_rgba(126,63,22,0.10)]">
            <div className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-900/15 bg-white/70 px-3 py-1.5 text-orange-900 shadow-sm">
                  <Store
                    size={15}
                    aria-hidden="true"
                  />
                  <p className="text-[10px] font-black uppercase tracking-[0.15em]">
                    Prepared dish order
                  </p>
                </div>

                <h1 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#4b2412] sm:text-5xl">
                  {restaurantOrder.displayName || 'Restaurant dish'}
                </h1>

                <p className="mt-3 text-sm font-black text-orange-900">
                  From {restaurantOrder.restaurantName || 'Restaurant'}
                </p>

                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#76523f]">
                  <MapPin
                    size={16}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span>
                    {restaurantOrder.outletName || 'Restaurant outlet'}
                  </span>
                </div>
              </div>

              <div className="rounded-[24px] border border-orange-900/12 bg-white/78 p-4 shadow-sm backdrop-blur">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-orange-50 px-3 py-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-400">
                      People
                    </p>
                    <p className="mt-1 text-lg font-black text-stone-950">
                      {restaurantOrder.servings || 1}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-orange-50 px-3 py-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Per serving
                    </p>
                    <p className="mt-1 text-lg font-black text-stone-950">
                      {formatMoney(
                        restaurantOrder.pricePerServing?.amountMinor,
                        restaurantOrder.pricePerServing?.currency || cart.currency,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-4 rounded-2xl bg-[#9a3412] px-4 py-4 text-white">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.13em] text-orange-100">
                      Prepared dish total
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {formatMoney(
                        restaurantOrder.lineTotal?.amountMinor,
                        restaurantOrder.lineTotal?.currency || cart.currency,
                      )}
                    </p>
                  </div>
                  <ReceiptText
                    size={24}
                    aria-hidden="true"
                    className="text-orange-100"
                  />
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <section className="rounded-[26px] border border-orange-900/10 bg-white p-5 shadow-[0_10px_35px_rgba(126,63,22,0.06)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-900">
                  <ShieldCheck
                    size={19}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-800">
                    Restaurant order saved
                  </p>
                  <h2 className="mt-1 text-xl font-black text-stone-950">
                    Your servings and active menu price are locked into this Cart.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                    This prepared-dish Cart is separate from grocery ingredient shopping. Restaurant fulfillment and final payment will continue through EPANTRY Commerce once that restaurant checkout path is enabled.
                  </p>
                </div>
              </div>
            </section>

            <aside className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-[0_10px_35px_rgba(28,25,23,0.05)]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                Delivery context
              </p>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
                  <span className="font-semibold text-stone-500">Pincode</span>
                  <span className="font-black text-stone-950">{cart.pincode || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
                  <span className="font-semibold text-stone-500">Fulfillment</span>
                  <span className="font-black capitalize text-stone-950">{cart.fulfillmentType || 'delivery'}</span>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-stone-200 px-4 py-3 text-sm font-black text-stone-500"
              >
                <ArrowRight
                  size={17}
                  aria-hidden="true"
                />
                Restaurant checkout pending
              </button>
            </aside>
          </div>
        </div>
      </main>
    )
  }

  let recipeIncludedInThisCart = false
  try {
    const previousCheckout = JSON.parse(window.sessionStorage.getItem(RECIPE_CHECKOUT_CART_KEY) || 'null')
    recipeIncludedInThisCart =
      String(previousCheckout?.cartId || '') === String(cartId) &&
      JSON.stringify(previousCheckout?.items || []) === JSON.stringify(recipeCart?.items || [])
  } catch {
    recipeIncludedInThisCart = false
  }
  const pendingRecipeItems = recipeIncludedInThisCart
    ? []
    : (Array.isArray(recipeCart?.items) ? recipeCart.items : [])
  const pendingRecipeCount = pendingRecipeItems.length

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
    <main className="relative min-w-0 overflow-hidden bg-[#F7F6F2] text-stone-950">
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

      <div className="relative w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
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
                ['02', 'Order details', false],
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
                {pendingRecipeCount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-emerald-800">
                    {itemCount} grocery pack{itemCount === 1 ? '' : 's'} + {pendingRecipeCount} recipe ingredient{pendingRecipeCount === 1 ? '' : 's'} in your basket
                  </p>
                )}
              </div>

              <div className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-black text-stone-500 shadow-sm backdrop-blur-lg">
                {itemCount} pack
                {itemCount ===
                1
                  ? ''
                  : 's'}
              </div>
            </div>

            {pendingRecipeCount > 0 && (
              <section aria-label="Recipe ingredients in your basket" className="overflow-hidden rounded-[26px] border border-emerald-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-4 sm:px-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Recipe Cart</p>
                    <h3 className="mt-1 text-lg font-black text-stone-950">{pendingRecipeCount} recipe ingredient{pendingRecipeCount === 1 ? '' : 's'}</h3>
                  </div>
                  <Link to="/cart/recipe" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-900">
                    Review recipe items <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
                <div className="divide-y divide-stone-100 px-4 sm:px-5">
                  {pendingRecipeItems.map((item, index) => (
                    <div key={`${item.canonicalIngredientId || item.id || item.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0 text-sm font-bold text-stone-900">{item.name || 'Ingredient'}</span>
                      <span className="shrink-0 text-xs font-semibold text-stone-600">{formatRecipeQuantity(item)}</span>
                    </div>
                  ))}
                </div>
                <p className="border-t border-emerald-100 px-4 py-3 text-xs leading-5 text-stone-600 sm:px-5">
                  Recipe ingredients will be priced using available Host offers and added to the same order before payment. Unpriced or unavailable ingredients will pause the order.
                </p>
              </section>
            )}

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
                      {itemCount} grocery pack{itemCount === 1 ? '' : 's'}
                      {pendingRecipeCount > 0 ? ` + ${pendingRecipeCount} recipe` : ''}
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
                        {pendingRecipeCount > 0 ? 'Priced products so far' : 'Item subtotal'}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold leading-4 text-emerald-900/55">
                        {pendingRecipeCount > 0 ? 'Recipe item prices are added after Host verification' : 'Before delivery fees and final order validation'}
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

                <button
                  type="button"
                  onClick={() => {
                    if (pendingRecipeCount > 0) {
                      void finalizeRecipeOrder(cartId)
                    } else {
                      navigate(`/checkout/${cartId}`)
                    }
                  }}
                  disabled={placingRecipeOrder}
                  className="ep-cart-sheen focus-ring group relative inline-flex w-full overflow-hidden items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#065f46_0%,#047857_100%)] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_26px_rgba(6,95,70,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(6,95,70,0.28)] disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="relative z-10">
                    {placingRecipeOrder ? 'Checking all items…' : 'Review & place order'}
                  </span>
                  <ArrowRight
                    size={17}
                    className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </button>

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
