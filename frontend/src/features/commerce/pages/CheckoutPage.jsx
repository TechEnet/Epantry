import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  MapPin,
  Package,
  ChevronDown,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Store,
} from 'lucide-react'

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  createCommerceIdempotencyKey,
  createPaymentIntent,
  getCommerceErrorMessage,
  getMarketplaceCart,
  getMarketplaceCartDeliveryEta,
  prepareCheckout,
  verifyPayment,
} from '../services/commerce.service'

import {
  getDefaultDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

import {
  useLocationStore,
} from '../../location/store/location.store'

import { getCatalogProducts } from '../../grocery/services/catalog.service'

import { attachCookingOrder, getCookingReturnPath } from '../../recipes/utils/cookingJourney'

const RAZORPAY_CHECKOUT_URL =
  'https://checkout.razorpay.com/v1/checkout.js'

function clearFloatingCartCompanion(paidCartId) {
  // A payment belongs to ONE validated Marketplace Cart. Never clear a
  // different cart (or the user's other recipe/grocery selection).
  try {
    const groceryKey = 'epantry-floating-marketplace-cart'
    const recipeKey = 'epantry-pending-recipe-cart'
    const recipeCheckoutKey = 'epantry-recipe-checkout-cart'
    const floating = JSON.parse(window.sessionStorage.getItem(groceryKey) || 'null')
    const recipeCheckout = JSON.parse(window.sessionStorage.getItem(recipeCheckoutKey) || 'null')
    const paidId = String(paidCartId || '')

    if (paidId && String(floating?.cartId || '') === paidId) {
      window.sessionStorage.removeItem(groceryKey)
    }
    if (paidId && String(recipeCheckout?.cartId || '') === paidId) {
      // A newer recipe selection must survive payment for an older quote.
      const currentRecipe = JSON.parse(window.sessionStorage.getItem(recipeKey) || 'null')
      if (JSON.stringify(currentRecipe?.items || []) === JSON.stringify(recipeCheckout.items || [])) {
        window.sessionStorage.removeItem(recipeKey)
      }
      window.sessionStorage.removeItem(recipeCheckoutKey)
    }
    const remainingGrocery = JSON.parse(window.sessionStorage.getItem(groceryKey) || 'null')
    const remainingRecipe = JSON.parse(window.sessionStorage.getItem(recipeKey) || 'null')
    const hasRemaining = (Array.isArray(remainingGrocery?.items) && remainingGrocery.items.length > 0)
      || (Array.isArray(remainingRecipe?.items) && remainingRecipe.items.length > 0)
    if (hasRemaining) {
      window.sessionStorage.removeItem('epantry-floating-cart-hidden')
    }
    window.dispatchEvent(new CustomEvent('epantry-cart-updated', {
      detail: { show: hasRemaining },
    }))
  } catch {
    // Session persistence is best-effort. Do not affect verified payment.
    window.dispatchEvent(new CustomEvent('epantry-cart-updated', {
      detail: { show: true },
    }))
  }
}

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    amountMinor == null || amountMinor === '' ||
    !Number.isInteger(
      Number(
        amountMinor,
      ),
    )
  ) {
    return 'Pending'
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

function blockerLabel(
  code,
) {
  const labels = {
    LANDED_COST_INCOMPLETE:
      'Delivery charges are not confirmed yet.',

    SELLER_POLICIES_NOT_CONFIGURED:
      'The seller must confirm delivery charges and policies before payment.',

    INTERNATIONAL_DELIVERY_UNAVAILABLE:
      INTERNATIONAL_MESSAGE,

    PAYMENT_PROVIDER_NOT_CONFIGURED:
      'Online payment is temporarily unavailable.',
  }

  return (
    labels[
      code
    ] ||
    String(
      code ||
        '',
    )
      .split(
        '_',
      )
      .join(
        ' ',
      )
  )
}

const INTERNATIONAL_MESSAGE = 'International delivery is not available yet. Please choose a delivery address in India.'

function isInternationalAddress(address) {
  return Boolean(address && !['india', 'in', 'ind'].includes(String(address.country || 'India').trim().toLowerCase()))
}

function formatDeliveryAddress(
  address,
) {
  if (!address) {
    return ''
  }

  return [
    address.addressLine1,
    address.addressLine2,
    address.area,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map(
      (value) =>
        String(
          value ||
            '',
        ).trim(),
    )
    .filter(Boolean)
    .join(', ')
}

// Product images are presentation only. Never use catalog search for order prices.
function checkoutImageUrl(record) {
  return [record?.imageUrl, record?.thumbnailUrl, record?.photoUrl,
    typeof record?.image === 'string' ? record.image : record?.image?.url,
    record?.images?.[0]?.url, record?.photos?.[0]?.url, record?.media?.[0]?.url,
  ].find(url => typeof url === 'string' && (/^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//')))) || ''
}

function checkoutImageKey(item) {
  return String(item?.productVersionId || item?.packId || '').trim()
}

function CheckoutProductImage({ item, images }) {
  const url = checkoutImageUrl(item) || images[checkoutImageKey(item)] || ''
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])
  return <div className="ec2-product-image">{url && !failed
    ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <Package size={25} aria-hidden="true" />}</div>
}

function loadRazorpayCheckout() {
  if (
    typeof window ===
    'undefined'
  ) {
    return Promise.resolve(
      false,
    )
  }

  if (
    window.Razorpay
  ) {
    return Promise.resolve(
      true,
    )
  }

  return new Promise(
    (
      resolve,
    ) => {
      const existing =
        document.querySelector(
          `script[src="${RAZORPAY_CHECKOUT_URL}"]`,
        )

      if (
        existing
      ) {
        existing.addEventListener(
          'load',
          () =>
            resolve(
              Boolean(
                window.Razorpay,
              ),
            ),
          {
            once:
              true,
          },
        )

        existing.addEventListener(
          'error',
          () =>
            resolve(
              false,
            ),
          {
            once:
              true,
          },
        )

        return
      }

      const script =
        document.createElement(
          'script',
        )

      script.src =
        RAZORPAY_CHECKOUT_URL

      script.async =
        true

      script.onload =
        () =>
          resolve(
            Boolean(
              window.Razorpay,
            ),
          )

      script.onerror =
        () =>
          resolve(
            false,
          )

      document.body.appendChild(
        script,
      )
    },
  )
}

export default function CheckoutPage() {
  const {
    cartId,
  } =
    useParams()

  const navigate =
    useNavigate()

  const setDeliveryContext =
    useLocationStore(
      (state) =>
        state.setDeliveryContext,
    )

  const checkoutKeyRef =
    useRef(
      createCommerceIdempotencyKey(
        'checkout',
      ),
    )

  const initialPreparedCartRef =
    useRef(
      '',
    )

  const prepareInFlightRef =
    useRef(
      false,
    )

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    deliveryAddress,
    setDeliveryAddress,
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
    paying,
    setPaying,
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

  const [internationalBlocked, setInternationalBlocked] = useState(false)
  const [productImages, setProductImages] = useState({})
  const internationalDialogRef = useRef(null)

  useEffect(() => {
    if (internationalBlocked && internationalDialogRef.current && !internationalDialogRef.current.open) {
      internationalDialogRef.current.showModal()
    }
  }, [internationalBlocked])

  const prepare =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
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
          prepareInFlightRef.current
        ) {
          return
        }

        prepareInFlightRef.current =
          true

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

        setError('')
        setInternationalBlocked(false)
        if (!refresh) setData(null)

        try {
          const cartResult =
            await getMarketplaceCart(
              cartId,
            )

          const cart =
            cartResult?.cart ||
            null

          let deliveryAddressId =
            null

          if (
            (
              cart?.fulfillmentType ||
              'delivery'
            ) ===
            'delivery'
          ) {
            const addressResult =
              await getDefaultDeliveryAddress()

            const selectedAddress =
              addressResult?.address ||
              null

            if (!selectedAddress?.id) {
              setData(null)
              navigate(
                `/delivery-addresses?returnTo=${encodeURIComponent(
                  `/checkout/${cartId}`,
                )}`,
                {
                  replace:
                    true,

                  state: {
                    checkoutAddressSelection:
                      true,
                  },
                },
              )

              return
            }

            if (isInternationalAddress(selectedAddress)) {
              setData(null)
              setDeliveryAddress(selectedAddress)
              setInternationalBlocked(true)
              setError(INTERNATIONAL_MESSAGE)
              return
            }

            deliveryAddressId =
              selectedAddress.id

            setDeliveryAddress(
              selectedAddress,
            )
          } else {
            setDeliveryAddress(
              null,
            )
          }

          const result =
            await prepareCheckout({
              cartId,
              deliveryAddressId,

              idempotencyKey:
                checkoutKeyRef.current,
            })

          setData(
            result,
          )

          if (
            result?.order
              ?.deliveryAddressSnapshot
          ) {
            setDeliveryAddress(
              result.order
                .deliveryAddressSnapshot,
            )
          }
        } catch (
          prepareError
        ) {
          setData(null)
          if (getCommerceErrorMessage(prepareError, '').includes('International delivery is not available')) {
            setInternationalBlocked(true)
          }
          setError(
            getCommerceErrorMessage(
              prepareError,
              'Unable to prepare checkout.',
            ),
          )
        } finally {
          prepareInFlightRef.current =
            false

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
        navigate,
      ],
    )

  useEffect(
    () => {
      const prepareKey =
        String(
          cartId ||
            '__missing_cart__',
        )

      if (
        initialPreparedCartRef.current ===
        prepareKey
      ) {
        return
      }

      initialPreparedCartRef.current =
        prepareKey

      prepare()
    },
    [
      cartId,
      prepare,
    ],
  )

  useEffect(
    () => {
      if (
        !cartId
      ) {
        return undefined
      }

      let active =
        true

      getMarketplaceCartDeliveryEta(
        cartId,
      )
        .then(
          (eta) => {
            if (
              !active ||
              !eta?.available
            ) {
              return
            }

            setDeliveryContext({
              city:
                eta.destination?.city ||
                '',

              state:
                eta.destination?.state ||
                '',

              country:
                eta.destination?.country ||
                'India',

              label:
                eta.destination?.label ||
                `PIN ${eta.destination?.postalCode || ''}`,

              estimatedDeliveryMinutes:
                eta.estimatedDeliveryMinutes,

              estimatedArrivalAt:
                eta.estimatedArrivalAt,

              estimatedRoadDistanceKm:
                eta.estimatedRoadDistanceKm,

              averageSpeedKmh:
                eta.averageSpeedKmh,

              calculationMethod:
                eta.calculationMethod,

              targetPath:
                `/delivery-addresses?returnTo=${encodeURIComponent(
                  `/checkout/${cartId}`,
                )}`,
            })
          },
        )
        .catch(
          () => undefined,
        )

      return () => {
        active =
          false
      }
    },
    [
      cartId,
      setDeliveryContext,
    ],
  )

  async function handlePayment() {
    const order =
      data?.order

    if (isInternationalAddress(deliveryAddress)) {
      setInternationalBlocked(true)
      return
    }

    if (refreshing || loading || internationalBlocked) return

    if (
      !order?.id ||
      order.paymentReady !==
        true ||
      paying
    ) {
      return
    }

    setPaying(
      true,
    )

    setError(
      '',
    )

    try {
      const payment =
        await createPaymentIntent({
          orderId:
            order.id,

          idempotencyKey:
            createCommerceIdempotencyKey(
              'payment-intent',
            ),
        })

      const checkout =
        payment?.checkout

      if (
        !checkout?.configured ||
        !checkout?.keyId ||
        !checkout?.providerOrderId
      ) {
        throw new Error(
          'Hosted payment provider is not configured.',
        )
      }

      const loaded =
        await loadRazorpayCheckout()

      if (
        !loaded ||
        !window.Razorpay
      ) {
        throw new Error(
          'Unable to load Razorpay hosted checkout.',
        )
      }

      const razorpay =
        new window.Razorpay({
          key:
            checkout.keyId,

          amount:
            checkout.amountMinor,

          currency:
            checkout.currency,

          name:
            'EPANTRY',

          description:
            'Marketplace Order',

          order_id:
            checkout.providerOrderId,

          handler:
            async (
              response,
            ) => {
              try {
                const verified =
                  await verifyPayment({
                    orderId:
                      order.id,

                    razorpayPaymentId:
                      response
                        .razorpay_payment_id,

                    razorpayOrderId:
                      response
                        .razorpay_order_id,

                    razorpaySignature:
                      response
                        .razorpay_signature,

                    idempotencyKey:
                      createCommerceIdempotencyKey(
                        'payment-verify',
                      ),
                  })

                const confirmedOrderId =
                  verified?.order?.id ||
                  order.id

                // Only a verified payment attaches the order to an existing
                // recipe journey; the receipt remains the first success screen.
                attachCookingOrder(cartId, confirmedOrderId)

                clearFloatingCartCompanion(cartId)

                navigate(
                  `/orders/${confirmedOrderId}`,
                  {
                    replace:
                      true,
                  },
                )
              } catch (
                verifyError
              ) {
                setError(
                  getCommerceErrorMessage(
                    verifyError,
                    'Payment callback returned but server signature verification failed.',
                  ),
                )
              } finally {
                setPaying(
                  false,
                )
              }
            },

          modal: {
            ondismiss:
              () => {
                setPaying(
                  false,
                )
              },
          },
        })

      razorpay.on(
        'payment.failed',
        () => {
          setError(
            'Payment was not completed. No order fulfilment was confirmed.',
          )

          setPaying(
            false,
          )
        },
      )

      razorpay.open()
    } catch (
      paymentError
    ) {
      if (getCommerceErrorMessage(paymentError, '').includes('International delivery is not available')) {
        setInternationalBlocked(true)
      }
      setError(
        getCommerceErrorMessage(
          paymentError,
          'Unable to start hosted payment.',
        ),
      )

      setPaying(
        false,
      )
    }
  }

  const order = data?.order || {}
  const sellerOrders = data?.sellerOrders || []
  const blockers = order.checkoutBlockers || []
  const addressPath = `/delivery-addresses?returnTo=${encodeURIComponent(`/checkout/${cartId}`)}`
  const total = order.totals?.totalLandedCostMinor
  const currency = order.totals?.currency
  const international = internationalBlocked || isInternationalAddress(deliveryAddress)
  const ready = order.paymentReady === true && blockers.length === 0 && !international
  const refreshCheckout = () => prepare({ refresh: true })
  const cookingPath = getCookingReturnPath({ cartId })
  const items = sellerOrders.flatMap(seller => seller.items || [])
  const imageRequest = JSON.stringify([...new Map(items.filter(item => checkoutImageKey(item) && !checkoutImageUrl(item)).map(item => [checkoutImageKey(item), {
    key: checkoutImageKey(item), productVersionId: item.productVersionId, packId: item.packId, displayName: item.displayName,
  }])).values()])
  useEffect(() => {
    let active = true
    const requests = JSON.parse(imageRequest)
    async function loadImages() {
      const resolved = {}
      for (let offset = 0; offset < requests.length && active; offset += 4) {
        await Promise.all(requests.slice(offset, offset + 4).map(async item => {
          if (!item.displayName) return
          try {
            const response = await getCatalogProducts({ search: item.displayName, limit: 50 })
            const exact = (response?.products || []).find(product =>
              (item.productVersionId && String(product.productVersionId || product.id) === String(item.productVersionId)) ||
              (item.packId && String(product.packId) === String(item.packId)))
            const image = checkoutImageUrl(exact)
            if (image) resolved[item.key] = image
          } catch { /* Images are optional; checkout remains independent. */ }
        }))
      }
      if (active) setProductImages(resolved)
    }
    void loadImages()
    return () => { active = false }
  }, [imageRequest])

  // The missing seller policy also explains why the delivery fee is incomplete.
  // Show one actionable message instead of duplicating the same underlying issue.
  const visibleBlockers = blockers.filter(code => code !== 'LANDED_COST_INCOMPLETE' || !blockers.includes('SELLER_POLICIES_NOT_CONFIGURED'))
  const sellerSettingsMissing = blockers.includes('SELLER_POLICIES_NOT_CONFIGURED')
  const busy = loading || refreshing || paying

  return (
    <main className="ep-checkout-v3">
      <style>{`
        .ep-checkout-v3 {background:#F7F6F2;color:#202421;min-height:70vh;}
        .ep-checkout-v3 * {box-sizing:border-box;}
        .ep-checkout-v3 .ec3-wrap {max-width:1380px;margin:auto;padding:24px 36px 54px;}
        .ep-checkout-v3 .ec3-link {display:inline-flex;align-items:center;gap:7px;color:#173F35;font-size:14px;font-weight:700;text-decoration:none;}
        .ep-checkout-v3 .ec3-link:hover {text-decoration:underline;}
        .ep-checkout-v3 .ec3-toolbar,.ep-checkout-v3 .ec3-line {display:flex;justify-content:space-between;align-items:center;gap:12px;}
        .ep-checkout-v3 .ec3-toolbar {margin-bottom:19px;flex-wrap:wrap;}
        .ep-checkout-v3 .ec3-refresh {display:inline-flex;align-items:center;gap:7px;border:1px solid #D7DDCF;border-radius:9px;padding:8px 12px;background:transparent;color:#173F35;font-weight:650;font-size:14px;cursor:pointer;}
        .ep-checkout-v3 button:disabled {opacity:.6;cursor:not-allowed;}
        .ep-checkout-v3 .ec3-mast {display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:22px;padding:23px 28px;background:#C56C42;color:#202421;border-radius:14px;margin-bottom:30px;}
        .ep-checkout-v3 h1.ec3-title {font-size:38px!important;line-height:1.12!important;letter-spacing:-.045em;margin:0;font-weight:800!important;color:#202421;}
        .ep-checkout-v3 .ec3-progress {display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;flex-wrap:wrap;}
        .ep-checkout-v3 .ec3-progress span {display:inline-flex;align-items:center;gap:6px;}
        .ep-checkout-v3 .ec3-progress .current {background:#F7F6F2;border-radius:7px;padding:9px 13px;color:#173F35;}
        .ep-checkout-v3 .ec3-layout {display:grid;grid-template-columns:minmax(0,1.7fr) minmax(320px,1fr);gap:34px;align-items:start;}
        .ep-checkout-v3 .ec3-main {min-width:0;}
        .ep-checkout-v3 h2.ec3-heading {font-size:24px!important;line-height:1.25!important;letter-spacing:-.025em;margin:0;font-weight:750!important;color:#202421;}
        .ep-checkout-v3 .ec3-address {display:grid;grid-template-columns:50px minmax(0,1fr) auto;gap:15px;align-items:start;padding:22px;background:#D7DDCF;border-radius:13px;margin-bottom:31px;}
        .ep-checkout-v3 .ec3-address-mark {display:grid;place-items:center;width:50px;height:50px;border-radius:12px;background:#F7F6F2;color:#173F35;}
        .ep-checkout-v3 .ec3-address p {margin:0;overflow-wrap:anywhere;}
        .ep-checkout-v3 .ec3-address-title {font-size:14px;font-weight:700;color:#173F35;margin-bottom:7px;}
        .ep-checkout-v3 .ec3-recipient {font-size:17px;font-weight:750;line-height:1.5;}
        .ep-checkout-v3 .ec3-muted {font-size:14px;line-height:1.5;color:#526359;}
        .ep-checkout-v3 .ec3-change {border:1px solid #173F35;border-radius:8px;padding:8px 13px;white-space:nowrap;}
        .ep-checkout-v3 .ec3-section-head {padding-bottom:12px;border-bottom:2px solid #C56C42;margin-bottom:4px;}
        .ep-checkout-v3 .ec3-seller {margin:0 0 17px;}
        .ep-checkout-v3 .ec3-seller-head {padding:17px 0 12px;}
        .ep-checkout-v3 h3.ec3-seller-name {font-size:17px!important;font-weight:750!important;line-height:1.4!important;color:#173F35;margin:0;overflow-wrap:anywhere;}
        .ep-checkout-v3 .ec3-product {display:grid;grid-template-columns:84px minmax(0,1fr) auto;gap:16px;align-items:center;padding:16px 0;border-top:1px solid #D7DDCF;}
        .ep-checkout-v3 .ec2-product-image {display:grid;place-items:center;width:84px;height:84px;background:#fff;border:1px solid #D7DDCF;border-radius:10px;overflow:hidden;color:#173F35;}
        .ep-checkout-v3 .ec2-product-image img {width:100%;height:100%;object-fit:contain;display:block;}
        .ep-checkout-v3 .ec3-product-name {font-size:16px;font-weight:700;line-height:1.45;overflow-wrap:anywhere;}
        .ep-checkout-v3 .ec3-price {font-size:16px;font-weight:750;color:#173F35;white-space:nowrap;font-variant-numeric:tabular-nums;}
        .ep-checkout-v3 .ec3-policies {display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #D7DDCF;border-bottom:1px solid #D7DDCF;gap:20px;}
        .ep-checkout-v3 .ec3-policies details {min-width:0;padding:13px 0;}
        .ep-checkout-v3 .ec3-policies summary {display:flex;align-items:center;gap:8px;cursor:pointer;list-style:none;color:#173F35;font-weight:650;font-size:14px;}
        .ep-checkout-v3 .ec3-policies summary::-webkit-details-marker {display:none;}
        .ep-checkout-v3 .ec3-policies details[open] .ec3-chevron {transform:rotate(180deg);}
        .ep-checkout-v3 .ec3-summary {background:#173F35;color:#F7F6F2;border-radius:16px;padding:25px;}
        .ep-checkout-v3 .ec3-summary-label {display:flex;align-items:center;gap:9px;font-size:17px;font-weight:700;color:#F7F6F2;}
        .ep-checkout-v3 .ec3-summary-row {display:flex;align-items:start;justify-content:space-between;gap:12px;padding:10px 0;font-size:15px;color:#F7F6F2;}
        .ep-checkout-v3 .ec3-summary-row strong {text-align:right;}
        .ep-checkout-v3 .ec3-total-block {border-top:1px solid #ffffff38;margin-top:10px;padding-top:17px;}
        .ep-checkout-v3 .ec3-total {font-size:clamp(28px,3.4vw,42px);letter-spacing:-.04em;line-height:1.2;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
        .ep-checkout-v3 .ec3-primary {width:100%;min-height:52px;display:flex;align-items:center;justify-content:center;gap:9px;background:#C56C42;color:#202421;border:0;border-radius:10px;padding:12px 16px;font-size:16px;font-weight:800;cursor:pointer;margin-top:17px;}
        .ep-checkout-v3 .ec3-primary:hover:not(:disabled) {box-shadow:inset 0 0 0 2px #F7F6F2;}
        .ep-checkout-v3 .ec3-security {display:flex;align-items:center;justify-content:center;gap:7px;font-size:13px;color:#D7DDCF;margin-top:13px;}
        .ep-checkout-v3 .ec3-notice {background:#F7F6F2;border-left:3px solid #C56C42;color:#202421;padding:13px 14px;border-radius:4px;font-size:14px;line-height:1.5;margin-top:15px;}
        .ep-checkout-v3 .ec3-legal {font-size:13px;color:#526359;line-height:1.6;margin:15px 3px 0;}
        .ep-checkout-v3 .ec3-alert {display:flex;gap:10px;background:#fff4f1;border-left:3px solid #a13226;color:#8b2c24;padding:13px 15px;margin-bottom:20px;font-size:14px;}
        .ep-checkout-v3 .ec2-heading {font-size:24px!important;font-weight:750!important;line-height:1.25!important;}
        .ep-checkout-v3 :is(button,a,summary):focus-visible {outline:2px solid #C56C42;outline-offset:3px;}
        @media(min-width:1000px) {.ep-checkout-v3 .ec3-aside {position:sticky;top:96px;}}
        @media(max-width:860px) {.ep-checkout-v3 .ec3-layout {grid-template-columns:1fr;gap:20px;} .ep-checkout-v3 .ec3-mast {grid-template-columns:1fr;gap:14px;} .ep-checkout-v3 .ec3-aside {position:static;} }
        @media(max-width:600px) {.ep-checkout-v3 .ec3-wrap {padding:16px 12px 28px;} .ep-checkout-v3 .ec3-toolbar {margin-bottom:13px;} .ep-checkout-v3 .ec3-mast {padding:18px 16px;margin-bottom:20px;border-radius:12px;} .ep-checkout-v3 h1.ec3-title {font-size:29px!important;} .ep-checkout-v3 h2.ec3-heading {font-size:21px!important;} .ep-checkout-v3 .ec3-address {grid-template-columns:38px minmax(0,1fr);padding:15px;gap:10px;margin-bottom:23px;} .ep-checkout-v3 .ec3-address-mark {width:38px;height:38px;} .ep-checkout-v3 .ec3-change {grid-column:2;justify-self:start;padding:5px 10px;} .ep-checkout-v3 .ec3-product {grid-template-columns:62px minmax(0,1fr) auto;gap:10px;padding:12px 0;} .ep-checkout-v3 .ec2-product-image {width:62px;height:62px;} .ep-checkout-v3 .ec3-product-name,.ep-checkout-v3 .ec3-price {font-size:14px;} .ep-checkout-v3 .ec3-summary {padding:18px;} .ep-checkout-v3 .ec3-policies {gap:10px;} }
        @media(max-width:350px) {.ep-checkout-v3 .ec3-product {grid-template-columns:56px minmax(0,1fr);} .ep-checkout-v3 .ec3-price {grid-column:2;} .ep-checkout-v3 .ec3-progress {gap:6px;} }
      `}</style>
      <div className="ec3-wrap">
        <div className="ec3-toolbar">
          <Link to={`/cart/${cartId}`} className="ec3-link"><ArrowLeft size={17} aria-hidden="true" /> Back to basket</Link>
          {cookingPath && <Link to={cookingPath} className="ec3-link">Continue guided cooking</Link>}
          <button type="button" onClick={refreshCheckout} disabled={busy} className="ec3-refresh"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <header className="ec3-mast">
          <h1 className="ec3-title">Review &amp; pay</h1>
          <div className="ec3-progress" aria-label="Checkout progress"><span><CheckCircle2 size={16} aria-hidden="true" /> Basket</span><ArrowRight size={14} aria-hidden="true" /><span><CheckCircle2 size={16} aria-hidden="true" /> Delivery</span><ArrowRight size={14} aria-hidden="true" /><span className="current" aria-current="step"><LockKeyhole size={15} aria-hidden="true" /> Payment</span></div>
        </header>
        {loading && <div role="status" className="py-12 text-center text-[#173F35]">Preparing checkout…</div>}
        {error && <div role="alert" className="ec3-alert"><AlertTriangle size={18} className="shrink-0" aria-hidden="true" /><span>{error}</span></div>}
        {!loading && <div className="ec3-layout">
          <div className="ec3-main">
            {deliveryAddress && <section className="ec3-address" aria-label="Delivery address">
              <span className="ec3-address-mark"><MapPin size={24} aria-hidden="true" /></span>
              <div className="min-w-0"><div className="ec3-address-title">Deliver to</div><p className="ec3-recipient">{deliveryAddress.recipientName || 'Recipient'}{deliveryAddress.phone ? ` · ${deliveryAddress.phone}` : ''}</p><p className="ec3-muted">{formatDeliveryAddress(deliveryAddress)}</p>{deliveryAddress.deliveryInstructions && <p className="ec3-muted">Delivery note: {deliveryAddress.deliveryInstructions}</p>}</div>
              <Link to={addressPath} className="ec3-link ec3-change">Change</Link>
            </section>}
            {!data && !refreshing && <div className="mb-5"><Link to={addressPath} className="ec3-link">Choose delivery address <ArrowRight size={15} aria-hidden="true" /></Link></div>}
            {refreshing && <p role="status" className="ec3-muted mb-3">Checking latest order details…</p>}
            {data && <section>
              <div className="ec3-line ec3-section-head"><h2 className="ec3-heading">Your order</h2><span className="ec3-muted">{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>
              {sellerOrders.map(sellerOrder => <article key={sellerOrder.id} className="ec3-seller">
                <div className="ec3-line ec3-seller-head"><div className="flex min-w-0 items-center gap-2"><Store size={19} className="shrink-0 text-[#173F35]" aria-hidden="true" /><h3 className="ec3-seller-name">{sellerOrder.sellerName}</h3></div><div className="text-right"><div className="ec3-muted">Seller total</div><strong className="ec3-price">{formatMoney(sellerOrder.commercialSnapshot?.totalLandedCostMinor, sellerOrder.commercialSnapshot?.currency || currency)}</strong></div></div>
                {(sellerOrder.items || []).map((item,index) => <div className="ec3-product" key={item.cartItemId || item.offerId || index}><CheckoutProductImage item={item} images={productImages} /><div className="min-w-0"><p className="ec3-product-name">{item.displayName || 'Product'}</p><p className="ec3-muted mt-1">Quantity: {item.packCount}</p></div><div className="ec3-price">{formatMoney(item.lineTotal?.amountMinor, item.lineTotal?.currency || currency)}</div></div>)}
                <div className="ec3-policies">
                  <details><summary><ShieldCheck size={17} aria-hidden="true" /> Cancellation <ChevronDown size={15} className="ec3-chevron ml-auto" aria-hidden="true" /></summary><p className="ec3-muted mt-2">{sellerOrder.promise?.cancellationPolicySummary || 'Not confirmed'}</p></details>
                  <details><summary><CheckCircle2 size={17} aria-hidden="true" /> Returns <ChevronDown size={15} className="ec3-chevron ml-auto" aria-hidden="true" /></summary><p className="ec3-muted mt-2">{sellerOrder.promise?.returnPolicySummary || 'Not confirmed'}</p></details>
                </div>
              </article>)}
            </section>}
          </div>
          {data && <aside className="ec3-aside min-w-0" aria-label="Payment summary">
            <section className="ec3-summary">
              <div className="ec3-summary-label"><CreditCard size={20} aria-hidden="true" /> Payment summary</div>
              <div className="mt-4">
                <div className="ec3-summary-row"><span>Items</span><strong>{formatMoney(order.totals?.itemSubtotalMinor, currency)}</strong></div>
                <div className="ec3-summary-row"><span>Delivery &amp; fees</span><strong>{formatMoney(order.totals?.knownFeesMinor, currency)}</strong></div>
              </div>
              <div className="ec3-total-block"><div className="text-sm font-semibold">Total to pay</div><div className="ec3-total">{formatMoney(total, currency)}</div></div>
              {!ready && <div className="ec3-notice" role="status"><p className="font-bold">{international ? 'Delivery unavailable' : 'Payment not ready'}</p>{international ? <p className="mt-1">{INTERNATIONAL_MESSAGE}</p> : visibleBlockers.length ? <><ul className="mt-1 space-y-1">{visibleBlockers.map(code => <li key={code}>{blockerLabel(code)}</li>)}</ul>{sellerSettingsMissing && <p className="mt-2">Once the seller updates checkout settings, check again.</p>}</> : <p className="mt-1">Check again to confirm the total.</p>}</div>}
              {international ? <button type="button" className="ec3-primary" onClick={() => setInternationalBlocked(true)} disabled={busy}><MapPin size={18} aria-hidden="true" /> Change delivery address</button> : ready ? <button type="button" className="ec3-primary" onClick={handlePayment} disabled={busy}><LockKeyhole size={18} aria-hidden="true" />{paying ? 'Opening payment…' : `Pay ${formatMoney(total, currency)}`}<ArrowRight size={17} aria-hidden="true" /></button> : <button type="button" className="ec3-primary" disabled={busy} onClick={refreshCheckout}><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Checking checkout…' : 'Check payment again'}</button>}
              <p className="ec3-security"><ShieldCheck size={16} aria-hidden="true" /> Secured by Razorpay</p>
            </section>
            <p className="ec3-legal"><Link to="/terms" className="font-semibold text-[#173F35] underline">Terms &amp; Conditions</Link> · <Link to="/privacy-policy" className="font-semibold text-[#173F35] underline">Privacy Policy</Link></p>
          </aside>}
        </div>}
      </div>
      <dialog ref={internationalDialogRef} onClose={() => setInternationalBlocked(false)} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-[#D7DDCF] bg-[#F7F6F2] p-0 text-[#202421] backdrop:bg-black/50" aria-labelledby="international-title">
        <div className="bg-[#C56C42] p-5"><MapPin size={24} aria-hidden="true" /><h2 id="international-title" className="ec2-heading mt-2">Delivery outside India</h2></div>
        <div className="space-y-4 p-5"><p className="text-[15px] leading-6">{INTERNATIONAL_MESSAGE}</p><Link to={addressPath} className="block rounded-lg bg-[#173F35] px-4 py-3 text-center font-semibold text-white">Choose Indian address</Link><button type="button" onClick={() => internationalDialogRef.current?.close()} className="w-full rounded-lg border border-[#D7DDCF] px-4 py-2 text-sm font-semibold">Close</button></div>
      </dialog>
    </main>
  )
}
