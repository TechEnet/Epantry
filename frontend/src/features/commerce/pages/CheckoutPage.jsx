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
  prepareCheckout,
  verifyPayment,
} from '../services/commerce.service'

import {
  getDefaultDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

const RAZORPAY_CHECKOUT_URL =
  'https://checkout.razorpay.com/v1/checkout.js'

function clearFloatingCartCompanion() {
  try {
    window.sessionStorage.removeItem(
      'epantry-floating-marketplace-cart',
    )
    window.sessionStorage.removeItem(
      'epantry-pending-recipe-cart',
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
          show: false,
        },
      },
    ),
  )
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

function blockerLabel(
  code,
) {
  const labels = {
    LANDED_COST_INCOMPLETE:
      'A seller delivery fee or checkout promise is still missing.',

    SELLER_POLICIES_NOT_CONFIGURED:
      'One or more Host organizations have not configured cancellation and return promises.',

    PAYMENT_PROVIDER_NOT_CONFIGURED:
      'Razorpay credentials are not configured on the backend yet.',
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

        setError(
          '',
        )

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

  async function handlePayment() {
    const order =
      data?.order

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

                clearFloatingCartCompanion()

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

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-[#f6f7f3]">
        <div className="page-shell py-8">
          <div className="h-[640px] animate-pulse rounded-[32px] border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,118,110,0.08)]" />
        </div>
      </main>
    )
  }

  if (
    error &&
    !data
  ) {
    return (
      <main className="min-h-screen bg-[#f6f7f3]">
        <div className="page-shell py-10">
          <div className="mx-auto max-w-3xl rounded-[30px] border border-rose-200 bg-white p-7 shadow-[0_18px_55px_rgba(127,29,29,0.08)] sm:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <AlertTriangle size={22} aria-hidden="true" />
            </div>

            <h1 className="mt-5 text-2xl font-black tracking-tight text-rose-950">
              Checkout unavailable
            </h1>

            <p className="mt-2 text-sm leading-6 text-rose-800">
              {error}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={`/cart/${cartId}`}
                className="focus-ring inline-flex items-center gap-2 rounded-xl bg-rose-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-rose-900"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to Cart
              </Link>

              <Link
                to={`/delivery-addresses?returnTo=${encodeURIComponent(
                  `/checkout/${cartId}`,
                )}`}
                className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-800 transition hover:bg-rose-50"
              >
                <MapPin size={16} aria-hidden="true" />
                Choose delivery address
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const order =
    data?.order ||
    {}

  const sellerOrders =
    data?.sellerOrders ||
    []

  const blockers =
    order.checkoutBlockers ||
    []

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f9f5_0%,#f7f5ef_52%,#f4f2eb_100%)]">
      <div className="page-shell py-6 sm:py-9">
        <Link
          to={`/cart/${cartId}`}
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 transition hover:text-emerald-800"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Back to Cart
        </Link>

        <section className="relative mt-3 overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,118,110,0.09)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.13),transparent_34%),linear-gradient(120deg,rgba(236,253,245,0.72),transparent_48%)]" />

          <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-3 py-1.5 text-emerald-800 shadow-sm backdrop-blur">
                <LockKeyhole
                  size={15}
                  aria-hidden="true"
                />

                <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                  Secure checkout
                </p>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl lg:text-[42px]">
                Review the payable promise
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                EPANTRY resolves seller splits, delivery fees, cancellation
                and return promises before hosted payment begins. Raw card
                details never pass through EPANTRY.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                prepare({
                  refresh:
                    true,
                })
              }
              disabled={
                refreshing ||
                paying
              }
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-sm font-black text-stone-700 shadow-sm backdrop-blur transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
                aria-hidden="true"
              />

              Revalidate checkout
            </button>
          </div>

          <div className="relative grid gap-3 border-t border-emerald-100 bg-white/80 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50/90 p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                Items
              </p>

              <p className="mt-1.5 text-2xl font-black tracking-tight text-stone-950">
                {formatMoney(
                  order.totals
                    ?.itemSubtotalMinor,
                  order.totals
                    ?.currency,
                )}
              </p>
            </div>

            <div className="rounded-[22px] border border-blue-100 bg-blue-50/65 p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                Known fees
              </p>

              <p className="mt-1.5 text-2xl font-black tracking-tight text-stone-950">
                {formatMoney(
                  order.totals
                    ?.knownFeesMinor,
                  order.totals
                    ?.currency,
                )}
              </p>
            </div>

            <div className="rounded-[22px] border border-emerald-200 bg-emerald-700 p-4 text-white shadow-[0_14px_34px_rgba(4,120,87,0.16)] sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
                Total landed cost
              </p>

              <p className="mt-1.5 text-2xl font-black tracking-tight">
                {formatMoney(
                  order.totals
                    ?.totalLandedCostMinor,
                  order.totals
                    ?.currency,
                )}
              </p>
            </div>
          </div>
        </section>

        {deliveryAddress && (
          <section className="mt-5 rounded-[26px] border border-emerald-200 bg-[#eaf9f3] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white">
                  <MapPin
                    size={18}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
                    Delivery address locked for this order
                  </p>

                  <p className="mt-1 text-base font-black text-stone-950">
                    {deliveryAddress.recipientName || 'Recipient'}
                    {deliveryAddress.phone
                      ? ` · ${deliveryAddress.phone}`
                      : ''}
                  </p>

                  <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-stone-600">
                    {formatDeliveryAddress(
                      deliveryAddress,
                    )}
                  </p>

                  {deliveryAddress.deliveryInstructions && (
                    <p className="mt-2 text-xs font-semibold text-stone-500">
                      Delivery note: {deliveryAddress.deliveryInstructions}
                    </p>
                  )}
                </div>
              </div>

              <Link
                to={`/delivery-addresses?returnTo=${encodeURIComponent(
                  `/checkout/${cartId}`,
                )}`}
                className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-900 shadow-sm transition hover:bg-emerald-50"
              >
                Change address
              </Link>
            </div>
          </section>
        )}

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.7fr)] lg:items-start">
          <section className="space-y-4">
            {sellerOrders.map(
              (
                sellerOrder,
                sellerIndex,
              ) => (
                <article
                  key={
                    sellerOrder.id
                  }
                  className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_14px_42px_rgba(28,25,23,0.06)]"
                >
                  <div className="flex flex-col gap-4 border-b border-stone-100 bg-[linear-gradient(90deg,#ffffff_0%,#f4fbf7_100%)] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                        <Store
                          size={20}
                          aria-hidden="true"
                        />
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700">
                          Seller {sellerIndex + 1}
                        </p>

                        <h2 className="mt-1 text-lg font-black text-stone-950">
                          {
                            sellerOrder
                              .sellerName
                          }
                        </h2>

                        <p className="mt-1 text-sm text-stone-500">
                          {
                            sellerOrder
                              .items?.length ||
                            0
                          } Marketplace items
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-left shadow-sm lg:text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                        Seller landed total
                      </p>

                      <p className="mt-1 text-xl font-black tracking-tight text-stone-950">
                        {formatMoney(
                          sellerOrder
                            .commercialSnapshot
                            ?.totalLandedCostMinor,

                          sellerOrder
                            .commercialSnapshot
                            ?.currency,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
                    <div className="rounded-[22px] border border-stone-200 bg-stone-50/75 p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm">
                          <ShieldCheck size={16} aria-hidden="true" />
                        </div>

                        <p className="text-xs font-black uppercase tracking-[0.11em] text-stone-600">
                          Cancellation
                        </p>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-stone-700">
                        {
                          sellerOrder
                            .promise
                            ?.cancellationPolicySummary ||
                          'Not configured'
                        }
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-stone-200 bg-stone-50/75 p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm">
                          <CheckCircle2 size={16} aria-hidden="true" />
                        </div>

                        <p className="text-xs font-black uppercase tracking-[0.11em] text-stone-600">
                          Returns
                        </p>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-stone-700">
                        {
                          sellerOrder
                            .promise
                            ?.returnPolicySummary ||
                          'Not configured'
                        }
                      </p>
                    </div>
                  </div>
                </article>
              ),
            )}
          </section>

          <aside className="lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_18px_52px_rgba(15,118,110,0.09)]">
              <div className="border-b border-stone-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_72%)] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                    <CreditCard size={18} aria-hidden="true" />
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700">
                      Payment summary
                    </p>

                    <h2 className="mt-1 text-lg font-black text-stone-950">
                      Ready to review
                    </h2>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold text-stone-500">Items</span>
                  <span className="font-black text-stone-950">
                    {formatMoney(
                      order.totals
                        ?.itemSubtotalMinor,
                      order.totals
                        ?.currency,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold text-stone-500">Known fees</span>
                  <span className="font-black text-stone-950">
                    {formatMoney(
                      order.totals
                        ?.knownFeesMinor,
                      order.totals
                        ?.currency,
                    )}
                  </span>
                </div>

                <div className="my-4 h-px bg-stone-200" />

                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm font-black text-stone-700">Total</span>
                  <span className="text-2xl font-black tracking-tight text-emerald-800">
                    {formatMoney(
                      order.totals
                        ?.totalLandedCostMinor,
                      order.totals
                        ?.currency,
                    )}
                  </span>
                </div>
              </div>

              {blockers.length >
              0 ? (
                <div className="border-t border-amber-200 bg-amber-50 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertTriangle
                        size={18}
                        aria-hidden="true"
                      />
                    </div>

                    <div>
                      <h3 className="font-black text-amber-950">
                        Payment is intentionally blocked
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        EPANTRY will not accept payment until the commercial promise
                        is complete and Razorpay is configured.
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {blockers.map(
                      (
                        blocker,
                      ) => (
                        <li
                          key={
                            blocker
                          }
                          className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2.5 text-sm font-semibold leading-5 text-amber-900"
                        >
                          {blockerLabel(
                            blocker,
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : (
                <div className="border-t border-emerald-100 bg-emerald-50/70 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      size={20}
                      className="mt-0.5 shrink-0 text-emerald-700"
                      aria-hidden="true"
                    />

                    <div>
                      <h3 className="font-black text-emerald-950">
                        Checkout promise complete
                      </h3>

                      <p className="mt-1.5 text-sm leading-6 text-emerald-800">
                        Scarce inventory is reserved temporarily and payment is verified before fulfilment is finalized.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handlePayment
                    }
                    disabled={
                      paying
                    }
                    className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-[0_14px_28px_rgba(4,120,87,0.22)] transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CreditCard
                      size={18}
                      aria-hidden="true"
                    />

                    {
                      paying
                        ? 'Opening payment…'
                        : 'Pay with Razorpay'
                    }
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-xs font-semibold leading-5 text-stone-500 shadow-sm backdrop-blur">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />

              EPANTRY never stores raw card number, CVV or card expiry.
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
