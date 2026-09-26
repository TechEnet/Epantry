import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowRight,
  PackageCheck,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  getCommerceErrorMessage,
  listHostOrders,
} from '../../commerce/services/commerce.service'

const FULFILLMENT_STATUSES =
  new Set([
    'seller_accepted',
    'picking',
    'packed',
    'carrier_handoff',
    'out_for_delivery',
    'delivery_failed',
    'return_requested',
    'returned',
  ])

function label(value) {
  return String(
    value ||
      'unknown',
  )
    .split('_')
    .map(
      (token) =>
        `${token
          .charAt(0)
          .toUpperCase()}${token.slice(1)}`,
    )
    .join(' ')
}

function shortOrderId(value) {
  return String(
    value ||
      '',
  )
    .slice(-8)
    .toUpperCase()
}

function fulfillmentVisual(status) {
  if (
    status ===
      'delivery_failed' ||
    status ===
      'return_requested'
  ) {
    return {
      badgeClass:
        'border-rose-200 bg-rose-50 text-rose-700',
      iconClass:
        'bg-rose-100 text-rose-700',
    }
  }

  if (
    status ===
      'carrier_handoff' ||
    status ===
      'out_for_delivery'
  ) {
    return {
      badgeClass:
        'border-sky-200 bg-sky-50 text-sky-700',
      iconClass:
        'bg-sky-100 text-sky-700',
    }
  }

  if (
    status ===
      'packed' ||
    status ===
      'returned'
  ) {
    return {
      badgeClass:
        'border-violet-200 bg-violet-50 text-violet-700',
      iconClass:
        'bg-violet-100 text-violet-700',
    }
  }

  return {
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-700',
    iconClass:
      'bg-emerald-100 text-emerald-700',
  }
}

function FulfillmentOrderCard({
  order,
}) {
  const visual =
    fulfillmentVisual(
      order.status,
    )

  return (
    <Link
      to={`/host/orders/${encodeURIComponent(order.id)}`}
      className="focus-ring flex min-w-0 items-center gap-3 rounded-[16px] border border-stone-200 bg-white px-3 py-3 shadow-[0_5px_16px_rgba(28,25,23,0.04)] transition hover:border-emerald-200 hover:bg-emerald-50/35 sm:gap-4 sm:rounded-[20px] sm:px-4 sm:py-4"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-[12px] sm:size-10 sm:rounded-[14px] ${visual.iconClass}`}
      >
        <PackageCheck
          size={16}
          className="sm:h-[18px] sm:w-[18px]"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="min-w-0 text-[11px] font-black leading-[14px] text-stone-950 sm:text-sm sm:leading-5">
            Order {shortOrderId(order.id)}
          </p>

          <span
            className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] sm:px-2.5 sm:text-[9px] ${visual.badgeClass}`}
          >
            {label(order.status)}
          </span>
        </div>

        <p className="mt-1 truncate text-[8px] font-semibold leading-[11px] text-stone-500 sm:text-[11px] sm:leading-4">
          {label(order.fulfillment?.fulfillmentType || 'fulfillment')} · {order.fulfillment?.pincode || 'Pincode unavailable'}
        </p>
      </div>

      <ArrowRight
        size={15}
        className="shrink-0 text-stone-400 sm:h-[17px] sm:w-[17px]"
      />
    </Link>
  )
}

export default function HostFulfillmentPage() {
  const [
    orders,
    setOrders,
  ] =
    useState([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    showAll,
    setShowAll,
  ] =
    useState(false)

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const firstResult =
            await listHostOrders({
              page:
                1,
              limit:
                50,
            })

          const allOrders = [
            ...(firstResult?.orders || []),
          ]

          const pages =
            Math.max(
              1,
              Number(
                firstResult?.pagination?.pages,
              ) || 1,
            )

          for (
            let pageNumber = 2;
            pageNumber <= pages;
            pageNumber += 1
          ) {
            const nextResult =
              await listHostOrders({
                page:
                  pageNumber,
                limit:
                  50,
              })

            allOrders.push(
              ...(nextResult?.orders || []),
            )
          }

          setOrders(
            allOrders,
          )
        } catch (loadError) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load fulfillment orders.',
            ),
          )
        } finally {
          setLoading(false)
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

  const fulfillmentOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            FULFILLMENT_STATUSES.has(
              order.status,
            ),
        ),
      [
        orders,
      ],
    )

  const visibleOrders =
    fulfillmentOrders.slice(
      0,
      8,
    )

  const hasMobileViewAll =
    fulfillmentOrders.length >
    4

  const hasDesktopViewAll =
    fulfillmentOrders.length >
    8

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1">
      <section className="overflow-hidden rounded-[18px] border border-emerald-100 bg-gradient-to-br from-[#e8f4ee] via-[#edf6f3] to-[#e9f1f7] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[#276454] sm:gap-2">
              <Truck
                size={14}
                className="sm:h-[18px] sm:w-[18px]"
              />

              <p className="text-[8px] font-black uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.16em]">
                Fulfillment workspace
              </p>
            </div>

            <h1 className="mt-1 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:text-[32px] sm:leading-[38px]">
              Fulfillment
            </h1>

            <p className="mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/75 sm:mt-1.5 sm:text-[13px] sm:leading-5">
              See orders that still need packing, hand-off, delivery or return action, then open the order to keep its status current.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
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
              step:
                '01',
              title:
                'Check active orders',
              helper:
                'See what still needs packing, hand-off or delivery work.',
              tone:
                'bg-[#e8f1f8] border-[#d6e7f2]',
            },
            {
              step:
                '02',
              title:
                'Open the order',
              helper:
                'Use the order page to update the next fulfillment status.',
              tone:
                'bg-[#e7f3ed] border-[#d4eadf]',
            },
            {
              step:
                '03',
              title:
                'Keep hand-offs current',
              helper:
                'Update packing, dispatch, delivery or return progress.',
              tone:
                'bg-[#f0ebf8] border-[#e4daf3]',
            },
            {
              step:
                '04',
              title:
                'Review completed sales',
              helper:
                'After delivery closes, continue to Earnings.',
              tone:
                'bg-[#e8f4ee] border-[#d4eadf]',
              to:
                '/host/earnings',
            },
          ].map(
            (step) => {
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
                  key={step.step}
                  to={step.to}
                  className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[20px] sm:p-4 ${step.tone}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.step}
                  className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${step.tone}`}
                >
                  {content}
                </div>
              )
            },
          )}
        </div>

      </section>

      {error ? (
        <div className="mt-3 rounded-[16px] border border-rose-200 bg-rose-50 p-3 text-[10px] font-semibold text-rose-800 sm:mt-4 sm:rounded-2xl sm:p-4 sm:text-sm">
          {error}
        </div>
      ) : null}

      <section className="mt-3 rounded-[18px] border border-sky-100 bg-[#edf5f8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.05)] sm:mt-4 sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-[12px] bg-white/85 text-sky-700 shadow-sm sm:size-10 sm:rounded-[14px]">
                <PackageCheck
                  size={15}
                  className="sm:h-[18px] sm:w-[18px]"
                />
              </span>

              <div className="min-w-0">
                <h2 className="text-[14px] font-black leading-[17px] text-stone-950 sm:text-xl sm:leading-6">
                  Orders to fulfill
                </h2>

                <p className="mt-0.5 text-[8px] font-semibold leading-[11px] text-stone-500 sm:mt-1 sm:text-[11px] sm:leading-4">
                  Open an order to update packing, hand-off, delivery or return progress.
                </p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-3 h-44 animate-pulse rounded-[16px] bg-white/70 sm:mt-4 sm:h-56 sm:rounded-2xl" />
        ) : fulfillmentOrders.length ? (
          <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
            {visibleOrders.map(
              (
                order,
                index,
              ) => (
                <div
                  key={order.id}
                  className={
                    index >= 4
                      ? 'hidden sm:block'
                      : ''
                  }
                >
                  <FulfillmentOrderCard
                    order={order}
                  />
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-dashed border-sky-200 bg-white/70 px-4 py-8 text-center sm:mt-4 sm:rounded-2xl sm:px-5 sm:py-12">
            <Truck
              size={28}
              className="mx-auto text-sky-300 sm:h-[34px] sm:w-[34px]"
            />

            <p className="mt-2 text-[10px] font-black text-stone-700 sm:mt-3 sm:text-sm">
              No orders need fulfillment action right now.
            </p>

            <p className="mt-1 text-[8px] font-semibold text-stone-500 sm:text-[11px]">
              New fulfillment work will appear here as orders move forward.
            </p>
          </div>
        )}

        {fulfillmentOrders.length ? (
          <div
            className={
              hasDesktopViewAll
                ? 'mt-3 flex justify-end sm:mt-4'
                : hasMobileViewAll
                  ? 'mt-3 flex justify-end sm:hidden'
                  : 'hidden'
            }
          >
            {hasMobileViewAll ? (
              <button
                type="button"
                onClick={() =>
                  setShowAll(
                    true,
                  )
                }
                className="inline-flex items-center justify-center rounded-[12px] border border-sky-200 bg-white/90 px-3 py-2 text-[10px] font-black text-sky-800 shadow-sm transition hover:bg-white sm:hidden"
              >
                View all {fulfillmentOrders.length}
              </button>
            ) : null}

            {hasDesktopViewAll ? (
              <button
                type="button"
                onClick={() =>
                  setShowAll(
                    true,
                  )
                }
                className="hidden items-center justify-center rounded-xl border border-sky-200 bg-white/90 px-4 py-2.5 text-xs font-black text-sky-800 shadow-sm transition hover:bg-white sm:inline-flex"
              >
                View all {fulfillmentOrders.length}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {showAll ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-stone-950/35 backdrop-blur-md" />

          <div className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white/82 shadow-[0_28px_90px_rgba(28,25,23,0.24)] backdrop-blur-2xl sm:rounded-[30px]">
            <div className="flex items-start justify-between gap-3 border-b border-white/70 bg-white/65 px-4 py-3.5 sm:px-6 sm:py-5">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700 sm:text-[10px] sm:tracking-[0.16em]">
                  Fulfillment queue
                </p>

                <h3 className="mt-0.5 text-[18px] font-black text-stone-950 sm:mt-1 sm:text-2xl">
                  All orders needing action
                </h3>

                <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:mt-1 sm:text-xs">
                  {fulfillmentOrders.length} orders in this queue
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
                aria-label="Close all fulfillment orders"
              >
                <X
                  size={17}
                />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="space-y-2.5 sm:space-y-3">
                {fulfillmentOrders.map(
                  (order) => (
                    <FulfillmentOrderCard
                      key={order.id}
                      order={order}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
