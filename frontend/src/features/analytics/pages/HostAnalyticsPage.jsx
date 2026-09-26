import {
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Eye,
  RefreshCw,
  ShoppingBag,
  Store,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  getAnalyticsErrorMessage,
  getHostAnalyticsDashboard,
} from '../services/analytics.service'

const HOST_ORGANIZATION_STORAGE_KEY =
  'epantry_hospitality_organization_id'

function Metric({
  label,
  value,
  helper = '',
  tone = 'mint',
}) {
  const toneClass =
    tone === 'blue'
      ? 'border-sky-200/80 bg-[#eef7ff]'
      : tone === 'lavender'
        ? 'border-violet-200/70 bg-[#f4f0ff]'
        : 'border-emerald-200/80 bg-[#edf9f4]'

  return (
    <div
      className={[
        'min-w-0 rounded-[16px] border p-3 shadow-[0_8px_24px_rgba(28,25,23,0.05)] sm:rounded-[22px] sm:p-4',
        toneClass,
      ].join(' ')}
    >
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-500 sm:text-[10px]">
        {label}
      </p>

      <p className="mt-1.5 break-words text-xl font-black tracking-tight text-stone-950 sm:mt-2 sm:text-2xl">
        {value ?? 0}
      </p>

      {helper ? (
        <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-500 sm:text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

function pct(
  value,
) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

function moneyFromMinor(
  value,
  currency = 'INR',
) {
  const amount =
    Number(
      value ||
        0,
    )

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',
      currency:
        currency ||
        'INR',
      maximumFractionDigits:
        0,
    },
  ).format(
    amount /
      100,
  )
}

function compactDate(
  value,
) {
  if (!value) {
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

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day:
        '2-digit',
      month:
        'short',
    },
  ).format(
    date,
  )
}

function StepCard({
  number,
  title,
  text,
  tone = 'mint',
  to = '',
}) {
  const toneClass =
    tone === 'blue'
      ? 'border-sky-200 bg-[#eaf6ff]'
      : tone === 'lavender'
        ? 'border-violet-200 bg-[#f2edff]'
        : 'border-emerald-200 bg-[#e9f8f1]'

  const content = (
    <div
      className={[
        'flex h-full min-w-0 items-start gap-2 rounded-[14px] border p-2.5 sm:gap-3 sm:rounded-[20px] sm:p-4',
        toneClass,
        to
          ? 'transition hover:-translate-y-0.5 hover:shadow-md'
          : '',
      ].join(' ')}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-8 sm:text-[10px]">
        {number}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          <p className="min-w-0 text-[10px] font-black leading-4 text-stone-950 sm:text-sm">
            {title}
          </p>

          {to ? (
            <ChevronRight
              size={13}
              className="shrink-0 text-stone-500"
            />
          ) : null}
        </div>

        <p className="mt-0.5 text-[8px] font-semibold leading-3.5 text-stone-600 sm:mt-1 sm:text-[11px] sm:leading-4">
          {text}
        </p>
      </div>
    </div>
  )

  if (!to) {
    return content
  }

  return (
    <Link
      to={to}
      className="focus-ring block min-w-0"
    >
      {content}
    </Link>
  )
}

function StatLine({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/75 px-3 py-2 sm:px-3.5 sm:py-2.5">
      <span className="min-w-0 text-[10px] font-bold text-stone-600 sm:text-sm">
        {label}
      </span>
      <span className="shrink-0 text-[11px] font-black text-stone-950 sm:text-sm">
        {value ?? 0}
      </span>
    </div>
  )
}

export default function HostAnalyticsPage() {
  const [data, setData] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [organizationId, setOrganizationId] =
    useState(
      () =>
        window.localStorage.getItem(
          HOST_ORGANIZATION_STORAGE_KEY,
        ) ||
        '',
    )

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const result =
            await getHostAnalyticsDashboard()

          setData(
            result,
          )
        } catch (requestError) {
          setError(
            getAnalyticsErrorMessage(
              requestError,
              'Unable to load business analytics.',
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
    [load],
  )

  const operational =
    data?.operational ||
    {}

  const rangeText =
    data?.range?.start &&
    data?.range?.end
      ? `${compactDate(
          data.range.start,
        )} - ${compactDate(
          data.range.end,
        )}`
      : 'Last 30 days'

  return (
    <div className="min-w-0 p-2 sm:p-4 lg:p-5">
      <header className="rounded-[20px] border border-emerald-200/80 bg-[linear-gradient(120deg,#e8f8f1_0%,#eef8ff_100%)] p-3 shadow-[0_14px_40px_rgba(23,72,59,0.07)] sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-800 sm:text-[10px]">
              <BarChart3 size={13} />
              Business analytics
            </div>

            <h1 className="mt-1.5 text-[21px] font-black tracking-[-0.035em] text-stone-950 sm:mt-2 sm:text-3xl">
              {data?.organization?.displayName || 'Your business performance'}
            </h1>

            <p className="mt-1 max-w-3xl text-[10px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
              See orders, sales activity, listings and customer interest in one place, then open the page that needs attention.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white/85 px-2.5 py-2 text-[9px] font-black text-emerald-800 shadow-sm disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-xs"
          >
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">
          <StepCard
            number="01"
            title="Check sales"
            text="See orders, units and order value."
            tone="mint"
          />

          <StepCard
            number="02"
            title="Watch fulfillment"
            text="Spot orders still moving toward delivery."
            tone="blue"
          />

          <StepCard
            number="03"
            title="Improve listings"
            text="Review products that are currently live."
            tone="lavender"
            to="/host/marketplace"
          />

          <StepCard
            number="04"
            title="Take action"
            text="Open Orders and handle what needs attention."
            tone="mint"
            to="/host/orders"
          />
        </div>
      </header>

      {error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-800 sm:mt-4 sm:p-4 sm:text-sm">
          {error}
        </div>
      ) : null}

      <section className="mt-3 rounded-[20px] border border-sky-200/80 bg-[#eaf6ff] p-3 shadow-[0_12px_34px_rgba(14,116,144,0.06)] sm:mt-4 sm:rounded-[26px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShoppingBag
                className="text-sky-700"
                size={17}
              />
              <h2 className="text-sm font-black text-stone-950 sm:text-lg">
                Sales performance
              </h2>
            </div>
            <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:mt-1 sm:text-xs">
              Real order records for {rangeText}.
            </p>
          </div>

          <Link
            to="/host/orders"
            className="focus-ring shrink-0 rounded-xl bg-[#17483b] px-2.5 py-2 text-[9px] font-black text-white sm:px-3.5 sm:text-xs"
          >
            Open Orders
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 xl:grid-cols-4">
          <Metric
            label="Orders received"
            value={operational.ordersReceived || 0}
            helper="Paid / confirmed business orders"
            tone="mint"
          />

          <Metric
            label="In progress"
            value={operational.activeOrders || 0}
            helper="Still being prepared or delivered"
            tone="blue"
          />

          <Metric
            label="Delivered"
            value={operational.deliveredOrders || 0}
            helper="Currently marked delivered"
            tone="mint"
          />

          <Metric
            label="Order value"
            value={moneyFromMinor(
              operational.trackedOrderValueMinor,
              operational.currency,
            )}
            helper="Before Finance settlement"
            tone="lavender"
          />
        </div>
      </section>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2">
        <section className="rounded-[20px] border border-emerald-200/80 bg-[#edf9f4] p-3 shadow-sm sm:rounded-[26px] sm:p-5">
          <div className="flex items-center gap-2">
            <Store
              className="text-emerald-700"
              size={17}
            />
            <div>
              <h2 className="text-sm font-black text-stone-950 sm:text-base">
                Listings & orders
              </h2>
              <p className="text-[9px] font-semibold text-stone-500 sm:text-xs">
                Current selling setup and order volume.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-1.5 sm:gap-2">
            <StatLine
              label="Active product listings"
              value={operational.activeListings || 0}
            />
            <StatLine
              label="Listings you manage"
              value={operational.managedListings || 0}
            />
            <StatLine
              label="Units ordered"
              value={operational.unitsOrdered || 0}
            />
            <StatLine
              label="Completed orders"
              value={operational.completedOrders || 0}
            />
          </div>

          <Link
            to="/host/marketplace"
            className="focus-ring mt-3 inline-flex items-center gap-1 rounded-xl bg-[#17483b] px-3 py-2 text-[9px] font-black text-white sm:text-xs"
          >
            Manage listings
            <ChevronRight size={13} />
          </Link>
        </section>

        <section className="rounded-[20px] border border-violet-200/70 bg-[#f3efff] p-3 shadow-sm sm:rounded-[26px] sm:p-5">
          <div className="flex items-center gap-2">
            <Eye
              className="text-violet-700"
              size={17}
            />
            <div>
              <h2 className="text-sm font-black text-stone-950 sm:text-base">
                Customer activity
              </h2>
              <p className="text-[9px] font-semibold text-stone-500 sm:text-xs">
                Privacy-safe activity recorded while customers explore EPANTRY.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
            <StatLine
              label="Baskets created"
              value={data?.lenses?.commerce?.basketCreated || 0}
            />
            <StatLine
              label="Recipe views"
              value={data?.lenses?.recipes?.viewed || 0}
            />
            <StatLine
              label="Recipe selections"
              value={data?.lenses?.recipes?.selected || 0}
            />
            <StatLine
              label="Recipes cooked"
              value={data?.lenses?.recipes?.cooked || 0}
            />
          </div>

          <p className="mt-2 text-[9px] font-semibold leading-4 text-violet-900/65 sm:text-[11px]">
            These activity signals can be lower than order totals because they only count tracked customer journeys linked to this business.
          </p>
        </section>
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2">
        <section className="rounded-[20px] border border-sky-200/80 bg-[#eef7ff] p-3 shadow-sm sm:rounded-[26px] sm:p-5">
          <div className="flex items-center gap-2">
            <BarChart3
              className="text-sky-700"
              size={17}
            />
            <h2 className="text-sm font-black text-stone-950 sm:text-base">
              Discovery mix
            </h2>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-3">
            <Metric
              label="Organic"
              value={data?.organicSponsored?.organic || 0}
              tone="mint"
            />
            <Metric
              label="Sponsored"
              value={data?.organicSponsored?.sponsored || 0}
              tone="blue"
            />
            <Metric
              label="Mixed"
              value={data?.organicSponsored?.mixed || 0}
              tone="lavender"
            />
          </div>
        </section>

        <section className="rounded-[20px] border border-emerald-200/80 bg-[#e9f8f1] p-3 shadow-sm sm:rounded-[26px] sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <BellRing
                  className="text-emerald-700"
                  size={17}
                />
                <h2 className="text-sm font-black text-stone-950 sm:text-base">
                  Helpful notification actions
                </h2>
              </div>

              <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-600 sm:text-xs">
                How often a notification led to a useful action.
              </p>
            </div>

            <div className="rounded-2xl bg-white/80 px-4 py-2 text-center">
              <p className="text-xl font-black text-emerald-900 sm:text-2xl">
                {pct(data?.notificationUtility?.actionRate)}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-3 rounded-[20px] border border-stone-200 bg-white p-3 shadow-sm sm:mt-4 sm:rounded-[26px] sm:p-5">
        <div className="flex items-start gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 sm:size-10">
            <CheckCircle2 size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-stone-950 sm:text-base">
              How these numbers work
            </h2>
            <p className="mt-1 text-[9px] font-semibold leading-4 text-stone-600 sm:text-xs sm:leading-5">
              Orders, units and listing totals come from your saved business records. Customer discovery metrics use privacy-safe activity signals and do not change safety, search or ranking decisions.
            </p>
          </div>
        </div>
      </section>

      <details className="mt-3 rounded-[18px] border border-stone-200 bg-white p-3 shadow-sm sm:mt-4 sm:rounded-[22px] sm:p-4">
        <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
          Manage another business workspace
        </summary>

        <p className="mt-2 text-[9px] font-semibold leading-4 text-stone-500 sm:text-xs">
          Only use this when your Host account manages more than one business.
        </p>

        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={organizationId}
            onChange={(event) =>
              setOrganizationId(
                event.target.value,
              )
            }
            placeholder="Business workspace ID"
            className="focus-ring min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[10px] font-semibold sm:px-3.5 sm:py-2.5 sm:text-sm"
          />

          <button
            type="button"
            className="focus-ring rounded-xl bg-stone-900 px-3 py-2 text-[9px] font-black text-white sm:px-4 sm:py-2.5 sm:text-xs"
            onClick={() => {
              const value =
                organizationId.trim()

              if (value) {
                window.localStorage.setItem(
                  HOST_ORGANIZATION_STORAGE_KEY,
                  value,
                )
              } else {
                window.localStorage.removeItem(
                  HOST_ORGANIZATION_STORAGE_KEY,
                )
              }

              load()
            }}
          >
            Switch workspace
          </button>
        </div>
      </details>
    </div>
  )
}
