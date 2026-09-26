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

function mobilePolicySummary(
  value,
  type,
) {
  const text = String(
    value ||
      '',
  ).trim()

  if (
    !text
  ) {
    return 'Not captured'
  }

  if (
    type ===
      'cancellation' &&
    text ===
      'Orders may be cancelled before packing begins. Once dispatched, cancellation is not available.'
  ) {
    return 'Cancel before packing. After dispatch, cancellation is no longer available.'
  }

  if (
    type ===
      'returns' &&
    text ===
      'Damaged, incorrect, or missing items may be reported within 24 hours of delivery for review and eligible resolution.'
  ) {
    return 'Damaged, wrong or missing items can be reported within 24 hours of delivery.'
  }

  return text
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
              'Unable to load this order.',
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
          'Unable to update this order.',
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
      <main className="min-h-screen bg-[#f7f5ef] px-2 py-0 sm:px-4 sm:py-0">
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
    <main className="min-h-screen bg-[#f7f5ef] px-2 py-0 sm:px-4 sm:py-0">
      <div className="w-full">
        <Link
          to="/host/orders"
          className="inline-flex items-center gap-1.5 pt-2 text-[11px] font-black text-stone-600 transition hover:text-emerald-700 sm:pt-3 sm:text-sm"
        >
          <ArrowLeft
            size={17}
          />

          Back to Orders
        </Link>

        <section className="mt-2 overflow-hidden rounded-[20px] border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(28,25,23,0.055)] sm:mt-3 sm:rounded-[28px]">
          <div className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-[#eaf8f3] via-white to-[#edf7fd] px-3 py-3 sm:px-6 sm:py-5">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl" />

            <div className="relative flex flex-col justify-between gap-3 sm:gap-4 lg:flex-row lg:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-emerald-800 shadow-sm backdrop-blur">
                  <Store
                    size={16}
                  />

                  <span className="text-[9px] font-black uppercase tracking-[0.16em] sm:text-[11px]">
                    Order details
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
                  <div className="min-w-0">
                    <h1 className="text-[22px] font-black leading-[1.08] tracking-[-0.03em] text-stone-950 sm:text-[34px]">
                      {orderDisplayName(
                        order,
                      )}
                    </h1>

                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-stone-400 sm:text-[11px] sm:tracking-[0.14em]">
                      Order reference {shortOrderId}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black sm:px-3 sm:py-1.5 sm:text-xs ${statusTone(
                      order.status,
                    )}`}
                  >
                    {label(
                      order.status,
                    )}
                  </span>
                </div>

                <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
                  <span className="line-clamp-2 sm:hidden">
                    Review the order, confirm delivery, and update its status until it reaches the customer.
                  </span>
                  <span className="hidden sm:inline">
                    Check what the customer ordered, confirm delivery details, then keep the order status updated as you prepare and send it.
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={
                  load
                }
                className="inline-flex h-fit items-center justify-center gap-1.5 self-start rounded-xl border border-emerald-200 bg-white/90 px-3 py-2 text-[11px] font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
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

            <div className="relative mt-3 grid grid-cols-2 gap-2 sm:mt-4 lg:grid-cols-4 lg:gap-3">
              <div className="rounded-[14px] border border-emerald-100 bg-[#eaf8f3] p-2.5 sm:rounded-[18px] sm:p-3.5">
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-700 text-[9px] font-black text-white sm:h-7 sm:w-7 sm:text-[10px]">01</div>
                  <ShoppingBag size={15} className="text-emerald-700" />
                </div>
                <p className="mt-2 text-[11px] font-black text-stone-950 sm:text-[13px]">Review the order</p>
                <p className="mt-0.5 text-[9px] font-medium leading-4 text-stone-500 sm:text-[11px]">Check items, quantity and the customer details.</p>
              </div>

              <div className="rounded-[14px] border border-sky-100 bg-[#edf7fd] p-2.5 sm:rounded-[18px] sm:p-3.5">
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-600 text-[9px] font-black text-white sm:h-7 sm:w-7 sm:text-[10px]">02</div>
                  <MapPin size={15} className="text-sky-700" />
                </div>
                <p className="mt-2 text-[11px] font-black text-stone-950 sm:text-[13px]">Confirm delivery</p>
                <p className="mt-0.5 text-[9px] font-medium leading-4 text-stone-500 sm:text-[11px]">Review the address and customer policy notes.</p>
              </div>

              <div className="rounded-[14px] border border-violet-100 bg-[#f3efff] p-2.5 sm:rounded-[18px] sm:p-3.5">
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-600 text-[9px] font-black text-white sm:h-7 sm:w-7 sm:text-[10px]">03</div>
                  <Save size={15} className="text-violet-700" />
                </div>
                <p className="mt-2 text-[11px] font-black text-stone-950 sm:text-[13px]">Update the status</p>
                <p className="mt-0.5 text-[9px] font-medium leading-4 text-stone-500 sm:text-[11px]">Move the order to the next stage as work happens.</p>
              </div>

              <Link
                to="/host/fulfillment"
                className="rounded-[14px] border border-emerald-100 bg-[#eef9f5] p-2.5 transition hover:border-emerald-200 hover:bg-[#e6f6ef] sm:rounded-[18px] sm:p-3.5"
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-700 text-[9px] font-black text-white sm:h-7 sm:w-7 sm:text-[10px]">04</div>
                  <Truck size={15} className="text-emerald-700" />
                </div>
                <p className="mt-2 text-[11px] font-black text-stone-950 sm:text-[13px]">Continue to Fulfillment</p>
                <p className="mt-0.5 text-[9px] font-medium leading-4 text-stone-500 sm:text-[11px]">Use Fulfillment to manage dispatch and delivery.</p>
              </Link>
            </div>

            <div className="relative mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
              <div className="rounded-[14px] border border-white/80 bg-white/80 p-2.5 shadow-sm backdrop-blur sm:rounded-2xl sm:p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-500 sm:text-[10px] sm:tracking-[0.16em]">
                  Current status
                </p>
                <p className="mt-1 text-[12px] font-black text-stone-950 sm:text-base">
                  {label(
                    order.status,
                  )}
                </p>
              </div>

              <div className="rounded-[14px] border border-white/80 bg-white/80 p-2.5 shadow-sm backdrop-blur sm:rounded-2xl sm:p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-500 sm:text-[10px] sm:tracking-[0.16em]">
                  Total packs
                </p>
                <p className="mt-1 text-[12px] font-black text-stone-950 sm:text-base">
                  {itemCount}
                </p>
              </div>

              <div className="rounded-[14px] border border-white/80 bg-white/80 p-2.5 shadow-sm backdrop-blur sm:rounded-2xl sm:p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-500 sm:text-[10px] sm:tracking-[0.16em]">
                  Status updates
                </p>
                <p className="mt-1 text-[12px] font-black text-stone-950 sm:text-base">
                  {(data?.timeline || []).length}
                </p>
              </div>
            </div>
          </div>

          {allowed.length >
            0 ? (
            <div className="grid gap-2.5 px-3 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ChevronRight
                      size={18}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">
                      Update order status
                    </p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      Choose the next real stage for this order.
                    </p>
                  </div>
                </div>

                <label className="mt-4 block text-xs font-black uppercase tracking-[0.08em] text-stone-500">
                  Next status

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
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[12px] font-black text-stone-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-sm"
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
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-[12px] font-black text-white shadow-[0_10px_25px_rgba(4,120,87,0.18)] transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
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
                    ? 'This order is complete. No more status updates are needed.'
                    : 'No status update is available right now.'}
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
          <section className="mt-2.5 rounded-[18px] border border-emerald-200 bg-[#eaf8f3] p-2.5 shadow-sm sm:mt-5 sm:rounded-[24px] sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                <MapPin
                  size={18}
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Delivery address
                </p>

                <p className="mt-1 text-[12px] font-black text-stone-950 sm:text-base">
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

        <section className="mt-2.5 grid gap-2.5 sm:mt-5 sm:gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <article className="overflow-hidden rounded-[18px] border border-stone-200 bg-white shadow-[0_10px_28px_rgba(28,25,23,0.045)] sm:rounded-[26px] sm:shadow-[0_12px_35px_rgba(28,25,23,0.05)]">
            <div className="flex items-center gap-2.5 border-b border-stone-100 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ShieldCheck
                  size={19}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Customer policies
                </p>
                <h2 className="mt-0.5 text-lg font-black text-stone-950">
                  Cancellation & return terms
                </h2>
              </div>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 sm:gap-3 sm:p-6">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3 sm:p-4">
                <div className="flex items-center gap-2 text-stone-700">
                  <XCircle
                    size={17}
                  />
                  <p className="text-[11px] font-black uppercase tracking-[0.14em]">
                    Cancellation
                  </p>
                </div>

                <p className="mt-1.5 text-[11px] leading-5 text-stone-600 sm:mt-3 sm:text-sm sm:leading-6">
                  <span className="line-clamp-2 sm:hidden">
                    {mobilePolicySummary(
                      data?.promise
                        ?.cancellationPolicySummary,
                      'cancellation',
                    )}
                  </span>
                  <span className="hidden sm:inline">
                    {data?.promise
                      ?.cancellationPolicySummary ||
                      'Not captured'}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3 sm:p-4">
                <div className="flex items-center gap-2 text-sky-700">
                  <RotateCcw
                    size={17}
                  />
                  <p className="text-[11px] font-black uppercase tracking-[0.14em]">
                    Returns
                  </p>
                </div>

                <p className="mt-1.5 text-[11px] leading-5 text-stone-600 sm:mt-3 sm:text-sm sm:leading-6">
                  <span className="line-clamp-2 sm:hidden">
                    {mobilePolicySummary(
                      data?.promise
                        ?.returnPolicySummary,
                      'returns',
                    )}
                  </span>
                  <span className="hidden sm:inline">
                    {data?.promise
                      ?.returnPolicySummary ||
                      'Not captured'}
                  </span>
                </p>
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-[18px] border border-stone-200 bg-white shadow-[0_10px_28px_rgba(28,25,23,0.045)] sm:rounded-[26px] sm:shadow-[0_12px_35px_rgba(28,25,23,0.05)]">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <PackageCheck
                    size={19}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">
                    What customer ordered
                  </p>
                  <h2 className="mt-0.5 text-lg font-black text-stone-950">
                    Order items
                  </h2>
                </div>
              </div>

              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-600">
                {itemCount} packs
              </span>
            </div>

            <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-6">
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
                            Listing ref {String(
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

        <section className="mt-3 overflow-hidden rounded-[18px] border border-stone-200 bg-white shadow-[0_10px_28px_rgba(28,25,23,0.045)] sm:mt-5 sm:rounded-[28px] sm:shadow-[0_12px_35px_rgba(28,25,23,0.05)]">
          <div className="flex flex-col justify-between gap-2 border-b border-stone-100 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <FileCheck2
                  size={19}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">
                  Order progress
                </p>
                <h2 className="mt-0.5 text-lg font-black text-stone-950">
                  Status history
                </h2>
              </div>
            </div>

            <span className="w-fit rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-600">
              {(data?.timeline || []).length} updates
            </span>
          </div>

          <div className="grid gap-4 p-3 sm:gap-6 sm:p-6 xl:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-[16px] border border-stone-200 bg-[#fbfaf7] p-3 sm:rounded-[22px] sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">
                Delivery progress
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
                                ? 'border-sky-500 bg-white text-sky-600 shadow-[0_0_0_5px_rgba(14,165,233,0.10)]'
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
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-sky-800">
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

            <div className="hidden sm:block">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">
                Status updates
              </p>

              <div className="mt-4 space-y-3">
                {(data?.timeline || [])
                  .length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                    No status updates yet.
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
