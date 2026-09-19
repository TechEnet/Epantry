import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShoppingBag,
  WalletCards,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  getHostEarningsOverview,
  getHostOperationsErrorMessage,
} from '../../hostOperations/services/hostOperations.service'

function formatMinorCurrency(
  amountMinor,
  currency = 'INR',
) {
  const amount =
    Number(
      amountMinor ||
        0,
    ) / 100

  try {
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
      amount,
    )
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value,
    )

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat(
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
  ).format(
    date,
  )
}

function shortId(value) {
  const normalized =
    String(
      value ||
        '',
    )

  if (!normalized) {
    return '—'
  }

  if (normalized.length <= 12) {
    return normalized
  }

  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`
}

const settlementStatusMeta = {
  not_yet_settleable: {
    label:
      'Payment captured',
    className:
      'bg-sky-100 text-sky-800',
  },
  awaiting_settlement: {
    label:
      'Awaiting settlement',
    className:
      'bg-amber-100 text-amber-800',
  },
  pending_approval: {
    label:
      'Pending approval',
    className:
      'bg-violet-100 text-violet-800',
  },
  approved: {
    label:
      'Approved',
    className:
      'bg-sky-100 text-sky-800',
  },
  paid: {
    label:
      'Paid',
    className:
      'bg-emerald-100 text-emerald-800',
  },
  rejected: {
    label:
      'Rejected',
    className:
      'bg-red-100 text-red-700',
  },
  void: {
    label:
      'Void',
    className:
      'bg-stone-200 text-stone-700',
  },
}

function StatusBadge({ status }) {
  const meta =
    settlementStatusMeta[status] ||
    {
      label:
        status ||
        'Unknown',
      className:
        'bg-stone-100 text-stone-700',
    }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

export default function HostEarningsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (quiet) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const result =
          await getHostEarningsOverview()

        setData(
          result ||
          null,
        )
        setError('')
      } catch (loadError) {
        setError(
          getHostOperationsErrorMessage(
            loadError,
            'Unable to load Host earnings.',
          ),
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    load()

    const interval =
      window.setInterval(
        () =>
          load({
            quiet:
              true,
          }),
        10000,
      )

    const refreshOnFocus = () => {
      load({
        quiet:
          true,
      })
    }

    window.addEventListener(
      'focus',
      refreshOnFocus,
    )

    const refreshOnVisibility = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        refreshOnFocus()
      }
    }

    document.addEventListener(
      'visibilitychange',
      refreshOnVisibility,
    )

    return () => {
      window.clearInterval(
        interval,
      )
      window.removeEventListener(
        'focus',
        refreshOnFocus,
      )
      document.removeEventListener(
        'visibilitychange',
        refreshOnVisibility,
      )
    }
  }, [load])

  const earnings =
    data?.earnings ||
    {}

  const currency =
    earnings.currency ||
    'INR'

  const recentOrders =
    data?.recentOrders ||
    []

  const recentSettlements =
    data?.recentSettlements ||
    []

  const lastUpdatedLabel =
    useMemo(
      () =>
        earnings.refreshedAt
          ? formatDateTime(
              earnings.refreshedAt,
            )
          : 'Waiting for live data',
      [earnings.refreshedAt],
    )

  return (
    <main className="min-h-screen bg-[#f7f5ef] p-5 sm:p-7">
      <section className="relative overflow-hidden rounded-[30px] border border-[#204d73] bg-[#123f63] px-6 py-7 text-white shadow-[0_28px_70px_-48px_rgba(15,57,89,0.85)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 size-64 rounded-full bg-violet-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                Host earnings
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-50">
                <span className="size-1.5 rounded-full bg-cyan-300" />
                Live refresh · 10 sec
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
              Earnings
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/70 sm:text-base">
              Captured customer-payment revenue for this Host, plus the governed settlement trail. Delivery still controls when revenue becomes settlement-eligible.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              load({
                quiet:
                  true,
              })
            }
            disabled={refreshing}
            className="focus-ring inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#123f63] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={refreshing ? 'animate-spin' : ''}
            />
            {refreshing
              ? 'Refreshing…'
              : 'Refresh now'}
          </button>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs font-semibold text-white/55">
          <span>
            Last updated: {lastUpdatedLabel}
          </span>
          <span>
            Source: payment ledger + Seller orders + governed settlements
          </span>
        </div>
      </section>

      {error ? (
        <div className="mt-5 rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[26px] border border-cyan-200 bg-[#dff7fb] p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-cyan-600 text-white">
              <Banknote size={18} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-800">
              Captured revenue
            </span>
          </div>
          <p className="mt-5 text-3xl font-black tracking-[-0.04em] text-slate-950">
            {loading
              ? '—'
              : formatMinorCurrency(
                  earnings.totalEarnedMinor,
                  currency,
                )}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
            This Host's merchandise share from successfully captured customer payments.
          </p>
        </article>

        <article className="rounded-[26px] border border-emerald-200 bg-[#dcf7e8] p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-emerald-700 text-white">
              <CheckCircle2 size={18} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
              Paid
            </span>
          </div>
          <p className="mt-5 text-3xl font-black tracking-[-0.04em] text-slate-950">
            {loading
              ? '—'
              : formatMinorCurrency(
                  earnings.paidMinor,
                  currency,
                )}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
            Net amount from settlements already marked paid.
          </p>
        </article>

        <article className="rounded-[26px] border border-violet-200 bg-[#eee8ff] p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-violet-600 text-white">
              <WalletCards size={18} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-800">
              In settlement
            </span>
          </div>
          <p className="mt-5 text-3xl font-black tracking-[-0.04em] text-slate-950">
            {loading
              ? '—'
              : formatMinorCurrency(
                  earnings.inSettlementMinor,
                  currency,
                )}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
            Net amount in pending-approval or approved settlements.
          </p>
        </article>

        <article className="rounded-[26px] border border-amber-200 bg-[#fff2c9] p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-amber-500 text-stone-950">
              <Clock3 size={18} aria-hidden="true" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-900">
              Awaiting settlement
            </span>
          </div>
          <p className="mt-5 text-3xl font-black tracking-[-0.04em] text-slate-950">
            {loading
              ? '—'
              : formatMinorCurrency(
                  earnings.awaitingSettlementMinor,
                  currency,
                )}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
            Delivered order value not yet included in a settlement.
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <article className="overflow-hidden rounded-[28px] border border-sky-200 bg-[#e7f4ff]">
          <div className="flex flex-col gap-3 border-b border-sky-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">
                Order earnings
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950">
                Recent paid orders
              </h2>
            </div>

            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-sky-800">
              {earnings.capturedOrders || 0} paid total
            </span>
          </div>

          <div className="overflow-x-auto bg-white/55">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-500">
                  <th className="border-b border-sky-100 px-5 py-3">Order</th>
                  <th className="border-b border-sky-100 px-4 py-3">Value</th>
                  <th className="border-b border-sky-100 px-4 py-3">Settlement</th>
                  <th className="border-b border-sky-100 px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length ? (
                  recentOrders.map((order) => (
                    <tr key={order.sellerOrderId} className="text-sm text-slate-700">
                      <td className="border-b border-sky-100 px-5 py-4">
                        <div className="font-black text-slate-950">
                          {shortId(order.sellerOrderId)}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Parent {shortId(order.parentOrderId)}
                        </div>
                      </td>
                      <td className="border-b border-sky-100 px-4 py-4 font-black text-slate-950">
                        {formatMinorCurrency(
                          order.netPayableMinor ??
                            order.grossMinor,
                          order.currency ||
                            currency,
                        )}
                      </td>
                      <td className="border-b border-sky-100 px-4 py-4">
                        <StatusBadge status={order.settlementStatus} />
                      </td>
                      <td className="border-b border-sky-100 px-5 py-4 text-xs font-semibold text-slate-500">
                        {formatDateTime(
                          order.updatedAt ||
                            order.createdAt,
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                      No captured Host revenue yet. Paid customer orders will appear here immediately after payment confirmation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[28px] border border-violet-200 bg-[#eee8ff] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">
                Settlement trail
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950">
                Recent settlements
              </h2>
            </div>
            <WalletCards size={21} aria-hidden="true" className="text-violet-700" />
          </div>

          <div className="mt-5 space-y-3">
            {recentSettlements.length ? (
              recentSettlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="rounded-[20px] border border-white/70 bg-white/75 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {formatMinorCurrency(
                          settlement.totals?.netPayableMinor,
                          settlement.currency ||
                            currency,
                        )}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {settlement.lineCount || 0} order lines
                      </p>
                    </div>
                    <StatusBadge status={settlement.status} />
                  </div>

                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {formatDateTime(settlement.periodStart)} → {formatDateTime(settlement.periodEnd)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-white/70 bg-white/75 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                No settlement records yet.
              </div>
            )}
          </div>

          <Link
            to="/host/finance"
            className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800"
          >
            Open Payments & Finance
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section className="mt-6 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-stone-100 text-stone-700">
              <ShoppingBag size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-black text-stone-950">
                Earnings are read-only here
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">
                This page reflects delivered orders and settlement governance. Settlement approval and paid transitions continue to use the existing Payments & Finance workflow.
              </p>
            </div>
          </div>

          <Link
            to="/host/orders"
            className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-[#faf8f2] px-4 py-2.5 text-sm font-black text-stone-800 transition hover:border-sky-200 hover:bg-sky-50"
          >
            Open Orders
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  )
}
