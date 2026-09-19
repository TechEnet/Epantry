import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ReceiptIndianRupee,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  getCommerceErrorMessage,
  listOrders,
} from '../../commerce/services/commerce.service'

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    !Number.isFinite(
      Number(
        amountMinor,
      ),
    )
  ) {
    return '₹0'
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

function isSameMonth(
  value,
  reference,
) {
  if (!value) {
    return false
  }

  const date =
    new Date(
      value,
    )

  return (
    !Number.isNaN(
      date.getTime(),
    ) &&
    date.getFullYear() ===
      reference.getFullYear() &&
    date.getMonth() ===
      reference.getMonth()
  )
}

function formatOrderDate(
  value,
) {
  if (!value) {
    return 'Date unavailable'
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
    return 'Date unavailable'
  }

  return date.toLocaleString(
    'en-IN',
    {
      day:
        '2-digit',
      month:
        'short',
      year:
        'numeric',
      hour:
        '2-digit',
      minute:
        '2-digit',
    },
  )
}

export default function CustomerSpendingPage() {
  const [
    orders,
    setOrders,
  ] = useState(
    [],
  )

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  )

  const [
    refreshing,
    setRefreshing,
  ] = useState(
    false,
  )

  const [
    error,
    setError,
  ] = useState(
    '',
  )

  const load =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (refresh) {
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
          const firstPage =
            await listOrders({
              page:
                1,
              limit:
                100,
            })

          let nextOrders =
            Array.isArray(
              firstPage?.orders,
            )
              ? [...firstPage.orders]
              : []

          const pages =
            Number(
              firstPage?.pagination
                ?.pages ||
                1,
            )

          if (pages > 1) {
            const remaining =
              await Promise.all(
                Array.from(
                  {
                    length:
                      pages - 1,
                  },
                  (
                    _,
                    index,
                  ) =>
                    listOrders({
                      page:
                        index +
                        2,
                      limit:
                        100,
                    }),
                ),
              )

            nextOrders =
              nextOrders.concat(
                ...remaining.map(
                  (
                    page,
                  ) =>
                    Array.isArray(
                      page?.orders,
                    )
                      ? page.orders
                      : [],
                ),
              )
          }

          setOrders(
            nextOrders,
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load your payment history.',
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

  const summary =
    useMemo(
      () => {
        const now =
          new Date()

        const paidOrders =
          orders.filter(
            (
              order,
            ) =>
              order?.paymentStatus ===
                'paid' &&
              isSameMonth(
                order?.createdAt,
                now,
              ),
          )

        const amountMinor =
          paidOrders.reduce(
            (
              total,
              order,
            ) =>
              total +
              Number(
                order?.totals
                  ?.totalLandedCostMinor ||
                  0,
              ),
            0,
          )

        const currency =
          paidOrders.find(
            (
              order,
            ) =>
              order?.totals
                ?.currency,
          )?.totals
            ?.currency ||
          'INR'

        return {
          paidOrders,
          amountMinor,
          currency,
          monthLabel:
            now.toLocaleDateString(
              'en-IN',
              {
                month:
                  'long',
                year:
                  'numeric',
              },
            ),
        }
      },
      [
        orders,
      ],
    )

  return (
    <main className="p-4 sm:p-6 lg:p-7">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="focus-ring inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-black text-stone-600 transition hover:text-emerald-800"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Dashboard
          </Link>

          <button
            type="button"
            onClick={() =>
              load({
                refresh:
                  true,
              })
            }
            disabled={refreshing}
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-black text-stone-700 shadow-sm transition hover:border-emerald-200 disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#043f33] via-[#075d49] to-[#0b765c] p-6 text-white shadow-[0_24px_70px_-42px_rgba(4,63,51,0.9)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-white/10 bg-white/5" />
          <div className="pointer-events-none absolute -bottom-28 right-40 size-60 rounded-full bg-emerald-100/10 blur-2xl" />

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-emerald-100">
                <ReceiptIndianRupee size={20} aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                  Customer payments
                </p>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Your monthly spending
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/75">
                A simple view of EPANTRY orders that are currently recorded as paid for this month.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm sm:min-w-56">
              <div className="flex items-center gap-2 text-emerald-100/80">
                <CalendarDays size={15} aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em]">
                  {summary.monthLabel}
                </p>
              </div>
              <p className="mt-2 text-3xl font-black tracking-tight">
                {loading
                  ? '—'
                  : formatMoney(
                      summary.amountMinor,
                      summary.currency,
                    )}
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-100/75">
                {loading
                  ? 'Loading paid orders…'
                  : `${summary.paidOrders.length} paid ${summary.paidOrders.length === 1 ? 'order' : 'orders'}`}
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        ) : null}

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                Payment activity
              </p>
              <h2 className="mt-1 text-xl font-black text-stone-950 sm:text-2xl">
                Paid orders this month
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 grid gap-3">
              {[1, 2, 3].map(
                (
                  item,
                ) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse rounded-[24px] border border-stone-200 bg-white"
                  />
                ),
              )}
            </div>
          ) : summary.paidOrders.length === 0 ? (
            <div className="mt-4 rounded-[26px] border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShoppingBag size={21} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-black text-stone-950">
                No paid orders this month
              </h3>
              <p className="mt-2 text-sm text-stone-500">
                Paid EPANTRY orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {summary.paidOrders.map(
                (
                  order,
                ) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="focus-ring group grid gap-4 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-stone-950">
                          Order {String(order.id || '').slice(-8).toUpperCase()}
                        </p>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800">
                          Paid
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-stone-500">
                        {formatOrderDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <p className="text-lg font-black text-stone-950">
                        {formatMoney(
                          order?.totals
                            ?.totalLandedCostMinor,
                          order?.totals
                            ?.currency,
                        )}
                      </p>
                      <ArrowRight
                        size={17}
                        className="text-stone-300 transition group-hover:translate-x-1 group-hover:text-emerald-700"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
