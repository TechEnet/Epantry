import {
  BarChart3,
  BellRing,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

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
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-stone-950">
        {value ?? 0}
      </p>

      {helper ? (
        <p className="mt-1 text-xs text-stone-500">
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
              'Unable to load Host analytics.',
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

  const funnel =
    data?.funnel ||
    {
      counts: {},
      rates: {},
    }

  return (
    <div className="p-4 sm:p-6 lg:p-7">
      <header className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
              <BarChart3 size={14} />
              Host Analytics
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
              {data?.organization?.displayName || 'Unified Host analytics'}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Seller, Brand and B2B/Hospitality are organization-scoped analytics lenses inside Host. This dashboard never creates a separate Seller, Brand or B2B login role.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-black text-stone-700 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={organizationId}
            onChange={(event) =>
              setOrganizationId(
                event.target.value,
              )
            }
            placeholder="Organization ObjectId — only needed when multiple scoped organizations are available"
            className="focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold"
          />

          <button
            type="button"
            className="focus-ring rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white"
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
            Use organization
          </button>
        </div>
      </header>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Recipe selections"
          value={funnel.counts?.recipe || 0}
        />

        <Metric
          label="Requirements"
          value={funnel.counts?.requirements || 0}
          helper={`${pct(funnel.rates?.recipeToRequirements)} of selections`}
        />

        <Metric
          label="Baskets"
          value={funnel.counts?.basket || 0}
          helper={`${pct(funnel.rates?.requirementsToBasket)} of requirements`}
        />

        <Metric
          label="Orders"
          value={funnel.counts?.orders || 0}
          helper={`${pct(funnel.rates?.basketToOrder)} of baskets`}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShoppingBag
              className="text-emerald-700"
              size={18}
            />

            <h2 className="font-black">
              Commerce lens
            </h2>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">
                Basket created
              </dt>
              <dd className="font-black">
                {data?.lenses?.commerce?.basketCreated || 0}
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-stone-500">
                Handoffs
              </dt>
              <dd className="font-black">
                {data?.lenses?.commerce?.handoffCreated || 0}
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-stone-500">
                Orders
              </dt>
              <dd className="font-black">
                {data?.lenses?.commerce?.orderCreated || 0}
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-stone-500">
                Delivered
              </dt>
              <dd className="font-black">
                {data?.lenses?.commerce?.orderDelivered || 0}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UtensilsCrossed
              className="text-emerald-700"
              size={18}
            />

            <h2 className="font-black">
              Recipe / Brand lens
            </h2>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">
                Viewed
              </dt>
              <dd className="font-black">
                {data?.lenses?.recipes?.viewed || 0}
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-stone-500">
                Selected
              </dt>
              <dd className="font-black">
                {data?.lenses?.recipes?.selected || 0}
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-stone-500">
                Cooked
              </dt>
              <dd className="font-black">
                {data?.lenses?.recipes?.cooked || 0}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BellRing
              className="text-emerald-700"
              size={18}
            />

            <h2 className="font-black">
              Notification utility
            </h2>
          </div>

          <p className="mt-4 text-3xl font-black">
            {pct(data?.notificationUtility?.actionRate)}
          </p>

          <p className="mt-1 text-xs text-stone-500">
            Useful action rate, not click-through rate alone.
          </p>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3
              className="text-emerald-700"
              size={18}
            />

            <h2 className="font-black">
              Organic vs sponsored
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Metric
              label="Organic"
              value={data?.organicSponsored?.organic || 0}
            />

            <Metric
              label="Sponsored"
              value={data?.organicSponsored?.sponsored || 0}
            />

            <Metric
              label="Mixed"
              value={data?.organicSponsored?.mixed || 0}
            />
          </div>
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
          <h2 className="font-black">
            Reporting boundary
          </h2>

          <p className="mt-3 text-sm leading-6 text-stone-400">
            Metrics are derived server-side from privacy-minimized EPANTRY events and evidence-backed attribution. A recipe view does not automatically claim order revenue. Workspace mode does not authorize analytics access.
          </p>
        </section>
      </div>
    </div>
  )
}