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
  X,
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
        'group block w-full min-w-0 max-w-full overflow-hidden rounded-[18px] sm:overflow-visible border p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-[24px] sm:p-5',
        visual.cardClass,
      ].join(
        ' ',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2.5 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 overflow-hidden sm:gap-3.5 sm:overflow-visible">
          <div
            className={[
              'grid size-9 shrink-0 place-items-center rounded-[13px] sm:size-11 sm:rounded-2xl',
              visual.iconClass,
            ].join(
              ' ',
            )}
          >
            <StatusIcon
              size={17}
              className="sm:h-[19px] sm:w-[19px]"
            />
          </div>

          <div className="min-w-0 flex-1 overflow-hidden sm:overflow-visible">
            <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <div className="w-full min-w-0 max-w-full sm:w-auto sm:max-w-none">
                <h3 className="block max-w-full whitespace-normal break-words text-[13px] font-black leading-4 text-stone-950 sm:truncate sm:whitespace-nowrap sm:text-lg sm:leading-normal">
                  {orderDisplayName(
                    order,
                  )}
                </h3>

                <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
                  Order ref {shortOrderId(
                    order.id,
                  )}
                </p>
              </div>

              <span
                className={[
                  'inline-flex max-w-full rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.1em]',
                  visual.badgeClass,
                ].join(
                  ' ',
                )}
              >
                {visual.badge}
              </span>
            </div>

            <div className="mt-1.5 flex min-w-0 max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] font-semibold text-stone-500 sm:mt-2 sm:gap-x-4 sm:gap-y-1.5 sm:text-xs">
              <span className="inline-flex items-center gap-1">
                <PackageOpen
                  size={12}
                  className="sm:h-[14px] sm:w-[14px]"
                />

                {order.itemCount ||
                  0}{' '}
                {order.itemCount ===
                1
                  ? 'item'
                  : 'items'}
              </span>

              <span className="inline-flex items-center gap-1">
                <Clock3
                  size={12}
                  className="sm:h-[14px] sm:w-[14px]"
                />

                {formatDateTime(
                  order.createdAt,
                )}
              </span>

              {total ? (
                <span className="inline-flex items-center gap-0.5 font-black text-stone-700 sm:gap-1">
                  <IndianRupee
                    size={11}
                    className="sm:h-[13px] sm:w-[13px]"
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

        <div className="grid size-8 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 transition group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-800 sm:size-9">
          <ArrowRight
            size={14}
            className="sm:h-4 sm:w-4"
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
  enableViewAll =
    false,
}) {
  const [
    showAll,
    setShowAll,
  ] =
    useState(
      false,
    )

  const toneClass =
    tone ===
    'amber'
      ? 'bg-amber-50/80 text-amber-900'
      : tone ===
          'sky'
        ? 'bg-sky-50/80 text-sky-900'
        : 'bg-emerald-50/80 text-emerald-900'

  const visibleOrders =
    enableViewAll
      ? orders.slice(
          0,
          10,
        )
      : orders

  return (
    <>
      <section className="w-full min-w-0 max-w-full overflow-hidden rounded-[20px] sm:overflow-visible border border-stone-200/80 bg-white/92 p-3 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <h2 className="text-[15px] font-black leading-5 text-stone-950 sm:text-xl sm:leading-normal">
                {title}
              </h2>

              <span
                className={[
                  'grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[9px] font-black sm:min-w-7 sm:px-2 sm:py-1 sm:text-xs',
                  toneClass,
                ].join(
                  ' ',
                )}
              >
                {orders.length}
              </span>
            </div>

            <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-sm sm:font-medium sm:leading-normal">
              {description}
            </p>
          </div>
        </div>

        {orders.length ===
        0 ? (
          <div className="mt-3 rounded-[16px] border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-center text-[10px] font-semibold text-stone-500 sm:mt-4 sm:rounded-2xl sm:px-5 sm:py-7 sm:text-sm">
            {emptyText}
          </div>
        ) : (
          <div className="mt-3 grid w-full min-w-0 max-w-full gap-2.5 sm:mt-4 sm:gap-3 xl:grid-cols-2">
            {visibleOrders.map(
              (
                order,
                index,
              ) => (
                <div
                  key={
                    order.id
                  }
                  className={[
                    'min-w-0 max-w-full',
                    enableViewAll &&
                    index >= 4
                      ? 'hidden sm:block'
                      : '',
                  ].filter(Boolean).join(' ')}
                >
                  <OrderCard
                    order={
                      order
                    }
                  />
                </div>
              ),
            )}
          </div>
        )}

        {enableViewAll &&
        orders.length > 4 ? (
          <div
            className={
              orders.length > 10
                ? 'mt-3 flex justify-end sm:mt-4'
                : 'mt-3 flex justify-end sm:hidden'
            }
          >
            <button
              type="button"
              onClick={() =>
                setShowAll(
                  true,
                )
              }
              className="inline-flex items-center justify-center rounded-[12px] border border-stone-200 bg-white px-3 py-2 text-[10px] font-black text-stone-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:hidden"
            >
              View all {orders.length}
            </button>

            {orders.length > 10 ? (
              <button
                type="button"
                onClick={() =>
                  setShowAll(
                    true,
                  )
                }
                className="hidden items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-black text-stone-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:inline-flex"
              >
                View all {orders.length}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {showAll ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-stone-950/35 backdrop-blur-md" />

          <div className="relative z-10 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white/82 shadow-[0_28px_90px_rgba(28,25,23,0.24)] backdrop-blur-2xl sm:rounded-[30px]">
            <div className="flex items-start justify-between gap-3 border-b border-white/70 bg-white/65 px-4 py-3.5 sm:px-6 sm:py-5">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700 sm:text-[10px] sm:tracking-[0.16em]">
                  Order history
                </p>

                <h3 className="mt-0.5 text-[18px] font-black text-stone-950 sm:mt-1 sm:text-2xl">
                  All {title}
                </h3>

                <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:mt-1 sm:text-xs">
                  {orders.length} orders in this section
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAll(
                    false,
                  )
                }
                className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white/90 text-stone-600 shadow-sm transition hover:bg-stone-100 sm:size-10"
                aria-label={`Close all ${title}`}
              >
                <X
                  size={17}
                />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2">
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
            </div>
          </div>
        </div>
      ) : null}
    </>
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
            firstOrderResult,
            policyResult,
          ] =
            await Promise.all([
              listHostOrders({
                page:
                  1,

                limit:
                  50,
              }),

              getHostCommercePolicy(),
            ])

          const allOrders = [
            ...(firstOrderResult?.orders || []),
          ]

          const orderPages =
            Math.max(
              1,
              Number(
                firstOrderResult?.pagination?.pages,
              ) || 1,
            )

          for (
            let pageNumber = 2;
            pageNumber <= orderPages;
            pageNumber += 1
          ) {
            const nextOrderResult =
              await listHostOrders({
                page:
                  pageNumber,

                limit:
                  50,
              })

            allOrders.push(
              ...(nextOrderResult?.orders || []),
            )
          }

          setOrders(
            allOrders,
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
        'Checkout settings saved.',
      )
    } catch (
      saveError
    ) {
      setError(
        getCommerceErrorMessage(
          saveError,
          'Unable to save checkout settings.',
        ),
      )
    } finally {
      setSaving(
        false,
      )
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1">
      <section className="overflow-hidden rounded-[18px] border border-emerald-100 bg-gradient-to-br from-[#e8f4ee] via-[#edf6f3] to-[#e9f1f7] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[#276454] sm:gap-2">
              <ShoppingBag
                size={14}
                className="sm:h-[18px] sm:w-[18px]"
              />

              <p className="text-[8px] font-black uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.16em]">
                Order workspace
              </p>
            </div>

            <h1 className="mt-1 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:text-[32px] sm:leading-[38px]">
              Orders
            </h1>

            <p className="mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/75 sm:mt-1.5 sm:text-[13px] sm:leading-5">
              See new orders, move each one through fulfilment, and keep customer promises up to date.
            </p>
          </div>

          <button
            type="button"
            onClick={
              load
            }
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-[10px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
          >
            <RefreshCw
              size={13}
              className={
                loading
                  ? 'animate-spin sm:h-4 sm:w-4'
                  : 'sm:h-4 sm:w-4'
              }
            />

            Refresh
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
          {[
            {
              step: '01',
              title: 'Review new orders',
              helper: 'Open paid orders that need your first action.',
              tone: 'bg-[#e8f1f8] border-[#d6e7f2]',
            },
            {
              step: '02',
              title: 'Prepare & update',
              helper: 'Use the order page to move packing and dispatch forward.',
              tone: 'bg-[#e7f3ed] border-[#d4eadf]',
            },
            {
              step: '03',
              title: 'Track progress',
              helper: 'Keep every active order updated until it is closed.',
              tone: 'bg-[#f0ebf8] border-[#e4daf3]',
            },
            {
              step: '04',
              title: 'Continue to Fulfillment',
              helper: 'Open Fulfillment for shipping and hand-off work.',
              tone: 'bg-[#e8f4ee] border-[#d4eadf]',
              to: '/host/fulfillment',
            },
          ].map((step) => {
            const content = (
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                  {step.step}
                </span>

                <div className="min-w-0">
                  <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">
                    {step.title}
                  </p>

                  <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">
                    {step.helper}
                  </p>
                </div>
              </div>
            )

            return step.to ? (
              <Link
                key={
                  step.step
                }
                to={
                  step.to
                }
                className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[20px] sm:p-4 ${step.tone}`}
              >
                {content}
              </Link>
            ) : (
              <div
                key={
                  step.step
                }
                className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${step.tone}`}
              >
                {content}
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
          <div className="rounded-[13px] border border-white/80 bg-white/76 px-2.5 py-2 shadow-sm sm:rounded-[18px] sm:px-4 sm:py-3">
            <p className="text-[7px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-[9px] sm:tracking-[0.12em]">
              New orders
            </p>

            <p className="mt-0.5 text-[17px] font-black text-stone-950 sm:mt-1 sm:text-2xl">
              {groupedOrders.newOrders.length}
            </p>
          </div>

          <div className="rounded-[13px] border border-sky-100 bg-[#eef6fb] px-2.5 py-2 shadow-sm sm:rounded-[18px] sm:px-4 sm:py-3">
            <p className="text-[7px] font-black uppercase tracking-[0.1em] text-sky-700 sm:text-[9px] sm:tracking-[0.12em]">
              In progress
            </p>

            <p className="mt-0.5 text-[17px] font-black text-stone-950 sm:mt-1 sm:text-2xl">
              {groupedOrders.inProgress.length}
            </p>
          </div>

          <div className="rounded-[13px] border border-emerald-100 bg-[#edf7f1] px-2.5 py-2 shadow-sm sm:rounded-[18px] sm:px-4 sm:py-3">
            <p className="text-[7px] font-black uppercase tracking-[0.1em] text-emerald-700 sm:text-[9px] sm:tracking-[0.12em]">
              Completed
            </p>

            <p className="mt-0.5 text-[17px] font-black text-stone-950 sm:mt-1 sm:text-2xl">
              {groupedOrders.completed.length}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-3 rounded-[16px] border border-rose-200 bg-rose-50 p-3 text-[10px] font-semibold text-rose-800 sm:mt-4 sm:rounded-2xl sm:p-4 sm:text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-3 rounded-[16px] border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-semibold text-emerald-800 sm:mt-4 sm:rounded-2xl sm:p-4 sm:text-sm">
          {success}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <div className="min-w-0 max-w-full space-y-3 sm:space-y-4">
          {loading ? (
            <div className="h-[280px] animate-pulse rounded-[20px] border border-stone-200 bg-white sm:h-[420px] sm:rounded-[28px]" />
          ) : orders.length ===
            0 ? (
            <section className="rounded-[20px] border border-stone-200 bg-white px-5 py-10 text-center shadow-sm sm:rounded-[28px] sm:px-6 sm:py-16">
              <PackageCheck
                size={28}
                className="mx-auto text-stone-400 sm:h-[34px] sm:w-[34px]"
              />

              <p className="mt-3 text-[15px] font-black text-stone-900 sm:mt-4 sm:text-lg">
                No orders yet
              </p>

              <p className="mt-1 text-[10px] font-semibold text-stone-500 sm:text-sm sm:font-normal">
                Paid customer orders will appear here when they arrive.
              </p>
            </section>
          ) : (
            <>
              <OrderSection
                title="New orders"
                description="Orders that need your first action."
                orders={
                  groupedOrders.newOrders
                }
                emptyText="No new orders are waiting right now."
                tone="amber"
              />

              <OrderSection
                title="In progress"
                description="Orders being prepared, dispatched or waiting for the next update."
                orders={
                  groupedOrders.inProgress
                }
                emptyText="No orders are currently in progress."
                tone="sky"
                enableViewAll
              />

              <OrderSection
                title="Completed"
                description="Delivered, returned or closed orders kept here for reference."
                orders={
                  groupedOrders.completed
                }
                emptyText="No completed orders yet."
                tone="emerald"
                enableViewAll
              />
            </>
          )}
        </div>

        <form
          onSubmit={
            handlePolicySave
          }
          className="h-fit rounded-[20px] border border-[#e4daf3] bg-[#f4f0f8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-5 2xl:sticky 2xl:top-24"
        >
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-white/80 text-[#66548a] shadow-sm sm:size-11 sm:rounded-2xl">
              <PackageCheck
                size={17}
                className="sm:h-5 sm:w-5"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#6d5a92] sm:text-[10px] sm:tracking-[0.13em]">
                Checkout settings
              </p>

              <h2 className="mt-0.5 text-[15px] font-black leading-5 text-stone-950 sm:mt-1 sm:text-xl sm:leading-normal">
                Customer delivery & policies
              </h2>

              <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-600 sm:mt-1 sm:text-xs sm:leading-5">
                Set the delivery fee and policy messages customers see during checkout.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 sm:mt-5 sm:grid-cols-3 sm:gap-3 2xl:grid-cols-1">
            <label className="text-[8px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-xs">
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
                className="mt-1.5 w-full rounded-[11px] border border-white/80 bg-white px-3 py-2 text-[11px] font-black text-stone-900 outline-none transition focus:border-emerald-300 sm:mt-2 sm:rounded-xl sm:py-2.5 sm:text-sm"
              />
            </label>

            <label className="text-[8px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-xs">
              Delivery fee · minor units

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
                className="mt-1.5 w-full rounded-[11px] border border-white/80 bg-white px-3 py-2 text-[11px] font-black text-stone-900 outline-none transition focus:border-emerald-300 sm:mt-2 sm:rounded-xl sm:py-2.5 sm:text-sm"
              />
            </label>

            <label className="text-[8px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-xs">
              Free delivery from · minor units

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
                className="mt-1.5 w-full rounded-[11px] border border-white/80 bg-white px-3 py-2 text-[11px] font-black text-stone-900 outline-none transition focus:border-emerald-300 sm:mt-2 sm:rounded-xl sm:py-2.5 sm:text-sm"
              />
            </label>
          </div>

          <p className="mt-1.5 text-[8px] font-semibold text-stone-500 sm:text-[10px]">
            For INR, 100 minor units = ₹1.
          </p>

          <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3">
            <label className="text-[8px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-xs">
              Cancellation message

              <textarea
                rows="3"
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
                className="mt-1.5 w-full resize-none rounded-[11px] border border-white/80 bg-white p-3 text-[10px] leading-4 text-stone-700 outline-none transition focus:border-emerald-300 sm:mt-2 sm:rounded-xl sm:text-sm sm:leading-6"
              />
            </label>

            <label className="text-[8px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-xs">
              Return message

              <textarea
                rows="3"
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
                className="mt-1.5 w-full resize-none rounded-[11px] border border-white/80 bg-white p-3 text-[10px] leading-4 text-stone-700 outline-none transition focus:border-emerald-300 sm:mt-2 sm:rounded-xl sm:text-sm sm:leading-6"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={
              saving
            }
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-emerald-800 px-4 py-2.5 text-[10px] font-black text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60 sm:mt-4 sm:gap-2 sm:rounded-2xl sm:py-3 sm:text-sm"
          >
            <Save
              size={14}
              className="sm:h-4 sm:w-4"
            />

            {
              saving
                ? 'Saving…'
                : 'Save checkout settings'
            }
          </button>
        </form>
      </div>
    </main>
  )
}
