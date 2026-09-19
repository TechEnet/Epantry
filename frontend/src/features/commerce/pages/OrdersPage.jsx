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
      <div className="page-shell pb-7 pt-4 sm:pb-10 sm:pt-5">
        <section className="rounded-[30px] border border-emerald-200 bg-gradient-to-br from-[#dff8ee] via-[#e5f7f2] to-[#e9f3ff] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                Your EPANTRY Orders
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">
                Parent Orders group EPANTRY Host fulfilment splits under one
                Customer transaction. External retailer handoffs remain
                separate.
              </p>
            </div>

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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white/85 px-4 py-2.5 text-sm font-black text-emerald-900 shadow-sm disabled:opacity-60"
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

              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-5 h-[380px] animate-pulse rounded-[28px] border border-indigo-100 bg-[#ecefff]" />
        ) : (data?.orders || [])
            .length ===
          0 ? (
          <section className="mt-5 rounded-[28px] border border-dashed border-violet-200 bg-[#f1edff] px-6 py-14 text-center">
            <PackageCheck
              size={30}
              className="mx-auto text-violet-500"
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-black text-stone-950">
              No Orders yet
            </h2>

            <p className="mt-2 text-sm text-stone-500">
              Orders will appear here after checkout creates a Parent Order.
            </p>
          </section>
        ) : (
          <section className="mt-5 space-y-3 rounded-[30px] border border-indigo-100 bg-[#e9edff] p-3 sm:p-4">
            {(data.orders || []).map(
              (
                order,
              ) => (
                <Link
                  key={
                    order.id
                  }
                  to={`/orders/${order.id}`}
                  className={`focus-ring group grid gap-4 rounded-[26px] border p-5 shadow-sm transition hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6 ${
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
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-stone-950">
                        {getOrderDisplayTitle(order)}
                      </h2>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
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
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
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

                    <p className="mt-2 text-xs font-semibold text-stone-500">
                      {
                        order.createdAt
                          ? new Date(
                              order.createdAt,
                            ).toLocaleString()
                          : 'Created time unavailable'
                      }
                    </p>

                    {Number(
                      order.sellerCount ||
                        0,
                    ) >
                      0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
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
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${sellerProgressClass(
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

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Total
                      </p>

                      <p className="mt-1 text-lg font-black text-stone-950">
                        {formatMoney(
                          order.totals
                            ?.totalLandedCostMinor,

                          order.totals
                            ?.currency,
                        )}
                      </p>
                    </div>

                    <ArrowRight
                      size={18}
                      className="text-stone-400"
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