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

function getOrderDisplayTitle(order) {
  const primaryItemName = String(
    order?.primaryItemName ||
      '',
  ).trim()

  const itemCount = Math.max(
    0,
    Number(
      order?.itemCount ||
        0,
    ) || 0,
  )

  if (primaryItemName) {
    return itemCount > 1
      ? `${primaryItemName} + ${itemCount - 1} more`
      : primaryItemName
  }

  return 'EPANTRY order'
}

function getMobileOrderDisplayTitle(order) {
  const primaryItemName = String(
    order?.primaryItemName ||
      '',
  ).trim()

  const itemCount = Math.max(
    0,
    Number(
      order?.itemCount ||
        0,
    ) || 0,
  )

  if (itemCount > 1) {
    return `${itemCount}-item EPANTRY order`
  }

  return primaryItemName || 'EPANTRY order'
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
                50,
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
                        50,
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
    <main className="min-h-full bg-[#f8f5ef]">
      <div className="w-full px-3 pb-5 pt-2 sm:px-5 sm:pb-10 sm:pt-4 lg:px-6 lg:pt-5">
        <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-4 sm:gap-3">
          <Link
            to="/dashboard"
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-black text-[#5f564c] transition hover:bg-white/70 hover:text-[#17483b] sm:gap-2 sm:py-2 sm:text-sm"
          >
            <ArrowLeft size={15} className="sm:h-[17px] sm:w-[17px]" aria-hidden="true" />
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
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[#ded4c6] bg-[#fffdf9] px-2.5 py-1.5 text-[11px] font-black text-[#4f463d] shadow-[0_4px_12px_rgba(74,59,43,0.06)] transition hover:border-[#c9ab78] hover:text-[#17483b] disabled:opacity-60 sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-xs"
          >
            <RefreshCw
              size={13}
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

        <section className="relative overflow-hidden rounded-[22px] border border-[#2e6655]/30 bg-[linear-gradient(135deg,#123e33_0%,#185344_52%,#21644f_100%)] p-3 text-white shadow-[0_24px_55px_-38px_rgba(18,62,51,0.7)] sm:rounded-[30px] sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border border-[#f0d39a]/15 bg-[#f0d39a]/8" />
          <div className="pointer-events-none absolute -bottom-24 right-[28%] size-52 rounded-full bg-[#f1d59f]/8 blur-2xl" />

          <div className="relative grid gap-2 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-[#f1d9a7]">
                <ReceiptIndianRupee size={16} className="sm:h-5 sm:w-5" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                  Spending overview
                </p>
              </div>

              <h1 className="mt-1 text-[21px] font-black leading-none tracking-tight sm:mt-3 sm:text-4xl sm:leading-normal">
                Your monthly spending
              </h1>
              <p className="mt-1 max-w-none whitespace-nowrap text-[9px] font-medium leading-4 tracking-[-0.01em] text-[#e6eee9]/80 sm:mt-2 sm:max-w-2xl sm:whitespace-normal sm:text-sm sm:leading-6">
                Your paid orders this month, with full details one tap away.
              </p>
            </div>

            <div className="rounded-[18px] border border-[#f3d9a6]/20 bg-[#fff8e9]/10 px-3 py-2 backdrop-blur-sm sm:min-w-56 sm:rounded-[24px] sm:px-5 sm:py-4">
              <div className="flex items-center gap-2 text-[#f1d9a7]">
                <CalendarDays size={13} className="sm:h-[15px] sm:w-[15px]" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em]">
                  {summary.monthLabel}
                </p>
              </div>
              <p className="mt-0.5 text-[22px] font-black leading-none tracking-tight text-white sm:mt-2 sm:text-3xl sm:leading-normal">
                {loading
                  ? '—'
                  : formatMoney(
                      summary.amountMinor,
                      summary.currency,
                    )}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold leading-4 text-[#e7efe9]/75 sm:mt-1 sm:text-xs">
                {loading
                  ? 'Loading paid orders…'
                  : `${summary.paidOrders.length} paid ${summary.paidOrders.length === 1 ? 'order' : 'orders'} this month`}
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[#efc7c0] bg-[#fff1ee] px-4 py-3 text-sm font-semibold text-[#9b3f32]">
            {error}
          </div>
        ) : null}

        <section className="mt-4 sm:mt-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d7157]">
              Payment activity
            </p>
            <h2 className="mt-0.5 text-[18px] font-black leading-tight text-[#1f2924] sm:mt-1 sm:text-2xl sm:leading-normal">
              Paid orders this month
            </h2>
          </div>

          {loading ? (
            <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
              {[1, 2, 3].map(
                (
                  item,
                ) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-[20px] border border-[#e6ddd1] bg-[#fffdf9] sm:h-24 sm:rounded-[24px]"
                  />
                ),
              )}
            </div>
          ) : summary.paidOrders.length === 0 ? (
            <div className="mt-3 rounded-[22px] border border-dashed border-[#d9c9b3] bg-[#fffdf9] px-4 py-7 text-center sm:mt-4 sm:rounded-[26px] sm:px-6 sm:py-12">
              <div className="mx-auto grid size-10 place-items-center rounded-xl bg-[#e7f3ed] text-[#1d7157] sm:size-12 sm:rounded-2xl">
                <ShoppingBag size={21} aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-sm font-black text-[#1f2924] sm:mt-4 sm:text-base">
                No paid orders this month
              </h3>
              <p className="mt-1.5 text-xs text-[#756b61] sm:mt-2 sm:text-sm">
                Your paid EPANTRY orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
              {summary.paidOrders.map(
                (
                  order,
                ) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="focus-ring group grid gap-1.5 rounded-[18px] border border-[#e2d8ca] bg-[#fffdf9] p-2.5 shadow-[0_5px_16px_rgba(74,59,43,0.05)] transition hover:-translate-y-0.5 hover:border-[#c9ab78] hover:bg-[#fffaf1] hover:shadow-[0_10px_22px_rgba(74,59,43,0.08)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:rounded-[24px] sm:p-5"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
                        <p className="min-w-0 flex-1 whitespace-nowrap text-[12px] font-black tracking-[-0.01em] text-[#25312b] sm:hidden">
                          {getMobileOrderDisplayTitle(order)}
                        </p>
                        <p className="hidden truncate text-base font-black text-[#25312b] sm:block">
                          {getOrderDisplayTitle(order)}
                        </p>
                        <span className="shrink-0 rounded-full border border-[#b9dbc8] bg-[#e8f5ee] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#176348] sm:px-2.5 sm:py-1 sm:text-[10px]">
                          Paid
                        </span>
                      </div>
                      <p className="mt-0.5 text-[9px] font-semibold leading-4 text-[#7b7065] sm:mt-2 sm:text-xs">
                        {formatOrderDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:gap-4 sm:justify-end">
                      <p className="text-[15px] font-black leading-none text-[#17483b] sm:text-lg">
                        {formatMoney(
                          order?.totals
                            ?.totalLandedCostMinor,
                          order?.totals
                            ?.currency,
                        )}
                      </p>
                      <ArrowRight
                        size={15}
                        className="text-[#b9aa96] transition group-hover:translate-x-1 group-hover:text-[#a77834]"
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
