import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  ArrowRight,
  PackageCheck,
  RefreshCw,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  getCommerceErrorMessage,
  listOrders,
} from '../services/commerce.service'

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

function formatStatus(
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

const SELLER_STATUS_ORDER = [
  'delivery_failed',
  'seller_cancelled',
  'rejected',
  'partial_unavailable',
  'out_for_delivery',
  'carrier_handoff',
  'packed',
  'picking',
  'seller_accepted',
  'confirmed',
  'delivered',
]

function sellerProgressClass(
  status,
) {
  const normalized =
    String(
      status ||
        '',
    ).toLowerCase()

  if (normalized === 'delivered') {
    return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  }

  if (normalized === 'out_for_delivery') {
    return 'border-indigo-200 bg-indigo-100 text-indigo-800'
  }

  if (normalized === 'carrier_handoff') {
    return 'border-sky-200 bg-sky-100 text-sky-800'
  }

  if (
    [
      'seller_cancelled',
      'rejected',
      'partial_unavailable',
      'delivery_failed',
    ].includes(
      normalized,
    )
  ) {
    return 'border-rose-200 bg-rose-100 text-rose-800'
  }

  if (
    [
      'packed',
      'picking',
      'seller_accepted',
    ].includes(
      normalized,
    )
  ) {
    return 'border-violet-200 bg-violet-100 text-violet-800'
  }

  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function sellerProgressGroups(
  order,
) {
  const counts =
    order?.sellerStatusCounts ||
    {}

  const statuses =
    Object.keys(
      counts,
    )
      .filter(
        (status) =>
          Number(
            counts[status] ||
              0,
          ) >
          0,
      )
      .sort(
        (left, right) => {
          const leftIndex =
            SELLER_STATUS_ORDER.indexOf(
              left,
            )

          const rightIndex =
            SELLER_STATUS_ORDER.indexOf(
              right,
            )

          return (
            (leftIndex === -1
              ? 999
              : leftIndex) -
            (rightIndex === -1
              ? 999
              : rightIndex)
          )
        },
      )

  return statuses.map(
    (status) => ({
      status,
      count:
        Number(
          counts[status] ||
            0,
        ),
    }),
  )
}

export default function OrdersPage() {
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

  const load =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
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
          const result =
            await listOrders({
              page:
                1,

              limit:
                30,
            })

          setData(
            result,
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load your Orders.',
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

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <div className="page-shell pb-5 pt-3 sm:pb-10 sm:pt-5">
        <section className="rounded-[22px] border border-emerald-200 bg-gradient-to-br from-[#dff8ee] via-[#e5f7f2] to-[#e9f3ff] p-3 shadow-sm sm:rounded-[30px] sm:p-8">
          <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-4">
            <h1 className="min-w-0 whitespace-nowrap text-[19px] font-black leading-none tracking-[-0.03em] text-stone-950 sm:text-4xl sm:leading-none">
              Your EPANTRY Orders
            </h1>

            <button
              type="button"
              onClick={() =>
                load({
                  refresh:
                    true,
                })
              }
              disabled={
                refreshing
              }
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-white/85 px-2.5 py-1.5 text-[10px] font-black text-emerald-900 shadow-sm disabled:opacity-60 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <RefreshCw
                size={14}
                className={`sm:h-4 sm:w-4 ${
                  refreshing
                    ? 'animate-spin'
                    : ''
                }`}
                aria-hidden="true"
              />

              Refresh
            </button>
          </div>

          <p className="mt-1.5 whitespace-nowrap text-[9px] font-semibold leading-4 text-stone-600 sm:mt-3 sm:max-w-3xl sm:whitespace-normal sm:text-base sm:font-normal sm:leading-6">
            EPANTRY Host splits stay grouped; retailer handoffs stay separate.
          </p>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-4 h-[300px] animate-pulse rounded-[24px] border border-indigo-100 bg-[#ecefff] sm:mt-5 sm:h-[380px] sm:rounded-[28px]" />
        ) : (data?.orders || [])
            .length ===
          0 ? (
          <section className="mt-4 rounded-[24px] border border-dashed border-violet-200 bg-[#f1edff] px-5 py-10 text-center sm:mt-5 sm:rounded-[28px] sm:px-6 sm:py-14">
            <PackageCheck
              size={30}
              className="mx-auto text-violet-500"
              aria-hidden="true"
            />

            <h2 className="mt-3 text-base font-black text-stone-950 sm:mt-4 sm:text-lg">
              No Orders yet
            </h2>

            <p className="mt-1.5 text-[12px] leading-5 text-stone-500 sm:mt-2 sm:text-sm">
              Orders will appear here after checkout creates a Parent Order.
            </p>
          </section>
        ) : (
          <section className="mt-4 space-y-2.5 rounded-[26px] border border-indigo-100 bg-[#e9edff] p-2.5 sm:mt-5 sm:space-y-3 sm:rounded-[30px] sm:p-4">
            {(data.orders || []).map(
              (
                order,
              ) => (
                <Link
                  key={
                    order.id
                  }
                  to={`/orders/${order.id}`}
                  className={`focus-ring group grid overflow-hidden gap-1.5 rounded-[18px] border p-2.5 shadow-sm transition hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:rounded-[26px] sm:p-6 ${
                    String(
                      order.status ||
                        '',
                    ).toLowerCase() ===
                    'delivered'
                      ? 'border-emerald-200 bg-[#e7f8ef] hover:border-emerald-300'
                      : String(
                            order.status ||
                              '',
                          ).toLowerCase() ===
                          'confirmed'
                        ? 'border-sky-200 bg-[#eaf4ff] hover:border-sky-300'
                        : 'border-violet-200 bg-[#f2edff] hover:border-violet-300'
                  }`}
                >
                  <div className="min-w-0">
                    <h2 className="block truncate whitespace-nowrap text-[11px] font-black leading-none text-stone-950 sm:text-base sm:leading-[1.3]">
                      {getOrderDisplayTitle(order)}
                    </h2>

                    <div className="mt-1 flex min-w-0 items-center gap-1 whitespace-nowrap sm:mt-2 sm:flex-wrap sm:gap-2">
                      <p className="min-w-0 shrink text-[8px] font-semibold text-stone-500 sm:text-xs">
                        {
                          order.createdAt
                            ? new Date(
                                order.createdAt,
                              ).toLocaleString()
                            : 'Created time unavailable'
                        }
                      </p>

                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-black uppercase tracking-[0.05em] sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.08em] ${
                          String(
                            order.status ||
                              '',
                          ).toLowerCase() ===
                          'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : String(
                                  order.status ||
                                    '',
                                ).toLowerCase() ===
                                'confirmed'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        {
                          formatStatus(
                            order.status,
                          )
                        }
                      </span>

                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-black uppercase tracking-[0.05em] sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.08em] ${
                          String(
                            order.paymentStatus ||
                              '',
                          ).toLowerCase() ===
                          'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : String(
                                  order.paymentStatus ||
                                    '',
                                ).toLowerCase() ===
                                'pending'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        Payment{' '}
                        {
                          formatStatus(
                            order.paymentStatus,
                          )
                        }
                      </span>
                    </div>

                    {Number(
                      order.sellerCount ||
                        0,
                    ) >
                      0 && (
                      <div className="mt-1 flex min-w-0 items-center justify-between gap-1 overflow-hidden whitespace-nowrap sm:mt-3 sm:flex-wrap sm:justify-start sm:gap-2 sm:overflow-visible">
                        <span className="shrink-0 text-[7.5px] font-black uppercase tracking-[0.06em] text-stone-500 sm:text-[10px] sm:tracking-[0.12em]">
                          {order.sellerCount}{' '}
                          {Number(
                            order.sellerCount,
                          ) === 1
                            ? 'Host delivery'
                            : 'Host deliveries'}
                        </span>

                        {sellerProgressGroups(
                          order,
                        ).map(
                          (group) => (
                            <span
                              key={group.status}
                              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[7.5px] font-black sm:px-2.5 sm:py-1 sm:text-[10px] ${sellerProgressClass(
                                group.status,
                              )}`}
                            >
                              {group.count}{' '}
                              {formatStatus(
                                group.status,
                              )}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-0.5 flex items-end justify-between gap-3 border-t border-black/5 pt-1.5 sm:mt-0 sm:justify-end sm:gap-4 sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-[7.5px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                        Total
                      </p>

                      <p className="mt-0.5 text-[14px] font-black leading-none text-stone-950 sm:mt-1 sm:text-lg">
                        {formatMoney(
                          order.totals
                            ?.totalLandedCostMinor,

                          order.totals
                            ?.currency,
                        )}
                      </p>
                    </div>

                    <ArrowRight
                      size={16}
                      className="shrink-0 text-stone-400 sm:h-[18px] sm:w-[18px]"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              ),
            )}
          </section>
        )}
      </div>
    </main>
  )
}