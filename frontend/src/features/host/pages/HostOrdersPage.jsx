import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  IndianRupee,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Save,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  getCommerceErrorMessage,
  getHostCommercePolicy,
  listHostOrders,
  saveHostCommercePolicy,
} from '../../commerce/services/commerce.service'

const NEW_STATUSES = new Set([
  'confirmed',
])

const COMPLETED_STATUSES = new Set([
  'delivered',
  'returned',
  'refunded',
  'rejected',
  'seller_cancelled',
])

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

function shortOrderId(
  value,
) {
  return String(
    value ||
      '',
  )
    .slice(
      -8,
    )
    .toUpperCase()
}

function orderDisplayName(
  order,
) {
  const names =
    (
      order?.itemNames ||
      []
    )
      .map(
        (
          value,
        ) =>
          String(
            value ||
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
    return `Order ${shortOrderId(
      order?.id,
    )}`
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

function formatDateTime(
  value,
) {
  if (
    !value
  ) {
    return 'Time unavailable'
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
    return 'Time unavailable'
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day:
        '2-digit',
      month:
        'short',
      hour:
        '2-digit',
      minute:
        '2-digit',
    },
  ).format(
    date,
  )
}

function moneyFromMinor(
  value,
  currency =
    'INR',
) {
  const amount =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      amount,
    )
  ) {
    return null
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',
      currency:
        currency ||
        'INR',
      maximumFractionDigits:
        2,
    },
  ).format(
    amount /
      100,
  )
}

function orderVisual(
  status,
) {
  if (
    status ===
    'confirmed'
  ) {
    return {
      badge:
        'New order',
      badgeClass:
        'border-amber-200 bg-amber-50 text-amber-800',
      iconClass:
        'bg-amber-100 text-amber-800',
      cardClass:
        'border-amber-200 bg-gradient-to-r from-amber-50/80 via-white to-white shadow-[0_14px_38px_rgba(146,64,14,0.08)]',
      icon:
        Sparkles,
    }
  }

  if (
    status ===
    'delivered'
  ) {
    return {
      badge:
        'Delivered',
      badgeClass:
        'border-emerald-200 bg-emerald-50 text-emerald-800',
      iconClass:
        'bg-emerald-100 text-emerald-800',
      cardClass:
        'border-emerald-100 bg-white',
      icon:
        CheckCircle2,
    }
  }

  if (
    COMPLETED_STATUSES.has(
      status,
    )
  ) {
    return {
      badge:
        label(
          status,
        ),
      badgeClass:
        'border-stone-200 bg-stone-100 text-stone-700',
      iconClass:
        'bg-stone-100 text-stone-600',
      cardClass:
        'border-stone-200 bg-white',
      icon:
        PackageCheck,
    }
  }

  return {
    badge:
      label(
        status,
      ),
    badgeClass:
      'border-sky-200 bg-sky-50 text-sky-800',
    iconClass:
      'bg-sky-100 text-sky-800',
    cardClass:
      'border-sky-100 bg-white',
    icon:
      Truck,
  }
}

function OrderCard({
  order,
}) {
  const visual =
    orderVisual(
      order.status,
    )

  const StatusIcon =
    visual.icon

  const total =
    moneyFromMinor(
      order?.commercialSnapshot
        ?.totalLandedCostMinor ??
        order?.commercialSnapshot
          ?.itemSubtotalMinor,
      order?.commercialSnapshot
        ?.currency ||
        'INR',
    )

  return (
    <Link
      to={`/host/orders/${order.id}`}
      className={[
        'group block rounded-[24px] border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-5',
        visual.cardClass,
      ].join(
        ' ',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className={[
              'grid size-11 shrink-0 place-items-center rounded-2xl',
              visual.iconClass,
            ].join(
              ' ',
            )}
          >
            <StatusIcon
              size={19}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-stone-950 sm:text-lg">
                  {orderDisplayName(
                    order,
                  )}
                </h3>

                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                  Order ref {shortOrderId(
                    order.id,
                  )}
                </p>
              </div>

              <span
                className={[
                  'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em]',
                  visual.badgeClass,
                ].join(
                  ' ',
                )}
              >
                {visual.badge}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-stone-500">
              <span className="inline-flex items-center gap-1.5">
                <PackageOpen
                  size={14}
                />

                {order.itemCount ||
                  0}{' '}
                {order.itemCount ===
                1
                  ? 'item'
                  : 'items'}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Clock3
                  size={14}
                />

                {formatDateTime(
                  order.createdAt,
                )}
              </span>

              {total ? (
                <span className="inline-flex items-center gap-1 font-black text-stone-700">
                  <IndianRupee
                    size={13}
                  />

                  {total.replace(
                    '₹',
                    '',
                  )}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 transition group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-800">
          <ArrowRight
            size={16}
          />
        </div>
      </div>
    </Link>
  )
}

function OrderSection({
  title,
  description,
  orders,
  emptyText,
  tone =
    'stone',
}) {
  const toneClass =
    tone ===
    'amber'
      ? 'bg-amber-50/70 text-amber-900'
      : tone ===
          'sky'
        ? 'bg-sky-50/70 text-sky-900'
        : 'bg-emerald-50/70 text-emerald-900'

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black text-stone-950 sm:text-xl">
              {title}
            </h2>

            <span
              className={[
                'grid min-w-7 place-items-center rounded-full px-2 py-1 text-xs font-black',
                toneClass,
              ].join(
                ' ',
              )}
            >
              {orders.length}
            </span>
          </div>

          <p className="mt-1 text-xs font-medium text-stone-500 sm:text-sm">
            {description}
          </p>
        </div>
      </div>

      {orders.length ===
      0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-7 text-center text-sm font-semibold text-stone-500">
          {emptyText}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {orders.map(
            (
              order,
            ) => (
              <OrderCard
                key={
                  order.id
                }
                order={
                  order
                }
              />
            ),
          )}
        </div>
      )}
    </section>
  )
}

export default function HostOrdersPage() {
  const [
    orders,
    setOrders,
  ] =
    useState(
      [],
    )

  const [
    policy,
    setPolicy,
  ] =
    useState({
      currency:
        'INR',

      deliveryFeeMinor:
        0,

      freeDeliveryThresholdMinor:
        '',

      cancellationPolicySummary:
        '',

      returnPolicySummary:
        '',
    })

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

  const [
    success,
    setSuccess,
  ] =
    useState(
      '',
    )

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const [
            orderResult,
            policyResult,
          ] =
            await Promise.all([
              listHostOrders({
                page:
                  1,

                limit:
                  40,
              }),

              getHostCommercePolicy(),
            ])

          setOrders(
            orderResult?.orders ||
            [],
          )

          if (
            policyResult?.policy
          ) {
            setPolicy({
              currency:
                policyResult
                  .policy
                  .currency ||
                'INR',

              deliveryFeeMinor:
                policyResult
                  .policy
                  .deliveryFeeMinor ??
                0,

              freeDeliveryThresholdMinor:
                policyResult
                  .policy
                  .freeDeliveryThresholdMinor ??
                '',

              cancellationPolicySummary:
                policyResult
                  .policy
                  .cancellationPolicySummary ||
                '',

              returnPolicySummary:
                policyResult
                  .policy
                  .returnPolicySummary ||
                '',
            })
          }
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load Host Orders.',
            ),
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  const groupedOrders =
    useMemo(
      () => {
        const next = {
          newOrders:
            [],
          inProgress:
            [],
          completed:
            [],
        }

        orders.forEach(
          (
            order,
          ) => {
            if (
              NEW_STATUSES.has(
                order.status,
              )
            ) {
              next.newOrders.push(
                order,
              )
              return
            }

            if (
              COMPLETED_STATUSES.has(
                order.status,
              )
            ) {
              next.completed.push(
                order,
              )
              return
            }

            next.inProgress.push(
              order,
            )
          },
        )

        return next
      },
      [
        orders,
      ],
    )

  async function handlePolicySave(
    event,
  ) {
    event.preventDefault()

    setSaving(
      true,
    )

    setError(
      '',
    )

    setSuccess(
      '',
    )

    try {
      await saveHostCommercePolicy({
        currency:
          policy.currency,

        deliveryFeeMinor:
          Number(
            policy.deliveryFeeMinor,
          ),

        freeDeliveryThresholdMinor:
          policy.freeDeliveryThresholdMinor ===
          ''
            ? null
            : Number(
                policy.freeDeliveryThresholdMinor,
              ),

        cancellationPolicySummary:
          policy
            .cancellationPolicySummary,

        returnPolicySummary:
          policy
            .returnPolicySummary,
      })

      setSuccess(
        'Checkout promise saved.',
      )
    } catch (
      saveError
    ) {
      setError(
        getCommerceErrorMessage(
          saveError,
          'Unable to save Host checkout policy.',
        ),
      )
    } finally {
      setSaving(
        false,
      )
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] p-5 sm:p-7">
      <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-[0_22px_60px_rgba(6,78,59,0.16)]">
        <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-emerald-200">
              <ShoppingBag
                size={18}
              />

              <p className="text-xs font-black uppercase tracking-[0.16em]">
                Host · Orders
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              SellerOrder workspace
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-emerald-50/80">
              SellerOrder is a transaction split. It does not create a separate Seller access type. Host remains Seller + Brand + B2B.
            </p>
          </div>

          <button
            type="button"
            onClick={
              load
            }
            className="inline-flex h-fit items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh orders
          </button>
        </div>

        <div className="grid border-t border-white/10 bg-black/10 sm:grid-cols-3">
          <div className="border-b border-white/10 px-6 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
              New orders
            </p>

            <p className="mt-1 text-2xl font-black">
              {groupedOrders.newOrders.length}
            </p>
          </div>

          <div className="border-b border-white/10 px-6 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-200">
              In progress
            </p>

            <p className="mt-1 text-2xl font-black">
              {groupedOrders.inProgress.length}
            </p>
          </div>

          <div className="px-6 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
              Completed
            </p>

            <p className="mt-1 text-2xl font-black">
              {groupedOrders.completed.length}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      )}

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <div className="space-y-5">
          {loading ? (
            <div className="h-[420px] animate-pulse rounded-[28px] border border-stone-200 bg-white" />
          ) : orders.length ===
            0 ? (
            <section className="rounded-[28px] border border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
              <PackageCheck
                size={34}
                className="mx-auto text-stone-400"
              />

              <p className="mt-4 text-lg font-black text-stone-900">
                No Host Orders yet
              </p>

              <p className="mt-1 text-sm text-stone-500">
                New paid customer orders will appear here.
              </p>
            </section>
          ) : (
            <>
              <OrderSection
                title="New orders"
                description="Paid orders waiting for your first action."
                orders={
                  groupedOrders.newOrders
                }
                emptyText="No new orders are waiting right now."
                tone="amber"
              />

              <OrderSection
                title="In progress"
                description="Orders currently moving through fulfilment."
                orders={
                  groupedOrders.inProgress
                }
                emptyText="No orders are currently in progress."
                tone="sky"
              />

              <OrderSection
                title="Completed"
                description="Delivered or otherwise closed orders stay here for reference."
                orders={
                  groupedOrders.completed
                }
                emptyText="No completed orders yet."
                tone="emerald"
              />
            </>
          )}
        </div>

        <form
          onSubmit={
            handlePolicySave
          }
          className="h-fit rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6 2xl:sticky 2xl:top-24"
        >
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
              <PackageCheck
                size={20}
              />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.13em] text-emerald-700">
                Checkout promise
              </p>

              <h2 className="mt-1 text-xl font-black text-stone-950">
                Delivery & policy settings
              </h2>

              <p className="mt-1 text-xs font-medium leading-5 text-stone-500">
                These values continue to power checkout promises for this Host.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 2xl:grid-cols-1">
            <label className="text-xs font-black uppercase tracking-[0.08em] text-stone-500">
              Currency

              <input
                value={
                  policy.currency
                }
                onChange={(
                  event,
                ) =>
                  setPolicy((
                    current,
                  ) => ({
                    ...current,

                    currency:
                      event.target.value.toUpperCase(),
                  }))
                }
                maxLength="3"
                className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-black text-stone-900 outline-none transition focus:border-emerald-300 focus:bg-white"
              />
            </label>

            <label className="text-xs font-black uppercase tracking-[0.08em] text-stone-500">
              Delivery fee minor

              <input
                type="number"
                min="0"
                step="1"
                value={
                  policy.deliveryFeeMinor
                }
                onChange={(
                  event,
                ) =>
                  setPolicy((
                    current,
                  ) => ({
                    ...current,

                    deliveryFeeMinor:
                      event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-black text-stone-900 outline-none transition focus:border-emerald-300 focus:bg-white"
              />
            </label>

            <label className="text-xs font-black uppercase tracking-[0.08em] text-stone-500">
              Free delivery threshold minor

              <input
                type="number"
                min="0"
                step="1"
                value={
                  policy
                    .freeDeliveryThresholdMinor
                }
                onChange={(
                  event,
                ) =>
                  setPolicy((
                    current,
                  ) => ({
                    ...current,

                    freeDeliveryThresholdMinor:
                      event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-black text-stone-900 outline-none transition focus:border-emerald-300 focus:bg-white"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="text-xs font-black uppercase tracking-[0.08em] text-stone-500">
              Cancellation policy

              <textarea
                rows="4"
                value={
                  policy
                    .cancellationPolicySummary
                }
                onChange={(
                  event,
                ) =>
                  setPolicy((
                    current,
                  ) => ({
                    ...current,

                    cancellationPolicySummary:
                      event.target.value,
                  }))
                }
                className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700 outline-none transition focus:border-emerald-300 focus:bg-white"
              />
            </label>

            <label className="text-xs font-black uppercase tracking-[0.08em] text-stone-500">
              Return policy

              <textarea
                rows="4"
                value={
                  policy
                    .returnPolicySummary
                }
                onChange={(
                  event,
                ) =>
                  setPolicy((
                    current,
                  ) => ({
                    ...current,

                    returnPolicySummary:
                      event.target.value,
                  }))
                }
                className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700 outline-none transition focus:border-emerald-300 focus:bg-white"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={
              saving
            }
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60"
          >
            <Save
              size={16}
            />

            {
              saving
                ? 'Saving…'
                : 'Save checkout promise'
            }
          </button>
        </form>
      </div>
    </main>
  )
}
