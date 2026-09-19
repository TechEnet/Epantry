import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  MapPin,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  XCircle,
} from 'lucide-react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  createCommerceIdempotencyKey,
  getCommerceErrorMessage,
  getHostOrder,
  updateHostOrderStatus,
} from '../../commerce/services/commerce.service'

const TRANSITIONS =
  Object.freeze({
    confirmed: [
      'seller_accepted',
      'rejected',
      'partial_unavailable',
      'substitution_requested',
      'seller_cancelled',
    ],

    seller_accepted: [
      'picking',
      'partial_unavailable',
      'substitution_requested',
      'seller_cancelled',
    ],

    picking: [
      'packed',
      'partial_unavailable',
      'substitution_requested',
      'seller_cancelled',
    ],

    packed: [
      'carrier_handoff',
      'out_for_delivery',
      'seller_cancelled',
    ],

    carrier_handoff: [
      'out_for_delivery',
      'delivered',
      'delivery_failed',
    ],

    out_for_delivery: [
      'delivered',
      'delivery_failed',
    ],

    delivery_failed: [
      'out_for_delivery',
      'returned',
    ],

    substitution_requested: [
      'seller_accepted',
      'partial_unavailable',
      'seller_cancelled',
    ],

    return_requested: [
      'returned',
    ],

    returned: [
      'refunded',
    ],
  })

const PRIMARY_FLOW = [
  {
    key: 'confirmed',
    label: 'Confirmed',
    description: 'Paid order received from the customer.',
    icon: ShoppingBag,
  },
  {
    key: 'seller_accepted',
    label: 'Accepted',
    description: 'You accepted responsibility for this order.',
    icon: CheckCircle2,
  },
  {
    key: 'picking',
    label: 'Picking',
    description: 'Items are being prepared for packing.',
    icon: PackageOpen,
  },
  {
    key: 'packed',
    label: 'Packed',
    description: 'Order is packed and ready to dispatch.',
    icon: PackageCheck,
  },
  {
    key: 'carrier_handoff',
    label: 'Handoff',
    description: 'Order has been handed to the carrier.',
    icon: Truck,
  },
  {
    key: 'out_for_delivery',
    label: 'Out for delivery',
    description: 'Order is on the way to the customer.',
    icon: Truck,
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Order has reached the customer.',
    icon: Check,
  },
]

const TERMINAL_STATUSES = new Set([
  'delivered',
  'rejected',
  'seller_cancelled',
  'returned',
  'refunded',
])

const PROBLEM_STATUSES = new Set([
  'rejected',
  'partial_unavailable',
  'substitution_requested',
  'seller_cancelled',
  'delivery_failed',
  'return_requested',
  'returned',
  'refunded',
])

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

function label(
  value,
) {
  return String(
    value ||
      'unknown',
  )
    .split(
      '_',
    )
    .map(
      (
        token,
      ) =>
        `${token
          .charAt(
            0,
          )
          .toUpperCase()}${token.slice(
          1,
        )}`,
    )
    .join(
      ' ',
    )
}

function orderDisplayName(
  order,
) {
  const names =
    (
      order?.items ||
      []
    )
      .map(
        (
          item,
        ) =>
          String(
            item?.displayName ||
              '',
          ).trim(),
      )
      .filter(
        Boolean,
      )

  if (
    names.length ===
    0
  ) {
    return 'Host order'
  }

  if (
    names.length ===
    1
  ) {
    return names[0]
  }

  return `${names[0]} + ${
    names.length -
    1
  } more`
}

function statusTone(
  status,
) {
  if (
    status ===
    'delivered'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }

  if (
    PROBLEM_STATUSES.has(
      status,
    )
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-800'
  }

  if (
    status ===
      'confirmed' ||
    status ===
      'seller_accepted'
  ) {
    return 'border-sky-200 bg-sky-50 text-sky-800'
  }

  return 'border-violet-200 bg-violet-50 text-violet-800'
}

function formatDateTime(
  value,
) {
  if (
    !value
  ) {
    return ''
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
    return ''
  }

  return date.toLocaleString()
}

function findStepState(
  currentStatus,
  stepKey,
) {
  const currentIndex =
    PRIMARY_FLOW.findIndex(
      (
        step,
      ) =>
        step.key ===
        currentStatus,
    )

  const stepIndex =
    PRIMARY_FLOW.findIndex(
      (
        step,
      ) =>
        step.key ===
        stepKey,
    )

  if (
    currentStatus ===
    'delivered'
  ) {
    return 'complete'
  }

  if (
    currentIndex ===
    -1
  ) {
    return stepKey ===
      'confirmed'
      ? 'complete'
      : 'pending'
  }

  if (
    stepIndex <
    currentIndex
  ) {
    return 'complete'
  }

  if (
    stepIndex ===
    currentIndex
  ) {
    return 'current'
  }

  return 'pending'
}

export default function HostOrderDetailPage() {
  const {
    orderId,
  } =
    useParams()

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    nextStatus,
    setNextStatus,
  ] =
    useState(
      '',
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    saving,
    setSaving,
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

  const load =
    useCallback(
      async () => {
        if (
          !orderId
        ) {
          return
        }

        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          setData(
            await getHostOrder(
              orderId,
            ),
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load Host Order.',
            ),
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        orderId,
      ],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  const allowed =
    useMemo(
      () =>
        TRANSITIONS[
          data?.order?.status
        ] ||
        [],
      [
        data?.order?.status,
      ],
    )

  useEffect(
    () => {
      setNextStatus(
        allowed[0] ||
        '',
      )
    },
    [
      allowed,
    ],
  )

  async function handleStatusUpdate() {
    if (
      !orderId ||
      !nextStatus ||
      saving
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      '',
    )

    try {
      setData(
        await updateHostOrderStatus({
          orderId,

          status:
            nextStatus,

          idempotencyKey:
            createCommerceIdempotencyKey(
              'host-order-status',
            ),
        }),
      )
    } catch (
      updateError
    ) {
      setError(
        getCommerceErrorMessage(
          updateError,
          'Unable to update Host Order status.',
        ),
      )
    } finally {
      setSaving(
        false,
      )
    }
  }

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] p-5 sm:p-7">
        <div className="h-[560px] animate-pulse rounded-[30px] border border-stone-200 bg-white" />
      </main>
    )
  }

  const order =
    data?.order ||
    {}

  const shortOrderId =
    order.id
      ?.slice(
        -8,
      )
      .toUpperCase() ||
    '—'

  const isTerminal =
    TERMINAL_STATUSES.has(
      order.status,
    )

  const itemCount =
    (order.items || [])
      .reduce(
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
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-[1500px]">
        <Link
          to="/host/orders"
          className="inline-flex items-center gap-2 text-sm font-black text-stone-600 transition hover:text-emerald-700"
        >
          <ArrowLeft
            size={17}
          />

          Back to Host Orders
        </Link>

        <section className="mt-4 overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_16px_45px_rgba(28,25,23,0.06)]">
          <div className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-5 py-6 sm:px-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl" />

            <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-emerald-800 shadow-sm backdrop-blur">
                  <Store
                    size={16}
                  />

                  <span className="text-[11px] font-black uppercase tracking-[0.18em]">
                    Host Order Detail
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-[34px]">
                      {orderDisplayName(
                        order,
                      )}
                    </h1>

                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-stone-400">
                      Order reference {shortOrderId}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(
                      order.status,
                    )}`}
                  >
                    {label(
                      order.status,
                    )}
                  </span>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  Review the customer promise, prepare the order, and move fulfilment through its controlled status sequence.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  load
                }
                className="inline-flex h-fit items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white/90 px-4 py-2.5 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? 'animate-spin'
                      : ''
                  }
                />

                Refresh
              </button>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                  Current status
                </p>
                <p className="mt-1 text-base font-black text-stone-950">
                  {label(
                    order.status,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                  Order packs
                </p>
                <p className="mt-1 text-base font-black text-stone-950">
                  {itemCount}
                </p>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                  Timeline updates
                </p>
                <p className="mt-1 text-base font-black text-stone-950">
                  {(data?.timeline || []).length}
                </p>
              </div>
            </div>
          </div>

          {allowed.length >
            0 ? (
            <div className="grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ChevronRight
                      size={18}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">
                      Next fulfilment action
                    </p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      Only transitions permitted by the current order state are available.
                    </p>
                  </div>
                </div>

                <label className="mt-4 block text-xs font-black uppercase tracking-[0.08em] text-stone-500">
                  Controlled next status

                  <select
                    value={
                      nextStatus
                    }
                    onChange={(
                      event,
                    ) =>
                      setNextStatus(
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-sm font-black text-stone-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    {allowed.map(
                      (
                        status,
                      ) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {label(
                            status,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={
                  handleStatusUpdate
                }
                disabled={
                  !nextStatus ||
                  saving
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-[0_10px_25px_rgba(4,120,87,0.22)] transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save
                  size={17}
                />

                {saving
                  ? 'Updating...'
                  : 'Update status'}
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-5 py-5 sm:px-7">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                {isTerminal ? (
                  <CheckCircle2
                    size={19}
                  />
                ) : (
                  <Clock3
                    size={19}
                  />
                )}
              </div>

              <div>
                <p className="text-sm font-black text-stone-900">
                  {isTerminal
                    ? 'No further fulfilment action required.'
                    : 'No controlled transition is available right now.'}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Current status: {label(
                    order.status,
                  )}
                </p>
              </div>
            </div>
          )}
        </section>

        {order.fulfillment?.deliveryAddressSnapshot && (
          <section className="mt-5 rounded-[26px] border border-emerald-200 bg-[#eaf9f3] p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                <MapPin
                  size={18}
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Deliver this Host order to
                </p>

                <p className="mt-1 text-base font-black text-stone-950">
                  {order.fulfillment.deliveryAddressSnapshot.recipientName || 'Recipient'}
                  {order.fulfillment.deliveryAddressSnapshot.phone
                    ? ` · ${order.fulfillment.deliveryAddressSnapshot.phone}`
                    : ''}
                </p>

                <p className="mt-1 max-w-5xl text-sm font-semibold leading-6 text-stone-600">
                  {formatDeliveryAddress(
                    order.fulfillment.deliveryAddressSnapshot,
                  )}
                </p>

                {order.fulfillment.deliveryAddressSnapshot.deliveryInstructions && (
                  <p className="mt-2 text-xs font-semibold text-stone-500">
                    Delivery note: {order.fulfillment.deliveryAddressSnapshot.deliveryInstructions}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-sm">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />
            <span>
              {error}
            </span>
          </div>
        )}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <article className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_12px_35px_rgba(28,25,23,0.05)]">
            <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4 sm:px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ShieldCheck
                  size={19}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Customer promise
                </p>
                <h2 className="mt-0.5 text-lg font-black text-stone-950">
                  Captured checkout promise
                </h2>
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                <div className="flex items-center gap-2 text-stone-700">
                  <XCircle
                    size={17}
                  />
                  <p className="text-[11px] font-black uppercase tracking-[0.14em]">
                    Cancellation
                  </p>
                </div>

                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {data?.promise
                    ?.cancellationPolicySummary ||
                    'Not captured'}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                <div className="flex items-center gap-2 text-sky-700">
                  <RotateCcw
                    size={17}
                  />
                  <p className="text-[11px] font-black uppercase tracking-[0.14em]">
                    Returns
                  </p>
                </div>

                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {data?.promise
                    ?.returnPolicySummary ||
                    'Not captured'}
                </p>
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_12px_35px_rgba(28,25,23,0.05)]">
            <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <PackageCheck
                    size={19}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">
                    Order contents
                  </p>
                  <h2 className="mt-0.5 text-lg font-black text-stone-950">
                    Items
                  </h2>
                </div>
              </div>

              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-600">
                {itemCount} packs
              </span>
            </div>

            <div className="space-y-3 p-5 sm:p-6">
              {(order.items || []).length ===
              0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                  No order items are available.
                </div>
              ) : (
                (order.items || []).map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={`${item.offerId}-${item.cartItemId}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-gradient-to-r from-white to-stone-50 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-sm font-black text-white">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
                            Product
                          </p>
                          <p className="mt-1 truncate text-sm font-black text-stone-900">
                            {item.displayName ||
                              'Product name unavailable'}
                          </p>
                          <p className="mt-1 truncate text-[10px] font-semibold text-stone-400">
                            Offer ref {String(
                              item.offerId ||
                                '—',
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          Quantity
                        </p>
                        <p className="mt-0.5 text-sm font-black text-emerald-950">
                          {item.packCount} packs
                        </p>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </article>
        </section>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_12px_35px_rgba(28,25,23,0.05)]">
          <div className="flex flex-col justify-between gap-3 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <FileCheck2
                  size={19}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                  Audit trail
                </p>
                <h2 className="mt-0.5 text-lg font-black text-stone-950">
                  Append-only status timeline
                </h2>
              </div>
            </div>

            <span className="w-fit rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-600">
              {(data?.timeline || []).length} updates
            </span>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-[22px] border border-stone-200 bg-[#fbfaf7] p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">
                Fulfilment progress
              </p>

              <div className="mt-5 space-y-0">
                {PRIMARY_FLOW.map(
                  (
                    step,
                    index,
                  ) => {
                    const state =
                      findStepState(
                        order.status,
                        step.key,
                      )
                    const Icon =
                      step.icon

                    return (
                      <div
                        key={
                          step.key
                        }
                        className="relative flex gap-4 pb-6 last:pb-0"
                      >
                        {index <
                          PRIMARY_FLOW.length -
                            1 && (
                          <div
                            className={`absolute left-[17px] top-9 h-[calc(100%-22px)] w-0.5 ${
                              state ===
                                'complete'
                                ? 'bg-emerald-300'
                                : 'bg-stone-200'
                            }`}
                          />
                        )}

                        <div
                          className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                            state ===
                            'complete'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : state ===
                                  'current'
                                ? 'border-amber-500 bg-white text-amber-600 shadow-[0_0_0_5px_rgba(245,158,11,0.12)]'
                                : 'border-stone-300 bg-white text-stone-400'
                          }`}
                        >
                          {state ===
                          'complete' ? (
                            <Check
                              size={16}
                              strokeWidth={3}
                            />
                          ) : (
                            <Icon
                              size={15}
                            />
                          )}
                        </div>

                        <div className="min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`text-sm font-black ${
                                state ===
                                'pending'
                                  ? 'text-stone-400'
                                  : 'text-stone-900'
                              }`}
                            >
                              {step.label}
                            </p>

                            {state ===
                              'current' && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">
                                Current
                              </span>
                            )}
                          </div>

                          <p
                            className={`mt-1 text-xs leading-5 ${
                              state ===
                              'pending'
                                ? 'text-stone-400'
                                : 'text-stone-500'
                            }`}
                          >
                            {step.description}
                          </p>
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">
                Recorded updates
              </p>

              <div className="mt-4 space-y-3">
                {(data?.timeline || [])
                  .length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                    No Host status events yet.
                  </div>
                ) : (
                  data.timeline.map(
                    (
                      event,
                      index,
                    ) => (
                      <div
                        key={
                          event.id
                        }
                        className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                          <CheckCircle2
                            size={18}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-black text-stone-950">
                              {label(
                                event.fromStatus,
                              )}{' '}
                              <span className="text-stone-300">
                                →
                              </span>{' '}
                              {label(
                                event.toStatus,
                              )}
                            </p>

                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                              Update {index + 1}
                            </span>
                          </div>

                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-500">
                            <Clock3
                              size={13}
                            />
                            {formatDateTime(
                              event.occurredAt,
                            ) ||
                              'Time unavailable'}
                          </p>
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
